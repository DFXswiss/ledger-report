import { ethers } from "ethers";
import { validate as isValidBtcAddress, Network as BtcNetwork } from "bitcoin-address-validation";
import { useState, useCallback } from "react";
import {
  EvmBlockchain,
  NonEvmBlockchain,
  isBtcBlockchain,
  isEvmBlockchain,
  type SupportedAsset,
} from "../types";
import { formatTokenAmount } from "../utils/formatNumber";
import { cacheKey } from "../utils/cacheKey";
import { blockchainLabel } from "../utils/blockchainLabel";

interface BalanceResult {
  balance: string | null;
  loading: boolean;
  error: string | null;
}

interface FetchBalanceParams {
  asset: SupportedAsset;
  walletAddress: string;
  timestamp: string;
}

const apiKey = import.meta.env.VITE_ALCHEMY_API_KEY || "YOUR_ALCHEMY_API_KEY";

const evmFetchUrl: Record<EvmBlockchain, string> = {
  [EvmBlockchain.ETH]: `https://eth-mainnet.g.alchemy.com/v2/${apiKey}`,
  [EvmBlockchain.POLYGON]: `https://polygon-mainnet.g.alchemy.com/v2/${apiKey}`,
  [EvmBlockchain.BSC]: `https://bsc-mainnet.g.alchemy.com/v2/${apiKey}`,
  [EvmBlockchain.ARB]: `https://arb-mainnet.g.alchemy.com/v2/${apiKey}`,
  [EvmBlockchain.OPT]: `https://opt-mainnet.g.alchemy.com/v2/${apiKey}`,
  [EvmBlockchain.BASE]: `https://base-mainnet.g.alchemy.com/v2/${apiKey}`,
  [EvmBlockchain.HAQQ]: `https://haqq-mainnet.g.alchemy.com/v2/${apiKey}`,
  [EvmBlockchain.GNOSIS]: `https://gnosis-mainnet.g.alchemy.com/v2/${apiKey}`,
};

const ESPLORA_BASE =
  import.meta.env.VITE_ESPLORA_URL?.replace(/\/$/, "") || "https://mempool.space/api";

const BTC_DECIMALS = 8;

export const useWalletBalance = () => {
  const [result, setResult] = useState<BalanceResult>({
    balance: null,
    loading: false,
    error: null,
  });

  const reset = useCallback(
    () => setResult({ balance: null, loading: false, error: null }),
    [],
  );

  const fetchBalance = useCallback(async ({ asset, walletAddress, timestamp }: FetchBalanceParams) => {
    setResult({ balance: null, loading: true, error: null });

    try {
      const targetDate = new Date(timestamp + "T00:00:00Z");
      if (isNaN(targetDate.getTime())) {
        throw new Error(`Invalid date: ${timestamp}`);
      }
      const targetTimestamp = Math.floor(targetDate.getTime() / 1000);

      let balance: string;
      if (isBtcBlockchain(asset.blockchain)) {
        balance = await fetchBitcoinBalance(walletAddress, targetTimestamp);
      } else if (isEvmBlockchain(asset.blockchain)) {
        balance = await fetchEvmBalance(asset, walletAddress, targetTimestamp, timestamp);
      } else {
        throw new Error(`Unsupported blockchain: ${asset.blockchain}`);
      }

      setResult({ balance, loading: false, error: null });
    } catch (error: unknown) {
      setResult({
        balance: null,
        loading: false,
        error: error instanceof Error ? error.message : String(error),
      });
      // Re-throw so the form submit handler short-circuits — there's no point
      // continuing to a price fetch when the balance lookup already failed.
      // Mirrors useCurrencyPrice.fetchPrice, which also re-throws after
      // recording the error in local state.
      throw error;
    }
  }, []);

  return {
    ...result,
    fetchBalance,
    reset,
  };
};

// ---------- EVM ----------

