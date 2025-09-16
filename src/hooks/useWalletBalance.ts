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

        const targetDate = new Date(timestamp + "T00:00:00Z");
        if (isNaN(targetDate.getTime())) {
          throw new Error(`Invalid date: ${timestamp}`);
        }
        
        const targetTimestamp = Math.floor(targetDate.getTime() / 1000);
        const blockNumber = await findBlockByTimestamp(asset.blockchain, targetTimestamp);
        if (isNaN(blockNumber)) throw new Error(`Failed to find block for timestamp: ${timestamp}`);
        
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
              `0x${blockNumber.toString(16)}`,
            ],
          }),
        });

        const data = await response.json();
        if (data.error) throw new Error(`RPC error: ${data.error.message}`);

        const rawBalance = data.result;
        const balanceFormatted = ethers.formatUnits(rawBalance, asset.decimals ?? 18);
        const balance = parseFloat(balanceFormatted).toFixed(6);
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
    const cacheKey = `block-${blockchain}-${targetTimestamp}`;

    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      const parsed = parseInt(cached, 10);
      if (!isNaN(parsed)) return parsed;
    }

    const currentBlock = await getCurrentBlockNumber(blockchain);
    if (isNaN(currentBlock) || currentBlock <= 0) {
      throw new Error(`Invalid current block number for ${blockchain}`);
    }

    let low = 1;
    let high = currentBlock;
    let bestBlock = high;

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      const blockTimestamp = await getBlockTimestamp(blockchain, mid);

      if (isNaN(blockTimestamp)) {
        throw new Error(`Failed to get timestamp for block ${mid} on ${blockchain}`);
      }

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
    try {
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
      if (data.error) throw new Error(data.error.message);
      const result = parseInt(data.result, 16);
      if (isNaN(result)) throw new Error("Invalid block number response");
      return result;
    } catch (error: any) {
      throw new Error(`Failed to get current block number: ${error.message}`);
    }
  };

  // Helper function to get block timestamp
  const getBlockTimestamp = async (blockchain: EvmBlockchain, blockNumber: number): Promise<number> => {
    try {
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
      if (data.error) throw new Error(data.error.message);
      if (!data.result || !data.result.timestamp) throw new Error("Invalid block response");
      const result = parseInt(data.result.timestamp, 16);
      if (isNaN(result)) throw new Error("Invalid timestamp in block");
      return result;
    } catch (error: any) {
      throw new Error(`Failed to get block timestamp: ${error.message}`);
    }
  };

  return {
    ...result,
    fetchBalance,
    reset,
  };
};
