import { useState, useCallback } from 'react';

interface PriceData {
  usd: number;
  eur: number;
  chf: number;
}

interface CurrencyPriceResult {
  prices: PriceData | null;
  loading: boolean;
  error: string | null;
}

interface FetchPriceParams {
  contractAddress: string;
  blockchain: string;
  date: string;
}

export const useCurrencyPrice = () => {
  const [result, setResult] = useState<CurrencyPriceResult>({
    prices: null,
    loading: false,
    error: null,
  });

  const fetchPrice = useCallback(async ({ contractAddress, blockchain, date }: FetchPriceParams) => {
    setResult({ prices: null, loading: true, error: null });

    try {
      // Map blockchain names to CoinGecko platform IDs
      const platformMap: Record<string, string> = {
        'Ethereum': 'ethereum',
        'BinanceSmartChain': 'binance-smart-chain',
        'Polygon': 'polygon-pos',
        'Arbitrum': 'arbitrum-one',
        'Optimism': 'optimistic-ethereum',
        'Base': 'base',
        'Gnosis': 'xdai',
      };

      const platform = platformMap[blockchain];
      if (!platform) {
        throw new Error(`Unsupported blockchain: ${blockchain}`);
      }

      // Format date for CoinGecko (dd-mm-yyyy)
      const dateObj = new Date(date + 'T00:00:00Z');
      const formattedDate = `${dateObj.getDate().toString().padStart(2, '0')}-${(dateObj.getMonth() + 1).toString().padStart(2, '0')}-${dateObj.getFullYear()}`;

      // Check cache first
      const cacheKey = `price-${contractAddress}-${formattedDate}`;
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const cachedData = JSON.parse(cached);
        setResult({ prices: cachedData, loading: false, error: null });
        return cachedData;
      }

      // Special handling for stablecoins - use fixed 1:1 USD rate
      const stablecoins = [
        '0xdac17f958d2ee523a2206206994597c13d831ec7', // USDT Ethereum
        '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', // USDC Ethereum
        '0x4fabb145d64652a948d72533023f6e7a623c7c53', // BUSD Ethereum
        '0x6b175474e89094c44da98b954eedeac495271d0f', // DAI Ethereum
      ];

      let priceData: PriceData;

      if (stablecoins.includes(contractAddress.toLowerCase())) {
        // For stablecoins, assume 1 USD and convert to other currencies
        // Use a simple exchange rate API or hardcoded rates as fallback
        priceData = {
          usd: 1,
          eur: 0.92, // Approximate rate, should be fetched from API
          chf: 0.88, // Approximate rate, should be fetched from API
        };
      } else {
        // Fetch from CoinGecko using contract address
        const url = `https://api.coingecko.com/api/v3/coins/${platform}/contract/${contractAddress.toLowerCase()}/history?date=${formattedDate}`;

        const response = await fetch(url);

        if (!response.ok) {
          // Try without historical data as fallback
          const currentUrl = `https://api.coingecko.com/api/v3/simple/token_price/${platform}?contract_addresses=${contractAddress.toLowerCase()}&vs_currencies=usd,eur,chf`;
          const currentResponse = await fetch(currentUrl);

          if (!currentResponse.ok) {
            throw new Error('Failed to fetch price data');
          }

          const currentData = await currentResponse.json();
          const tokenData = currentData[contractAddress.toLowerCase()];

          if (!tokenData) {
            throw new Error('Token price not found');
          }

          priceData = {
            usd: tokenData.usd || 0,
            eur: tokenData.eur || 0,
            chf: tokenData.chf || 0,
          };
        } else {
          const data = await response.json();

          if (!data.market_data?.current_price) {
            throw new Error('Historical price data not available');
          }

          priceData = {
            usd: data.market_data.current_price.usd || 0,
            eur: data.market_data.current_price.eur || 0,
            chf: data.market_data.current_price.chf || 0,
          };
        }
      }

      // Cache the result
      localStorage.setItem(cacheKey, JSON.stringify(priceData));

      setResult({ prices: priceData, loading: false, error: null });
      return priceData;
    } catch (error: any) {
      setResult({
        prices: null,
        loading: false,
        error: error.message || 'Failed to fetch currency prices',
      });
      throw error;
    }
  }, []);

  return {
    ...result,
    fetchPrice,
  };
};