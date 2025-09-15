import "./App.css";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useSearchParams } from "react-router-dom";
import { InputField } from "./components/InputField";
import { Button } from "./components/Button";
import { DatePicker } from "./components/DatePicker";
import DropDownMenu from "./components/DropDownMenu";
import { useWalletBalance } from "./hooks/useWalletBalance";
import { useCurrencyPrice } from "./hooks/useCurrencyPrice";
import jsPDF from "jspdf";

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
  currency: string;
};

type AssetMap = Record<string, Asset[]>;

export default function App() {
  const [assetMap, setAssetMap] = useState<AssetMap>({});
  const [selectedNetwork, setSelectedNetwork] = useState<string>("");
  const [selectedToken, setSelectedToken] = useState<string>("");
  const [selectedCurrency, setSelectedCurrency] = useState<string>("USD");

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const { balance, loading: balanceLoading, error: balanceError, fetchBalance } = useWalletBalance();
  const { prices, loading: priceLoading, error: priceError, fetchPrice } = useCurrencyPrice();

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
      date: urlParams.get("date") || "",
      network: urlParams.get("network") || "",
      token: urlParams.get("token") || "",
      address: urlParams.get("address") || "",
      currency: urlParams.get("currency") || "USD",
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
      // Fetch balance
      await fetchBalance({
        walletAddress: address,
        contractAddress: selectedAsset.chainId || "",
        decimals: selectedAsset.decimals || 18,
        timestamp: date,
        apiKey,
      });

      // Fetch price if contract address exists
      if (selectedAsset.chainId) {
        await fetchPrice({
          contractAddress: selectedAsset.chainId,
          blockchain: network,
          date: date,
        });
      }
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

  const generatePDF = async () => {
    try {
      const formData = watch();
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();

      // Try to load and add logo
      try {
        const logoResponse = await fetch('/ledger-logo.jpg');
        const logoBlob = await logoResponse.blob();
        const logoBase64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(logoBlob);
        });

        // Add logo at the top right corner - keeping aspect ratio 1:1 for square logo
        const logoWidth = 40;
        const logoHeight = 40;
        const logoX = pageWidth - logoWidth - 10; // 10mm margin from right edge
        doc.addImage(logoBase64, 'JPEG', logoX, 10, logoWidth, logoHeight);

        // Add title at the top left
        doc.setFontSize(20);
        doc.text("Wallet Balance Report", 20, 25);
      } catch (logoError) {
        console.log('Logo failed, continuing without:', logoError);
        // If logo fails, just add title
        doc.setFontSize(20);
        doc.text("Wallet Balance Report", 20, 20);
      }

      // Add report details
      doc.setFontSize(12);
      doc.text(`Date: ${formData.date || 'Not specified'}`, 20, 45);
      doc.text(`Network: ${formData.network || 'Not specified'}`, 20, 55);
      doc.text(`Token: ${formData.token || 'Not specified'}`, 20, 65);
      doc.text(`Address: ${formData.address || 'Not specified'}`, 20, 75);

      // Add balance if available
      if (balance) {
        doc.setFontSize(14);
        doc.setFont(undefined, 'bold');
        doc.text(`Balance: ${balance} ${selectedToken || 'tokens'}`, 20, 95);
        doc.setFont(undefined, 'normal');

        // Add currency value if prices are available
        if (prices) {
          doc.setFontSize(12);
          const currencyValue = selectedCurrency === 'USD'
            ? `≈ $${(parseFloat(balance) * prices.usd).toFixed(2)} USD`
            : selectedCurrency === 'EUR'
            ? `≈ €${(parseFloat(balance) * prices.eur).toFixed(2)} EUR`
            : `≈ CHF ${(parseFloat(balance) * prices.chf).toFixed(2)}`;
          doc.text(currencyValue, 20, 105);
        }
      } else {
        doc.setFontSize(12);
        doc.text(`Balance: Not yet fetched`, 20, 95);
      }

      // Add timestamp
      doc.setFontSize(10);
      doc.setTextColor(128, 128, 128);
      doc.text(`Generated on: ${new Date().toLocaleString()}`, 20, prices && balance ? 120 : 115);

      // Add footer
      doc.setFontSize(8);
      doc.text('LedgerReport.com - Historical Wallet Balance Checker', pageWidth / 2, 280, { align: 'center' });

      // Save the PDF
      doc.save(`wallet-balance-${formData.date || 'report'}.pdf`);
    } catch (error) {
      console.error('PDF generation failed:', error);
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
          <DropDownMenu
            list={currencies}
            label="Currency"
            value={selectedCurrency}
            onChange={(value: string) => {
              setSelectedCurrency(value);
              setValue("currency", value);
            }}
          />

          {error && <div className="bg-red-200 text-red-500 p-2 rounded-md">{error}</div>}

          <Button
            label={isLoading || balanceLoading || priceLoading ? "FETCHING DATA..." : "GET BALANCE"}
            onClick={handleValidationAndFocus}
            disabled={isLoading || balanceLoading || priceLoading}
            isLoading={isLoading || balanceLoading || priceLoading}
            isGrayedOut={!isValid}
          />

          <Button
            label="GENERATE PDF"
            onClick={() => generatePDF()}
            disabled={false}
            isLoading={false}
            isGrayedOut={!isValid}
          />

          {balance && (
            <div className="mt-2 p-4 rounded-md bg-green-50 border border-green-200">
              <div className="font-semibold text-green-900 text-lg">
                {balance} {selectedToken}
              </div>
              {prices && (
                <div className="mt-2 text-green-700">
                  {selectedCurrency === "USD" && `≈ $${(parseFloat(balance) * prices.usd).toFixed(2)} USD`}
                  {selectedCurrency === "EUR" && `≈ €${(parseFloat(balance) * prices.eur).toFixed(2)} EUR`}
                  {selectedCurrency === "CHF" && `≈ CHF ${(parseFloat(balance) * prices.chf).toFixed(2)}`}
                </div>
              )}
            </div>
          )}

          {(balanceError || priceError) && (
            <div className="mt-2 p-2 rounded-md font-medium bg-red-200 text-red-500">
              {balanceError || priceError}
            </div>
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
