import "./App.css";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { InputField } from "./components/InputField";
import { Button } from "./components/Button";
import { DatePicker } from "./components/DatePicker";
import DropDownMenu from "./components/DropDownMenu";
import { useWalletBalance } from "./hooks/useWalletBalance";
import {
  EvmBlockchain,
  NonEvmBlockchain,
  isSupportedBlockchain,
  type Asset,
  type Blockchain,
  type SupportedAsset,
} from "./types";
import { useSearchParams } from "react-router-dom";
import { useCurrencyPrice } from "./hooks/useCurrencyPrice";
import { generateWalletBalancePDF } from "./utils/pdfGenerator";
import { formatSwissNumber } from "./utils/formatNumber";

type FormData = {
  date: string;
  network: Blockchain;
  asset: SupportedAsset;
  address: string;
  currency: string;
};

type AssetMap = Record<Blockchain, SupportedAsset[]>;

const SUPPORTED_NETWORKS: Blockchain[] = [
  ...Object.values(EvmBlockchain),
  ...Object.values(NonEvmBlockchain),
];

export default function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | undefined>();
  const [assetMap, setAssetMap] = useState<AssetMap | undefined>();

  const [urlParams] = useSearchParams();

  const { balance, loading: balanceLoading, error: balanceError, fetchBalance, reset } = useWalletBalance();
  const { prices, loading: priceLoading, error: priceError, fetchPrice } = useCurrencyPrice();

  const currencies = ["USD", "EUR", "CHF"];

  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
    trigger,
    setFocus,
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

  useEffect(() => {
    fetch("https://api.dfx.swiss/v1/asset")
      .then((response) => response.json())
      .then((data: Asset[]) => {
        const map = data
          .filter((asset): asset is SupportedAsset => isSupportedBlockchain(asset.blockchain))
          .reduce((acc, asset) => {
            const key = asset.blockchain as Blockchain;
            if (!acc[key]) acc[key] = [];
            acc[key].push(asset);
            return acc;
          }, {} as AssetMap);
        setAssetMap(map);

        // Set default asset for Ethereum if not already set
        if (map[EvmBlockchain.ETH] && map[EvmBlockchain.ETH].length > 0 && !watch("asset")) {
          setValue("asset", map[EvmBlockchain.ETH][0]);
        }
      })
      .catch((error) => {
        console.error("Error fetching assets:", error);
        setError("Failed to load available tokens");
      })
      .finally(() => setIsLoading(false));
  }, []);

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

  // Keep the selected asset in sync with the selected network.
  // Without this, switching networks via URL param or programmatically
  // would leave an asset from the previous network in the form.
  useEffect(() => {
    if (!assetMap || !selectedNetwork) return;
    if (selectedAsset && selectedAsset.blockchain === selectedNetwork) return;
    const first = assetMap[selectedNetwork]?.[0];
    if (first) setValue("asset", first);
  }, [assetMap, selectedNetwork, selectedAsset]);

  useEffect(() => {
    const tokenParam = urlParams.get("token");
    if (!tokenParam) return;

    const matchedAsset =
      selectedNetwork && assetMap && assetMap[selectedNetwork]?.find((asset) => asset.name === tokenParam);
    if (matchedAsset) {
      setValue("asset", matchedAsset);
    } else {
      setError(`Token "${tokenParam}" not found in network "${selectedNetwork}"`);
    }
  }, [urlParams, assetMap, selectedNetwork]);

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
    } catch (error: any) {
      setError(error.toString());
    }
  }

  const handleValidationAndFocus = async () => {
    const isValid = await trigger();
    if (!isValid) {
      if (errors.date) {
        setFocus("date");
      } else if (errors.network) {
        setFocus("network");
      } else if (errors.asset) {
        setFocus("asset");
      } else if (errors.address) {
        setFocus("address");
      }
    }

    await handleSubmit(onSubmit)();
  };

  const generatePDF = async () => {
    try {
      const formData = watch();
      await generateWalletBalancePDF({
        formData,
        balance,
        prices,
        selectedCurrency,
      });
    } catch (error) {
      console.error("PDF generation failed:", error);
      alert(`Failed to generate PDF: ${error}`);
    }
  };

  return (
    <div className="flex flex-col justify-start gap-8 p-2 pt-6 max-w-screen-sm">
      <div>
        <div className="text-4xl font-extrabold text-slate-900 dark:text-slate-200 tracking-tight">
          Check Wallet Token Balance
        </div>
        <p className="mt-4 text-lg text-slate-700 dark:text-slate-400 leading-snug">
          Select network, token, and enter address to check token balance on a specific date.
        </p>
      </div>
      {isLoading ? (
        <div>Loading...</div>
      ) : !assetMap ? (
        <div>No assets available</div>
      ) : (
        <form>
          <div className="flex flex-col gap-4">
            <DropDownMenu<Blockchain>
              label="Network"
              list={SUPPORTED_NETWORKS.filter((n) => assetMap[n]?.length)}
              itemLabel={(item) => item}
              value={selectedNetwork}
              onChange={(value) => {
                setValue("network", value);
                setValue("asset", assetMap?.[value]?.[0]);
              }}
            />
            <DropDownMenu<SupportedAsset>
              label="Token"
              list={selectedNetwork ? assetMap[selectedNetwork] ?? [] : []}
              itemLabel={(item) => item.name}
              value={selectedAsset}
              onChange={(value) => {
                setValue("asset", value);
              }}
              disabled={!selectedNetwork || (assetMap[selectedNetwork]?.length ?? 0) <= 1}
            />
            <InputField id="address" label="Address" register={register} errors={errors} />
            <DatePicker id="date" label="Date" register={register} errors={errors} />
            <DropDownMenu<string>
              label="Currency"
              list={currencies}
              itemLabel={(item) => item}
              value={selectedCurrency}
              onChange={(value: string) => {
                setValue("currency", value);
              }}
            />

            <Button
              label={balanceLoading || priceLoading ? "FETCHING DATA..." : "GET BALANCE"}
              onClick={handleValidationAndFocus}
              disabled={!!error || balanceLoading || priceLoading}
              isLoading={balanceLoading || priceLoading}
              isGrayedOut={!isValid}
            />

            {balance && !balanceLoading && !priceLoading && (
              <Button
                label="GENERATE PDF"
                onClick={generatePDF}
                disabled={false}
                isGrayedOut={!isValid}
              />
            )}

            {balance && !balanceLoading && !priceLoading && (
              <div className="mt-2 p-4 rounded-md border border-green-200 bg-green-200 text-green-800">
                <div className="font-semibold text-lg">
                  {balance} {selectedAsset.name}
                </div>
                {prices && (
                  <div className="mt-2">
                    {selectedCurrency === "USD" && `≈ ${formatSwissNumber(parseFloat(balance) * prices.usd)} USD`}
                    {selectedCurrency === "EUR" && `≈ ${formatSwissNumber(parseFloat(balance) * prices.eur)} EUR`}
                    {selectedCurrency === "CHF" && `≈ ${formatSwissNumber(parseFloat(balance) * prices.chf)} CHF`}
                  </div>
                )}
              </div>
            )}

            {(balanceError || priceError || error) && (
              <div className="mt-2 p-2 rounded-md font-medium bg-red-200 text-red-500">
                {balanceError || priceError || error}
              </div>
            )}

            <div className="mt-4 text-sm text-slate-500 dark:text-slate-400">
              This wallet balance checker allows you to check token balances at specific dates across multiple
              blockchain networks. You can pre-fill the form by passing parameters in the URL.
            </div>

            <div className="mt-4 text-sm text-slate-500 dark:text-slate-400">
              Example Usage:{" "}
              <a
                href="/?network=Ethereum&token=USDT&address=0xde0B295669a9FD93d5F28D9Ec85E40f4cb697BAe&date=2024-12-31"
                className="underline text-blue-500 hover:text-blue-600 break-all"
              >
                /?network=Ethereum&token=USDT&address=0xde0B...7BAe&date=2024-12-31
              </a>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
