import { useState, useCallback } from "react";
import type { EvmBlockchain } from "../types";

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
  blockchain: EvmBlockchain;
  date: string;
}

// Map blockchain names to CoinGecko platform IDs
const platformMap: Record<string, string> = {
  Ethereum: "ethereum",
  BinanceSmartChain: "binance-smart-chain",
  Polygon: "polygon-pos",
  Arbitrum: "arbitrum-one",
  Optimism: "optimistic-ethereum",
  Base: "base",
  Gnosis: "xdai",
};

export const useCurrencyPrice = () => {
  const [result, setResult] = useState<CurrencyPriceResult>({
    prices: null,
    loading: false,
    error: null,
  });

  const fetchPrice = useCallback(async ({ contractAddress, blockchain, date }: FetchPriceParams) => {
    setResult({ prices: null, loading: true, error: null });

    try {
      const platform = platformMap[blockchain];
      if (!platform) throw new Error(`[CoinGecko] Unsupported blockchain: ${blockchain}`);

      const formattedDate = formatDate(date);
      const cacheKey = `price-${contractAddress}-${formattedDate}`;
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const cachedData = JSON.parse(cached);
        setResult({ prices: cachedData, loading: false, error: null });
        return cachedData;
      }

      let priceData: PriceData;
      const url = `https://api.coingecko.com/api/v3/coins/${platform}/contract/${contractAddress.toLowerCase()}/history?date=${formattedDate}`;
      const response = await fetch(url);

      if (!response.ok) {
        const currentUrl = `https://api.coingecko.com/api/v3/simple/token_price/${platform}?contract_addresses=${contractAddress.toLowerCase()}&vs_currencies=usd,eur,chf`;
        const currentResponse = await fetch(currentUrl);
        if (!currentResponse.ok) throw new Error("Failed to fetch price data");

        const currentData = await currentResponse.json();
        const tokenData = currentData[contractAddress.toLowerCase()];
        if (!tokenData) throw new Error("Token price not found");

        priceData = {
          usd: tokenData.usd || 0,
          eur: tokenData.eur || 0,
          chf: tokenData.chf || 0,
        };
      } else {
        const data = await response.json();
        if (!data.market_data?.current_price) {
          throw new Error("Historical price data not available");
        }

        priceData = {
          usd: data.market_data.current_price.usd || 0,
          eur: data.market_data.current_price.eur || 0,
          chf: data.market_data.current_price.chf || 0,
        };
      }

      // Cache the result
      localStorage.setItem(cacheKey, JSON.stringify(priceData));
      setResult({ prices: priceData, loading: false, error: null });
      return priceData;
    } catch (error: any) {
      setResult({
        prices: null,
        loading: false,
        error: error.message || "Failed to fetch currency prices",
      });
      throw error;
    }
  }, []);

  // Convert date to "DD-MM-YYYY" format
  function formatDate(date: string): string {
    const dateObj = new Date(date + "T00:00:00Z");
    const day = dateObj.getDate().toString().padStart(2, "0");
    const month = (dateObj.getMonth() + 1).toString().padStart(2, "0");
    const year = dateObj.getFullYear();
    return `${day}-${month}-${year}`;
  }

  return {
    ...result,
    fetchPrice,
  };
};
