import { useState, useCallback } from "react";
import { NonEvmBlockchain, isBtcBlockchain, type Blockchain } from "../types";

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
  contractAddress?: string;
  blockchain: Blockchain;
  date: string;
}

// Map blockchain names to CoinGecko platform IDs (EVM only — BTC handled separately)
const platformMap: Record<string, string> = {
  Ethereum: "ethereum",
  BinanceSmartChain: "binance-smart-chain",
  Polygon: "polygon-pos",
  Arbitrum: "arbitrum-one",
  Optimism: "optimistic-ethereum",
  Base: "base",
  Gnosis: "xdai",
};

// Map blockchain names to CoinGecko coin IDs for native-coin price lookups
const nativeCoinMap: Partial<Record<Blockchain, string>> = {
  [NonEvmBlockchain.BTC]: "bitcoin",
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
      const formattedDate = formatDate(date);

      // Native-coin path (e.g. BTC) — no contract, use /coins/{id}/history
      if (!contractAddress || isBtcBlockchain(blockchain)) {
        const coinId = nativeCoinMap[blockchain];
        if (!coinId) throw new Error(`[CoinGecko] No native coin id for blockchain: ${blockchain}`);

        const cacheKey = `price-coin-${coinId}-${formattedDate}`;
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          const cachedData = JSON.parse(cached);
          setResult({ prices: cachedData, loading: false, error: null });
          return cachedData;
        }

        const url = `https://api.coingecko.com/api/v3/coins/${coinId}/history?date=${formattedDate}`;
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Failed to fetch ${coinId} price for ${formattedDate}`);

        const data = await response.json();
        if (!data.market_data?.current_price) throw new Error("Historical price data not available");

        const priceData: PriceData = {
          usd: data.market_data.current_price.usd || 0,
          eur: data.market_data.current_price.eur || 0,
          chf: data.market_data.current_price.chf || 0,
        };

        localStorage.setItem(cacheKey, JSON.stringify(priceData));
        setResult({ prices: priceData, loading: false, error: null });
        return priceData;
      }

      // Special handling for FPS token (price() on smart contract, denominated in CHF)
      const isFPS = contractAddress.toLowerCase() === "0x1ba26788dfde592fec8bcb0eaff472a42be341b2" && blockchain === "Ethereum";

      if (isFPS) {
        const cacheKey = `price-fps-${formattedDate}`;
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          const cachedData = JSON.parse(cached);
          setResult({ prices: cachedData, loading: false, error: null });
          return cachedData;
        }

        const { ethers } = await import("ethers");
        const apiKey = import.meta.env.VITE_ALCHEMY_API_KEY || "YOUR_ALCHEMY_API_KEY";
        const provider = new ethers.JsonRpcProvider(`https://eth-mainnet.g.alchemy.com/v2/${apiKey}`);
        const abi = ["function price() public view returns (uint256)"];
        const fpsContract = new ethers.Contract(contractAddress, abi, provider);
        const priceRaw = await fpsContract.price();
        const fpsPriceInChf = parseFloat(ethers.formatUnits(priceRaw, 18));

        const forexResponse = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=usd,eur&vs_currencies=chf`);
        let usdRate = 1.10;
        let eurRate = 1.03;
        if (forexResponse.ok) {
          const forexData = await forexResponse.json();
          if (forexData.usd?.chf) usdRate = 1 / forexData.usd.chf;
          if (forexData.eur?.chf) eurRate = 1 / forexData.eur.chf;
        }

        const priceData: PriceData = {
          chf: fpsPriceInChf,
          usd: fpsPriceInChf * usdRate,
          eur: fpsPriceInChf * eurRate,
        };

        localStorage.setItem(cacheKey, JSON.stringify(priceData));
        setResult({ prices: priceData, loading: false, error: null });
        return priceData;
      }

      // CoinGecko ERC-20 / EVM-token path
      const platform = platformMap[blockchain];
      if (!platform) throw new Error(`[CoinGecko] Unsupported blockchain: ${blockchain}`);

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