async function fetchEvmBalance(
  asset: SupportedAsset,
  walletAddress: string,
  targetTimestamp: number,
  timestamp: string,
): Promise<string> {
  if (!ethers.isAddress(walletAddress)) throw new Error("Invalid Ethereum address");

  const blockchain = asset.blockchain as EvmBlockchain;
  const blockNumber = await findEvmBlockByTimestamp(blockchain, targetTimestamp);
  if (isNaN(blockNumber)) throw new Error(`Failed to find block for timestamp: ${timestamp}`);

  const normalizedAddress = ethers.getAddress(walletAddress.toLowerCase());
  const abi = ["function balanceOf(address account)"];
  const iface = new ethers.Interface(abi);
  const edata = iface.encodeFunctionData("balanceOf", [normalizedAddress]);

  const response = await fetch(evmFetchUrl[blockchain], {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "eth_call",
      params: [{ to: asset.chainId, data: edata }, `0x${blockNumber.toString(16)}`],
    }),
  });

  if (!response.ok) {
    throw new Error(
      `Alchemy ${response.status} on ${blockchainLabel(blockchain)}: ${response.statusText || "request failed"}`,
    );
  }

  const data = await response.json();
  if (data.error) throw new Error(`RPC error: ${data.error.message}`);

  if (asset.decimals === undefined || asset.decimals === null) {
    throw new Error(
      `Asset ${asset.name} on ${blockchainLabel(blockchain)} has no decimals — please report this on GitHub.`,
    );
  }
  const balanceFormatted = ethers.formatUnits(data.result, asset.decimals);
  return formatTokenAmount(balanceFormatted);
}

async function findEvmBlockByTimestamp(blockchain: EvmBlockchain, targetTimestamp: number): Promise<number> {
  const key = cacheKey(["block", blockchain, targetTimestamp]);

  const cached = localStorage.getItem(key);
  if (cached) {
    const parsed = parseInt(cached, 10);
    if (!isNaN(parsed)) return parsed;
  }

  const currentBlock = await getEvmCurrentBlockNumber(blockchain);
  if (isNaN(currentBlock) || currentBlock <= 0) {
    throw new Error(`Invalid current block number for ${blockchainLabel(blockchain)}`);
  }

  let low = 1;
  let high = currentBlock;
  let bestBlock = high;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const blockTimestamp = await getEvmBlockTimestamp(blockchain, mid);

    if (isNaN(blockTimestamp)) {
      throw new Error(`Failed to get timestamp for block ${mid} on ${blockchainLabel(blockchain)}`);
    }

    if (blockTimestamp <= targetTimestamp) {
      bestBlock = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  localStorage.setItem(key, bestBlock.toString());
  return bestBlock;
}

async function getEvmCurrentBlockNumber(blockchain: EvmBlockchain): Promise<number> {
  const response = await fetch(evmFetchUrl[blockchain], {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_blockNumber", params: [] }),
  });
  if (!response.ok) {
    throw new Error(
      `Alchemy ${response.status} on ${blockchainLabel(blockchain)}: ${response.statusText || "request failed"}`,
    );
  }
  const data = await response.json();
  if (data.error) throw new Error(`Failed to get current block number: ${data.error.message}`);
  const result = parseInt(data.result, 16);
  if (isNaN(result)) throw new Error("Invalid block number response");
  return result;
}

async function getEvmBlockTimestamp(blockchain: EvmBlockchain, blockNumber: number): Promise<number> {
  const response = await fetch(evmFetchUrl[blockchain], {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "eth_getBlockByNumber",
      params: [`0x${blockNumber.toString(16)}`, false],
    }),
  });
  if (!response.ok) {
    throw new Error(
      `Alchemy ${response.status} on ${blockchainLabel(blockchain)}: ${response.statusText || "request failed"}`,
    );
  }
  const data = await response.json();
  if (data.error) throw new Error(`Failed to get block timestamp: ${data.error.message}`);
  if (!data.result || !data.result.timestamp) throw new Error("Invalid block response");
  const result = parseInt(data.result.timestamp, 16);
  if (isNaN(result)) throw new Error("Invalid timestamp in block");
  return result;
}

// ---------- Bitcoin (Esplora) ----------

interface EsploraTxStatus {
  confirmed: boolean;
  block_height?: number;
  block_time?: number;
}

interface EsploraVin {
  prevout: { scriptpubkey_address?: string; value: number } | null;
}

interface EsploraVout {
  scriptpubkey_address?: string;
  value: number;
}

interface EsploraTx {
  txid: string;
  status: EsploraTxStatus;
  vin: EsploraVin[];
  vout: EsploraVout[];
}

