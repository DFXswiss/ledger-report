import { useEffect, useId, useState } from "react";
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
import { LoadingSpinner } from "./components/LoadingSpinner";

import { useWalletBalance } from "./hooks/useWalletBalance";
import { useCurrencyPrice } from "./hooks/useCurrencyPrice";
import { generateWalletBalancePDF } from "./utils/pdfGenerator";
import { blockchainLabel } from "./utils/blockchainLabel";

import {
  EvmBlockchain,
  NonEvmBlockchain,
  isSupportedBlockchain,
  type Asset,
  type Blockchain,
  type Currency,
  type SupportedAsset,
} from "./types";

type FormData = {
  date: string;
  network: Blockchain;
  asset: SupportedAsset;
  address: string;
  currency: Currency;
};

type AssetMap = Partial<Record<Blockchain, SupportedAsset[]>>;

// Bitcoin first so the default-selected pill (NonEvmBlockchain.BTC) lives in
// the top-left position of the segmented control rather than wrapping into a
// second row on desktop.
const SUPPORTED_NETWORKS: Blockchain[] = [
  ...Object.values(NonEvmBlockchain),
  ...Object.values(EvmBlockchain),
];

const CURRENCIES: FormData["currency"][] = ["CHF", "EUR", "USD"];

// Pick the native coin from a per-chain asset list. The DFX API tags native
// assets with type "Coin" (ETH on Ethereum, BTC on Bitcoin, etc.) — these are
// the tokens a first-time visitor expects to see selected. We refuse to fall
// back to an arbitrary first entry: if a supported chain ever ships without a
// native coin in the asset list it's a data bug we want to surface, not paper
// over with a silently-wrong default selection.
function pickNativeAsset(assets: SupportedAsset[]): SupportedAsset {
  const native = assets.find((a) => a.type === "Coin");
  if (!native) {
    const chain = assets[0]?.blockchain ?? "(empty list)";
    throw new Error(`No native coin found for chain ${chain}`);
  }
  return native;
}

// Order assets the way the DFX backend marks them as important: sortOrder
// ascending (1..9 are the curated mainstream tokens, 99 is the bulk), name
// alphabetical for ties. The raw API order otherwise puts DFI in front of
// ETH on Ethereum, which is surprising in a tax-report context.
function sortAssetsByDfxOrder(assets: SupportedAsset[]): SupportedAsset[] {
  return [...assets].sort((a, b) => {
    const sa = a.sortOrder ?? Number.MAX_SAFE_INTEGER;
    const sb = b.sortOrder ?? Number.MAX_SAFE_INTEGER;
    if (sa !== sb) return sa - sb;
    return a.name.localeCompare(b.name);
  });
}

