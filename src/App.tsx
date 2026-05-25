import "./App.css";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useSearchParams } from "react-router-dom";

import { Logo } from "./components/Logo";
import { Footer } from "./components/Footer";
import { SegmentedControl } from "./components/SegmentedControl";
import { SectionRow } from "./components/SectionRow";
import { WalletAddressInput } from "./components/WalletAddressInput";
import { TokenSelect } from "./components/TokenSelect";
import { DateInput } from "./components/DateInput";
import { OutputPanel } from "./components/OutputPanel";

import { useWalletBalance } from "./hooks/useWalletBalance";
import { useCurrencyPrice } from "./hooks/useCurrencyPrice";
import { generateWalletBalancePDF } from "./utils/pdfGenerator";

import {
  EvmBlockchain,
  NonEvmBlockchain,
  isSupportedBlockchain,
  type Asset,
  type Blockchain,
  type SupportedAsset,
} from "./types";

type FormData = {
  date: string;
  network: Blockchain;
  asset: SupportedAsset;
  address: string;
  currency: "CHF" | "EUR" | "USD";
};

type AssetMap = Partial<Record<Blockchain, SupportedAsset[]>>;

const SUPPORTED_NETWORKS: Blockchain[] = [
  ...Object.values(EvmBlockchain),
  ...Object.values(NonEvmBlockchain),
];

const CURRENCIES: FormData["currency"][] = ["CHF", "EUR", "USD"];

