import "./App.css";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useSearchParams } from "react-router-dom";
import { InputField } from "./components/InputField";
import { Button } from "./components/Button";
import { DatePicker } from "./components/DatePicker";
import DropDownMenu from "./components/DropDownMenu";
import { useWalletBalance } from "./hooks/useWalletBalance";

const EVM_NETWORKS = [
  "Ethereum",
  "BinanceSmartChain", 
  "Optimism",
  "Arbitrum",
  "Polygon", 
  "Base",
  "Haqq",
  "Gnosis"
];

interface Asset {
  id: number;
  name: string;
  blockchain: string;
  chainId?: string;
  decimals?: number;
}

type FormData = {
  date: string;
  network: string;
  token: string;
  address: string;
};

type AssetMap = Record<string, Asset[]>;

export default function App() {
  const [assetMap, setAssetMap] = useState<AssetMap>({});
  const [selectedNetwork, setSelectedNetwork] = useState<string>("");
  const [selectedToken, setSelectedToken] = useState<string>("");

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const { balance, loading: balanceLoading, error: balanceError, fetchBalance } = useWalletBalance();

  const [urlParams, setUrlParams] = useSearchParams();

  useEffect(() => {
    setUrlParams(new URLSearchParams());
  }, []);

  // Initialize dropdown values from URL params
  useEffect(() => {
    const networkParam = urlParams.get("network");
    const tokenParam = urlParams.get("token");
    if (networkParam) {
      setSelectedNetwork(networkParam);
    }
    if (tokenParam) {
      setSelectedToken(tokenParam);
    }
  }, [urlParams]);

  useEffect(() => {
    fetch("https://api.dfx.swiss/v1/asset")
      .then((response) => response.json())
      .then((data: Asset[]) => {
        const map: AssetMap = {};
        data.forEach((asset) => {
          if (!EVM_NETWORKS.includes(asset.blockchain)) return;
          if (!map[asset.blockchain]) map[asset.blockchain] = [];
          map[asset.blockchain].push(asset);
        });
        setAssetMap(map);
      })
      .catch((error) => {
        console.error("Error fetching assets:", error);
        setError("Failed to load available tokens");
      });
  }, []);

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
      date: urlParams.get("date") || "",
      network: urlParams.get("network") || "",
      token: urlParams.get("token") || "",
      address: urlParams.get("address") || "",
    },
  });

  watch(() => {
    setError(undefined);
  });

  async function onSubmit(data: FormData) {
    setError(undefined);

    const { date, address, network, token } = data;

    // Find the selected token in the asset map
    const selectedAsset = assetMap[network]?.find((asset) => asset.name === token);

    if (!selectedAsset) {
      setError(
        `Selected token "${token}" not found in network "${network}". Available tokens: ${
          assetMap[network]?.map((a) => a.name).join(", ") || "none"
        }`
      );
      return;
    }

    const apiKey = import.meta.env.VITE_ALCHEMY_API_KEY || "YOUR_ALCHEMY_API_KEY";

    try {
      await fetchBalance({
        walletAddress: address,
        contractAddress: selectedAsset.chainId || "",
        decimals: selectedAsset.decimals || 18,
        timestamp: date,
        apiKey,
      });
    } catch (error: any) {
      setError(error.toString());
    }
  }

  const handleValidationAndFocus = async () => {
    setIsLoading(true);
    const isValid = await trigger();
    if (!isValid) {
      if (errors.date) {
        setFocus("date");
      } else if (errors.network) {
        setFocus("network");
      } else if (errors.token) {
        setFocus("token");
      } else if (errors.address) {
        setFocus("address");
      }
    }

    await handleSubmit(onSubmit)();
    setIsLoading(false);
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
      <form>
        <div className="flex flex-col gap-4">
          <DropDownMenu
            list={Object.keys(assetMap)}
            label="Network"
            value={selectedNetwork}
            onChange={(value: string) => {
              setSelectedNetwork(value);
              setSelectedToken(""); // Reset token when network changes
              setValue("network", value);
              setValue("token", ""); // Reset token in form too
            }}
          />
          <DropDownMenu
            list={selectedNetwork ? assetMap[selectedNetwork]?.map((asset) => asset.name) || [] : []}
            label="Token"
            value={selectedToken}
            onChange={(value: string) => {
              setSelectedToken(value);
              setValue("token", value);
            }}
            disabled={!selectedNetwork}
          />
          <InputField id="address" label="Address" register={register} errors={errors} />
          <DatePicker id="date" label="Date" register={register} errors={errors} />

          {error && <div className="bg-red-200 text-red-500 p-2 rounded-md">{error}</div>}

          <Button
            label={isLoading || balanceLoading ? "FETCHING BALANCE..." : "GET BALANCE"}
            onClick={handleValidationAndFocus}
            disabled={isLoading || balanceLoading}
            isLoading={isLoading || balanceLoading}
            isGrayedOut={!isValid}
          />

          {balance && (
            <div className="mt-2 p-2 rounded-md font-medium bg-green-200 text-green-800">Balance: {balance} USDT</div>
          )}

          {balanceError && (
            <div className="mt-2 p-2 rounded-md font-medium bg-red-200 text-red-500">{balanceError}</div>
          )}

          <div className="mt-4 text-sm text-slate-500 dark:text-slate-400">
            This wallet balance checker allows you to check token balances at specific dates across multiple blockchain
            networks. You can pre-fill the form by passing parameters in the URL.
          </div>

          <div className="mt-4 text-sm text-slate-500 dark:text-slate-400">
            Example Usage:{" "}
            <a
              href="/?date=2024-01-15&network=Ethereum&token=USDT&address=0x742d35Cc6635C0532925a3b8D421d4c38f8e4B43"
              className="underline text-blue-500 hover:text-blue-600 break-all"
            >
              /?date=2024-01-15&network=Ethereum&token=USDT&address=0x742d35...4B43
            </a>
          </div>
        </div>
      </form>
    </div>
  );
}