export default function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | undefined>();
  const [assetMap, setAssetMap] = useState<AssetMap | undefined>();

  // Section-heading IDs let us bind each form control to its label via
  // aria-labelledby — keyboard and screen-reader users get a proper
  // association instead of a free-floating h2 sitting next to an unrelated
  // input.
  const blockchainHeadingId = useId();
  const tokenHeadingId = useId();
  const dateHeadingId = useId();
  const currencyHeadingId = useId();

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
      network: NonEvmBlockchain.BTC,
      // Default to 31 December of the previous year — the wealth-tax record
      // date in Switzerland, which is the primary use case for this tool.
      date: `${new Date().getFullYear() - 1}-12-31`,
    },
  });

  // Clear any previous balance + error whenever the form changes. watch()
  // returns a subscription, so we run it inside useEffect with a cleanup to
  // avoid leaking subscribers on every render.
  useEffect(() => {
    const subscription = watch(() => {
      setError(undefined);
      reset();
    });
    return () => subscription.unsubscribe();
  }, [watch, reset]);

  const selectedNetwork = watch("network");
  const selectedAsset = watch("asset");
  const selectedCurrency = watch("currency");

  // Load the supported asset list from the DFX backend and group by chain.
  useEffect(() => {
    fetch("https://api.dfx.swiss/v1/asset")
      .then((response) => response.json())
      .then((data: Asset[]) => {
        const map: AssetMap = data
          .filter((asset) => !asset.comingSoon)
          .filter((asset): asset is SupportedAsset => isSupportedBlockchain(asset.blockchain))
          .reduce((acc: AssetMap, asset) => {
            const key = asset.blockchain as Blockchain;
            if (!acc[key]) acc[key] = [];
            acc[key]!.push(asset);
            return acc;
          }, {});
        for (const key of Object.keys(map) as Blockchain[]) {
          map[key] = sortAssetsByDfxOrder(map[key]!);
        }
        setAssetMap(map);

        // Pick the default asset for the form's default network (Bitcoin).
        // pickNativeAsset() prefers the chain's native coin so first-time
        // visitors land on BTC rather than an arbitrary first list entry.
        const defaultNetworkAssets = map[NonEvmBlockchain.BTC];
        if (defaultNetworkAssets?.length && !watch("asset")) {
          setValue("asset", pickNativeAsset(defaultNetworkAssets));
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
  // onChange behaviour here. Skip this when a token URL param is present so
  // the token-param effect can write the final value without an intermediate
  // pickNativeAsset() flicker.
  useEffect(() => {
    if (!assetMap || !selectedNetwork) return;
    if (urlParams.has("token")) return;
    if (selectedAsset && selectedAsset.blockchain === selectedNetwork) return;
    const candidates = assetMap[selectedNetwork];
    if (!candidates?.length) return;
    try {
      setValue("asset", pickNativeAsset(candidates));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [assetMap, selectedNetwork, selectedAsset, urlParams]);

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
      setError(e instanceof Error ? e.message : `Failed to generate PDF: ${String(e)}`);
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
              Wallet Balance Reports for Tax and Audit
            </h1>
            <p className="mt-2 max-w-[660px] px-10 text-center text-base font-normal leading-5 text-neutral-700">
              Enter a wallet address, select token, and date to generate a downloadable balance
              report for tax filings, audits, and accounting.
            </p>
          </div>
        </header>

        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-neutral-700">
            <LoadingSpinner hidden={false} className="inline w-5 h-5 text-brand animate-spin" />
            <span>Loading…</span>
          </div>
        ) : !assetMap ? (
          // UX-display label resolution (not a silent data fallback): show
          // the real error message from the asset fetch when we have one,
          // otherwise the generic empty-state copy.
          <div className="py-12 text-neutral-700">{error ? error : "No assets available"}</div>
        ) : (
          <form
            className="w-full max-w-[660px] overflow-clip rounded-3xl bg-white"
            onSubmit={handleSubmit(onSubmit)}
          >
            <WalletAddressInput register={register} errors={errors} setValue={setValue} />

            <SectionRow title="Blockchain" variant="first" headingId={blockchainHeadingId}>
              <SegmentedControl<Blockchain>
                options={availableNetworks.map((n) => ({ value: n, label: blockchainLabel(n) }))}
                value={selectedNetwork}
                onChange={(value) => setValue("network", value)}
                ariaLabelledBy={blockchainHeadingId}
              />
            </SectionRow>

            <SectionRow title="Token" headingId={tokenHeadingId}>
              <TokenSelect
                options={selectedNetwork ? assetMap[selectedNetwork] ?? [] : []}
                value={selectedAsset}
                onChange={(value) => setValue("asset", value)}
                disabled={!selectedNetwork || (assetMap[selectedNetwork]?.length ?? 0) <= 1}
                ariaLabelledBy={tokenHeadingId}
              />
            </SectionRow>

            <SectionRow title="Balance Date" headingId={dateHeadingId}>
              <DateInput register={register} errors={errors} ariaLabelledBy={dateHeadingId} />
            </SectionRow>

            <SectionRow title="Currency" variant="last" headingId={currencyHeadingId}>
              <SegmentedControl<FormData["currency"]>
                options={CURRENCIES.map((c) => ({ value: c, label: c }))}
                value={selectedCurrency}
                onChange={(value) => setValue("currency", value)}
                layout="equal"
                ariaLabelledBy={currencyHeadingId}
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

        <p className="px-4 pb-8 text-center text-sm text-neutral-700">
          Example:{" "}
          <a
            href="/?network=Ethereum&token=USDT&address=0xde0B295669a9FD93d5F28D9Ec85E40f4cb697BAe&date=2024-12-31"
            className="break-all rounded-sm text-brand-800 underline underline-offset-2 decoration-brand-800/50 hover:decoration-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
          >
            /?network=Ethereum&amp;token=USDT&amp;address=0xde0B…&amp;date=2024-12-31
          </a>
        </p>
      </main>
      <Footer />
    </div>
  );
}