export default function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | undefined>();
  const [assetMap, setAssetMap] = useState<AssetMap | undefined>();

  const [urlParams] = useSearchParams();

  const { balance, loading: balanceLoading, error: balanceError, fetchBalance, reset } = useWalletBalance();
  const { prices, loading: priceLoading, error: priceError, fetchPrice } = useCurrencyPrice();

  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
    watch,
    setValue,
  } = useForm<FormData>({
    mode: "onChange",
    defaultValues: {
      currency: "CHF",
      network: EvmBlockchain.ETH,
      date: "2024-12-31",
    },
  });

  watch(() => {
    setError(undefined);
    reset();
  });

  const selectedNetwork = watch("network");
  const selectedAsset = watch("asset");
  const selectedCurrency = watch("currency");

  // Load the supported asset list from the DFX backend and group by chain.
  useEffect(() => {
    fetch("https://api.dfx.swiss/v1/asset")
      .then((response) => response.json())
      .then((data: Asset[]) => {
        const map: AssetMap = data
          .filter((asset): asset is SupportedAsset => isSupportedBlockchain(asset.blockchain))
          .reduce((acc: AssetMap, asset) => {
            const key = asset.blockchain as Blockchain;
            if (!acc[key]) acc[key] = [];
            acc[key]!.push(asset);
            return acc;
          }, {});
        setAssetMap(map);

        if (map[EvmBlockchain.ETH]?.length && !watch("asset")) {
          setValue("asset", map[EvmBlockchain.ETH]![0]);
        }
      })
      .catch((err) => {
        console.error("Error fetching assets:", err);
        setError("Failed to load available tokens");
      })
      .finally(() => setIsLoading(false));
  }, []);

  // Prefill from URL search params.
  useEffect(() => {
    const addressParam = urlParams.get("address");
    const dateParam = urlParams.get("date");
    if (addressParam) setValue("address", addressParam);
    if (dateParam) setValue("date", dateParam);
  }, [urlParams]);

  useEffect(() => {
    const networkParam = urlParams.get("network");
    if (!networkParam) return;

    if (isSupportedBlockchain(networkParam)) {
      setValue("network", networkParam);
    } else {
      setError(`Unsupported network in URL parameter: ${networkParam}`);
    }
  }, [urlParams]);

  useEffect(() => {
    const tokenParam = urlParams.get("token");
    if (!tokenParam) return;

    const matchedAsset =
      selectedNetwork && assetMap && assetMap[selectedNetwork]?.find((asset) => asset.name === tokenParam);
    if (matchedAsset) {
      setValue("asset", matchedAsset);
    } else if (assetMap) {
      setError(`Token "${tokenParam}" not found in network "${selectedNetwork}"`);
    }
  }, [urlParams, assetMap, selectedNetwork]);

  // Keep the selected asset in sync with the selected network — the URL-param
  // effect above only writes `network`, so we have to mirror the dropdown's
  // onChange behaviour here.
  useEffect(() => {
    if (!assetMap || !selectedNetwork) return;
    if (selectedAsset && selectedAsset.blockchain === selectedNetwork) return;
    const first = assetMap[selectedNetwork]?.[0];
    if (first) setValue("asset", first);
  }, [assetMap, selectedNetwork, selectedAsset]);

  async function onSubmit(data: FormData) {
    setError(undefined);
    const { date, address, network, asset } = data;

    try {
      await fetchBalance({
        asset,
        walletAddress: address,
        timestamp: date,
      });

      await fetchPrice({
        contractAddress: asset.chainId,
        blockchain: network,
        date,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  const generatePDF = async () => {
    try {
      const formData = watch();
      await generateWalletBalancePDF({
        formData,
        balance,
        prices,
        selectedCurrency,
      });
    } catch (e) {
      console.error("PDF generation failed:", e);
      alert(`Failed to generate PDF: ${e}`);
    }
  };

  const availableNetworks = assetMap
    ? SUPPORTED_NETWORKS.filter((n) => assetMap[n]?.length)
    : [];

  const isFetching = balanceLoading || priceLoading;
  const visibleError = balanceError || priceError || error || undefined;

  return (
    <div className="flex min-h-screen flex-col bg-neutral-150">
      <main className="mx-auto flex w-full max-w-[904px] flex-1 flex-col items-center gap-10 px-4 pt-16">
        <header className="flex w-full flex-col items-center gap-5">
          <Logo />
          <div className="flex flex-col items-center gap-0">
            <h1 className="text-center text-[26px] font-bold leading-7 tracking-tight text-neutral-700">
              Generate Tax-Ready Wallet Balance Reports by Date
            </h1>
            <p className="mt-2 max-w-[660px] px-10 text-center text-base font-normal leading-5 text-neutral-700">
              Enter a wallet address, select token, and date to generate a downloadable balance
              report for tax and accounting purposes.
            </p>
          </div>
        </header>

        {isLoading ? (
          <div className="py-12 text-neutral-500">Loading…</div>
        ) : !assetMap ? (
          <div className="py-12 text-neutral-500">No assets available</div>
        ) : (
          <form
            className="w-full max-w-[660px] overflow-clip rounded-3xl bg-white"
            onSubmit={handleSubmit(onSubmit)}
          >
            <WalletAddressInput register={register} errors={errors} setValue={setValue} />

            <SectionRow title="Blockchain:" variant="first">
              <SegmentedControl<Blockchain>
                options={availableNetworks.map((n) => ({ value: n, label: n }))}
                value={selectedNetwork}
                onChange={(value) => setValue("network", value)}
                ariaLabel="Blockchain"
              />
            </SectionRow>

            <SectionRow title="Token">
              <TokenSelect
                options={selectedNetwork ? assetMap[selectedNetwork] ?? [] : []}
                value={selectedAsset}
                onChange={(value) => setValue("asset", value)}
                disabled={!selectedNetwork || (assetMap[selectedNetwork]?.length ?? 0) <= 1}
              />
            </SectionRow>

            <SectionRow title="Balance Date">
              <DateInput register={register} errors={errors} />
            </SectionRow>

            <SectionRow title="Currency" variant="last">
              <SegmentedControl<FormData["currency"]>
                options={CURRENCIES.map((c) => ({ value: c, label: c }))}
                value={selectedCurrency}
                onChange={(value) => setValue("currency", value)}
                layout="equal"
                ariaLabel="Currency"
              />
            </SectionRow>

            <div className="px-5 pb-5">
              <OutputPanel
                tokenName={selectedAsset?.name ?? ""}
                balance={balance}
                prices={prices}
                currency={selectedCurrency}
                isFetching={isFetching}
                canSubmit={isValid && !visibleError}
                onSubmit={handleSubmit(onSubmit)}
                onGeneratePdf={generatePDF}
                errorMessage={visibleError}
              />
            </div>
          </form>
        )}

        <p className="px-4 pb-8 text-center text-sm text-neutral-500">
          Example:{" "}
          <a
            href="/?network=Ethereum&token=USDT&address=0xde0B295669a9FD93d5F28D9Ec85E40f4cb697BAe&date=2024-12-31"
            className="break-all text-brand hover:underline"
          >
            /?network=Ethereum&amp;token=USDT&amp;address=0xde0B…&amp;date=2024-12-31
          </a>
        </p>
      </main>
      <Footer />
    </div>
  );
}
