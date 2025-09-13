import { useState, useCallback } from 'react';

interface BalanceResult {
  balance: string | null;
  loading: boolean;
  error: string | null;
}

interface FetchBalanceParams {
  walletAddress: string;
  contractAddress: string;
  decimals: number;
  timestamp: string;
  apiKey: string;
}

export const useWalletBalance = () => {
  const [result, setResult] = useState<BalanceResult>({
    balance: null,
    loading: false,
    error: null,
  });

  const fetchBalance = useCallback(async ({
    walletAddress,
    contractAddress,
    decimals,
    timestamp,
    apiKey,
  }: FetchBalanceParams) => {
    setResult({ balance: null, loading: true, error: null });

    try {
      // Convert date to end-of-day Unix timestamp
      const targetDate = new Date(timestamp + 'T23:59:59Z');
      const targetTimestamp = Math.floor(targetDate.getTime() / 1000);

      // Check if date is in the future
      const currentTimestamp = Math.floor(Date.now() / 1000);
      if (targetTimestamp > currentTimestamp) {
        throw new Error('Cannot check balance for future dates. Please select a date in the past.');
      }

      // Find the block number for this timestamp using binary search
      const blockNumber = await findBlockByTimestamp(apiKey, targetTimestamp);
      const blockNumHex = '0x' + blockNumber.toString(16);

      let response;

      // Check if this is native ETH (no contract address) or ERC-20 token
      if (!contractAddress || contractAddress === '') {
        // Native ETH balance
        response = await fetch(`https://eth-mainnet.g.alchemy.com/v2/${apiKey}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'eth_getBalance',
            params: [walletAddress, blockNumHex],
          }),
        });
      } else {
        // ERC-20 token balance
        response = await fetch(`https://eth-mainnet.g.alchemy.com/v2/${apiKey}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'eth_call',
            params: [
              {
                to: contractAddress,
                data: `0x70a08231000000000000000000000000${walletAddress.slice(2)}`
              },
              blockNumHex,
            ],
          }),
        });
      }

      const data = await response.json();

      if (data.error) {
        throw new Error(`Blockchain error: ${data.error.message}`);
      }

      // Parse and format the balance
      const rawBalance = data.result;
      const balance = (parseInt(rawBalance, 16) / Math.pow(10, decimals)).toFixed(6);

      setResult({ balance, loading: false, error: null });
    } catch (error: any) {
      setResult({
        balance: null,
        loading: false,
        error: error.message || 'Failed to fetch balance',
      });
    }
  }, []);

  // Find block number by timestamp using binary search with localStorage caching
  const findBlockByTimestamp = async (apiKey: string, targetTimestamp: number): Promise<number> => {
    const cacheKey = `eth-block-${targetTimestamp}`;
    
    // Check cache first
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      return parseInt(cached, 10);
    }
    
    // Cache miss - perform binary search
    const currentBlock = await getCurrentBlockNumber(apiKey);
    
    let low = 1;
    let high = currentBlock;
    let bestBlock = high;
    
    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      const blockTimestamp = await getBlockTimestamp(apiKey, mid);
      
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
  const getCurrentBlockNumber = async (apiKey: string): Promise<number> => {
    const response = await fetch(`https://eth-mainnet.g.alchemy.com/v2/${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_blockNumber',
        params: [],
      }),
    });
    const data = await response.json();
    return parseInt(data.result, 16);
  };

  // Helper function to get block timestamp
  const getBlockTimestamp = async (apiKey: string, blockNumber: number): Promise<number> => {
    const response = await fetch(`https://eth-mainnet.g.alchemy.com/v2/${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_getBlockByNumber',
        params: [`0x${blockNumber.toString(16)}`, false],
      }),
    });
    const data = await response.json();
    return parseInt(data.result.timestamp, 16);
  };

  return {
    ...result,
    fetchBalance,
  };
};