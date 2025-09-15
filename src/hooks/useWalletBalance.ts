import { ethers } from "ethers";
import { useState, useCallback } from "react";
import { EvmBlockchain, type EvmAsset } from "../types";

interface BalanceResult {
  balance: string | null;
  loading: boolean;
  error: string | null;
}

interface FetchBalanceParams {
  asset: EvmAsset;
  walletAddress: string;
  timestamp: string;
}

const apiKey = import.meta.env.VITE_ALCHEMY_API_KEY || "YOUR_ALCHEMY_API_KEY";

const fetchUrl: Record<EvmBlockchain, string> = {
  [EvmBlockchain.ETH]: `https://eth-mainnet.g.alchemy.com/v2/${apiKey}`,
  [EvmBlockchain.POLYGON]: `https://polygon-mainnet.g.alchemy.com/v2/${apiKey}`,
  [EvmBlockchain.BSC]: `https://bsc-mainnet.g.alchemy.com/v2/${apiKey}`,
  [EvmBlockchain.ARB]: `https://arb-mainnet.g.alchemy.com/v2/${apiKey}`,
  [EvmBlockchain.OPT]: `https://opt-mainnet.g.alchemy.com/v2/${apiKey}`,
  [EvmBlockchain.BASE]: `https://base-mainnet.g.alchemy.com/v2/${apiKey}`,
  [EvmBlockchain.HAQQ]: `https://haqq-mainnet.g.alchemy.com/v2/${apiKey}`,
  [EvmBlockchain.GNOSIS]: `https://gnosis-mainnet.g.alchemy.com/v2/${apiKey}`,
};

export const useWalletBalance = () => {
  const [result, setResult] = useState<BalanceResult>({
    balance: null,
    loading: false,
    error: null,
  });

  const reset = () => setResult({ balance: null, loading: false, error: null });

  // Reference: https://www.alchemy.com/docs/how-to-get-erc-20-token-balance-at-a-given-block
  const fetchBalance = useCallback(
    async ({ asset, walletAddress, timestamp }: FetchBalanceParams) => {
      setResult({ balance: null, loading: true, error: null });

      try {
        if (!ethers.isAddress(walletAddress)) throw new Error("Invalid Ethereum address");

        const targetDate = new Date(timestamp + "T23:59:59Z"); // End of day UTC
        const targetTimestamp = Math.floor(targetDate.getTime() / 1000);
        const blockNumber = await findBlockByTimestamp(asset.blockchain, targetTimestamp);
        const normalizedAddress = ethers.getAddress(walletAddress.toLowerCase());

        // ABI
        const abi = ["function balanceOf(address account)"];
        const iface = new ethers.Interface(abi);
        const edata = iface.encodeFunctionData("balanceOf", [normalizedAddress]);

        const response = await fetch(fetchUrl[asset.blockchain], {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method: "eth_call",
            params: [
              {
                to: asset.chainId,
                data: edata,
              },
              ethers.toBeHex(blockNumber),
            ],
          }),
        });

        const data = await response.json();
        if (data.error) throw new Error(`RPC error: ${data.error.message}`);

        const rawBalance = data.result;
        const balance = (parseInt(rawBalance, 16) / 10 ** (asset.decimals ?? 18)).toFixed(6);
        setResult({ balance, loading: false, error: null });
      } catch (error: any) {
        setResult({
          balance: null,
          loading: false,
          error: error.message || "Failed to fetch balance",
        });
      }
    },
    []
  );

  // Find block number by timestamp using binary search with localStorage caching
  const findBlockByTimestamp = async (blockchain: EvmBlockchain, targetTimestamp: number): Promise<number> => {
    const cacheKey = `eth-block-${targetTimestamp}`;

    const cached = localStorage.getItem(cacheKey);
    if (cached) return parseInt(cached, 10);

    const currentBlock = await getCurrentBlockNumber(blockchain);

    let low = 1;
    let high = currentBlock;
    let bestBlock = high;

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      const blockTimestamp = await getBlockTimestamp(blockchain, mid);

      if (blockTimestamp <= targetTimestamp) {
        bestBlock = mid;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    // Cache the result
    localStorage.setItem(cacheKey, bestBlock.toString());

    return bestBlock;
  };

  // Helper function to get current block number
  const getCurrentBlockNumber = async (blockchain: EvmBlockchain): Promise<number> => {
    const response = await fetch(fetchUrl[blockchain], {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "eth_blockNumber",
        params: [],
      }),
    });
    const data = await response.json();
    return parseInt(data.result, 16);
  };

  // Helper function to get block timestamp
  const getBlockTimestamp = async (blockchain: EvmBlockchain, blockNumber: number): Promise<number> => {
    const response = await fetch(fetchUrl[blockchain], {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "eth_getBlockByNumber",
        params: [`0x${blockNumber.toString(16)}`, false],
      }),
    });
    const data = await response.json();
    return parseInt(data.result.timestamp, 16);
  };

  return {
    ...result,
    fetchBalance,
    reset,
  };
};
