import { useState, useCallback } from "react";
import { NonEvmBlockchain, isBtcBlockchain, type Blockchain } from "../types";
import { getEstvBtcChf } from "../utils/estvTaxValues";
import { cacheKey } from "../utils/cacheKey";
import { blockchainLabel } from "../utils/blockchainLabel";

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

// Pull a fiat-priced field from a CoinGecko response shape and throw if the
// field is missing or non-numeric. We refuse to ship 0 as a placeholder —
// see the pricing-correctness rule: a stale or swapped value is worse than
// a clear error, so we surface the missing field to the user instead.
type PriceLookup = Record<string, number | null | undefined>;

function requirePrice(source: PriceLookup, key: "usd" | "eur" | "chf", subject: string): number {
  const value = source[key];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`[CoinGecko] Response for ${subject} missing ${key.toUpperCase()} price`);
  }
  return value;
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
      const formattedDate = formatDate(date);

      // Native-coin path (e.g. BTC) — no contract, use /coins/{id}/history
      if (!contractAddress || isBtcBlockchain(blockchain)) {
        const coinId = nativeCoinMap[blockchain];
        if (!coinId) throw new Error(`[CoinGecko] No native coin id for blockchain: ${blockchainLabel(blockchain)}`);

        const key = cacheKey(["price-coin", coinId, formattedDate]);
        const cached = localStorage.getItem(key);
        if (cached) {
          const cachedData: PriceData = JSON.parse(cached);
          if (isBtcBlockchain(blockchain)) {
            const estvChf = getEstvBtcChf(date);
            if (estvChf !== undefined) cachedData.chf = estvChf;
          }
          setResult({ prices: cachedData, loading: false, error: null });
          return cachedData;
        }

        const url = `https://api.coingecko.com/api/v3/coins/${coinId}/history?date=${formattedDate}`;
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Failed to fetch ${coinId} price for ${formattedDate}`);

        const data = await response.json();
        if (!data.market_data?.current_price) throw new Error("Historical price data not available");

        const priceData: PriceData = {
          usd: requirePrice(data.market_data.current_price, "usd", coinId),
          eur: requirePrice(data.market_data.current_price, "eur", coinId),
          chf: requirePrice(data.market_data.current_price, "chf", coinId),
        };

        // For BTC, override the CHF value with the official ESTV tax valuation
        // when one is available for the requested record date. The Swiss wealth
        // tax declaration uses ESTV's ICTax rate, not a market-aggregator price.
        if (isBtcBlockchain(blockchain)) {
          const estvChf = getEstvBtcChf(date);
          if (estvChf !== undefined) priceData.chf = estvChf;
        }

        localStorage.setItem(key, JSON.stringify(priceData));
        setResult({ prices: priceData, loading: false, error: null });
        return priceData;
      }

      // Special handling for FPS token (price() on smart contract, denominated in CHF)
      const isFPS = contractAddress.toLowerCase() === "0x1ba26788dfde592fec8bcb0eaff472a42be341b2" && blockchain === "Ethereum";

      if (isFPS) {
        const key = cacheKey(["price-fps", formattedDate]);
        const cached = localStorage.getItem(key);
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
        if (!forexResponse.ok) {
          throw new Error("[CoinGecko] Failed to fetch USD/EUR→CHF forex rates for FPS conversion");
        }
        const forexData = await forexResponse.json();
        if (forexData.usd?.chf == null) {
          throw new Error("[CoinGecko] FPS forex response missing usd→chf rate");
        }
        if (forexData.eur?.chf == null) {
          throw new Error("[CoinGecko] FPS forex response missing eur→chf rate");
        }
        const usdRate = 1 / forexData.usd.chf;
        const eurRate = 1 / forexData.eur.chf;

        const priceData: PriceData = {
          chf: fpsPriceInChf,
          usd: fpsPriceInChf * usdRate,
          eur: fpsPriceInChf * eurRate,
        };

        localStorage.setItem(key, JSON.stringify(priceData));
        setResult({ prices: priceData, loading: false, error: null });
        return priceData;
      }

      // CoinGecko ERC-20 / EVM-token path
      const platform = platformMap[blockchain];
      if (!platform) throw new Error(`[CoinGecko] Unsupported blockchain: ${blockchainLabel(blockchain)}`);

      const key = cacheKey(["price", contractAddress, formattedDate]);
      const cached = localStorage.getItem(key);
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
          usd: requirePrice(tokenData, "usd", contractAddress),
          eur: requirePrice(tokenData, "eur", contractAddress),
          chf: requirePrice(tokenData, "chf", contractAddress),
        };
      } else {
        const data = await response.json();
        if (!data.market_data?.current_price) {
          throw new Error("Historical price data not available");
        }

        priceData = {
          usd: requirePrice(data.market_data.current_price, "usd", contractAddress),
          eur: requirePrice(data.market_data.current_price, "eur", contractAddress),
          chf: requirePrice(data.market_data.current_price, "chf", contractAddress),
        };
      }

      localStorage.setItem(key, JSON.stringify(priceData));
      setResult({ prices: priceData, loading: false, error: null });
      return priceData;
    } catch (error: unknown) {
      setResult({
        prices: null,
        loading: false,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }, []);

  // Convert date to "DD-MM-YYYY" format. The input is a plain calendar day
  // (YYYY-MM-DD), so we read it as a UTC instant and use the UTC accessors —
  // otherwise west-of-UTC locales would read "2024-12-31T00:00:00Z" as
  // 2024-12-30 local and ask CoinGecko for the wrong day.
  function formatDate(date: string): string {
    const dateObj = new Date(date + "T00:00:00Z");
    const day = dateObj.getUTCDate().toString().padStart(2, "0");
    const month = (dateObj.getUTCMonth() + 1).toString().padStart(2, "0");
    const year = dateObj.getUTCFullYear();
    return `${day}-${month}-${year}`;
  }

  return {
    ...result,
    fetchPrice,
  };
};