async function fetchBitcoinBalance(walletAddress: string, targetTimestamp: number): Promise<string> {
  if (!isValidBtcAddress(walletAddress, BtcNetwork.mainnet)) {
    throw new Error("Invalid Bitcoin address");
  }

  const targetHeight = await findBtcBlockByTimestamp(targetTimestamp);

  let satsBalance = 0;
  let lastSeenTxid: string | undefined;

  // Esplora returns confirmed TXs newest-first, 25 per page. We page until we've seen
  // every TX confirmed at or before targetHeight, then stop. TXs newer than targetHeight
  // are skipped (not yet existed at the snapshot date).
  while (true) {
    const url = lastSeenTxid
      ? `${ESPLORA_BASE}/address/${walletAddress}/txs/chain/${lastSeenTxid}`
      : `${ESPLORA_BASE}/address/${walletAddress}/txs/chain`;

    let res: Response;
    try {
      res = await fetch(url);
    } catch (e) {
      // `fetch` rejects with TypeError for network-level failures: DNS,
      // TLS, CORS preflight, the provider being down, an offline browser.
      // The default "TypeError: Failed to fetch" tells the user nothing
      // actionable. Translate it once at the boundary and re-throw so the
      // existing error path (setResult({error}) + re-throw to the form
      // handler) still runs unchanged.
      if (e instanceof TypeError) {
        throw new Error(
          `Bitcoin data provider unreachable. Check VITE_ESPLORA_URL or retry.`,
        );
      }
      throw e;
    }
    if (!res.ok) {
      if (res.status === 400 || res.status === 404) {
        // Address format is already validated above (isValidBtcAddress), so a
        // 400/404 here means Esplora has no record of any on-chain activity.
        throw new Error(
          `No on-chain activity found for ${walletAddress}. Double-check the address and try again.`,
        );
      }
      throw new Error(`Esplora request failed: ${res.status} ${res.statusText}`);
    }
    const page: EsploraTx[] = await res.json();
    if (page.length === 0) break;

    for (const tx of page) {
      if (!tx.status.confirmed || tx.status.block_height === undefined) continue;
      if (tx.status.block_height > targetHeight) continue;

      for (const out of tx.vout) {
        if (out.scriptpubkey_address === walletAddress) satsBalance += out.value;
      }
      for (const inp of tx.vin) {
        if (inp.prevout?.scriptpubkey_address === walletAddress) satsBalance -= inp.prevout.value;
      }
    }

    if (page.length < 25) break;
    lastSeenTxid = page[page.length - 1].txid;
  }

  if (satsBalance < 0) {
    throw new Error("Computed negative Bitcoin balance — chain data inconsistent");
  }

  const btc = satsBalance / 10 ** BTC_DECIMALS;
  return formatTokenAmount(btc.toFixed(BTC_DECIMALS));
}

// Bitcoin genesis block timestamp (2009-01-03 18:15:05 UTC). Any earlier
// timestamp can't resolve to a real block; Esplora answers with a 500 and
// the raw status code leaked into the UI before this client-side check.
const BTC_GENESIS_TIMESTAMP = 1230940800;

async function findBtcBlockByTimestamp(targetTimestamp: number): Promise<number> {
  if (targetTimestamp < BTC_GENESIS_TIMESTAMP) {
    throw new Error("Date is before Bitcoin existed");
  }

  const key = cacheKey(["block", NonEvmBlockchain.BTC, targetTimestamp]);
  const cached = localStorage.getItem(key);
  if (cached) {
    const parsed = parseInt(cached, 10);
    if (!isNaN(parsed)) return parsed;
  }

  let res: Response;
  try {
    res = await fetch(`${ESPLORA_BASE}/v1/mining/blocks/timestamp/${targetTimestamp}`);
  } catch (e) {
    // Same network-level translation as the address-paging fetch above:
    // surface an actionable message instead of "Failed to fetch".
    if (e instanceof TypeError) {
      throw new Error(
        `Bitcoin data provider unreachable. Check VITE_ESPLORA_URL or retry.`,
      );
    }
    throw e;
  }
  if (!res.ok) throw new Error(`Failed to resolve Bitcoin block for timestamp: ${res.status}`);
  const data = await res.json();
  if (typeof data.height !== "number") throw new Error("Invalid Esplora timestamp response");

  localStorage.setItem(key, data.height.toString());
  return data.height;
}
