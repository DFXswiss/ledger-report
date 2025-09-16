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
      // Special handling for FPS token
      const isFPS = contractAddress.toLowerCase() === "0x1ba26788dfde592fec8bcb0eaff472a42be341b2" && blockchain === "Ethereum";

      if (isFPS) {
        const formattedDate = formatDate(date);
        const cacheKey = `price-fps-${formattedDate}`;
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          const cachedData = JSON.parse(cached);
          setResult({ prices: cachedData, loading: false, error: null });
          return cachedData;
        }

        // Fetch FPS price from Ponder
        const dateObj = new Date(date + "T00:00:00Z");
        const timestamp = Math.floor(dateObj.getTime() / 1000);

        const fpsQuery = `{
          equityTradeCharts(where: {timestamp_lte: "${timestamp}"}, orderBy: "timestamp", orderDirection: "desc", limit: 1) {
            items { timestamp lastPrice }
          }
        }`;

        const fpsResponse = await fetch("https://ponder.frankencoin.com", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: fpsQuery })
        });

        if (!fpsResponse.ok) throw new Error("Failed to fetch FPS price from Ponder");

        const fpsData = await fpsResponse.json();
        const fpsItems = fpsData?.data?.equityTradeCharts?.items;

        if (!fpsItems || fpsItems.length === 0) {
          throw new Error("No FPS price data available for this date");
        }

        // Price is in ZCHF with 18 decimals
        const fpsPriceInZchf = BigInt(fpsItems[0].lastPrice);

        // 1 ZCHF = 1 CHF
        const fpsPriceInChf = parseFloat(fpsPriceInZchf.toString()) / 1e18;

        // Fetch USD and EUR rates (approximate conversion from CHF)
        // You might want to use a proper forex API here
        const usdRate = 1.15; // Approximate CHF to USD
        const eurRate = 1.05; // Approximate CHF to EUR

        const priceData: PriceData = {
          chf: fpsPriceInChf,
          usd: fpsPriceInChf * usdRate,
          eur: fpsPriceInChf * eurRate,
        };

        // Cache the result
        localStorage.setItem(cacheKey, JSON.stringify(priceData));
        setResult({ prices: priceData, loading: false, error: null });
        return priceData;
      }

      // Original CoinGecko logic for other tokens
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
