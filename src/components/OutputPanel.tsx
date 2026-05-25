import { LoadingSpinner } from "./LoadingSpinner";
import { formatSwissNumber } from "../utils/formatNumber";

interface Props {
  tokenName: string;
  balance: string | null;
  prices: { usd: number; eur: number; chf: number } | null;
  currency: "USD" | "EUR" | "CHF" | string;
  isFetching: boolean;
  canSubmit: boolean;
  onSubmit: () => void;
  onGeneratePdf: () => void;
  errorMessage?: string;
}

export function OutputPanel({
  tokenName,
  balance,
  prices,
  currency,
  isFetching,
  canSubmit,
  onSubmit,
  onGeneratePdf,
  errorMessage,
}: Props) {
  const hasBalance = balance !== null;
  const fiatValue =
    prices && hasBalance
      ? currency === "USD"
        ? prices.usd
        : currency === "EUR"
        ? prices.eur
        : prices.chf
      : 0;
  const fiatFormatted = formatSwissNumber(parseFloat(balance ?? "0") * fiatValue);

  return (
    <section className="w-full rounded-2xl bg-brand-100 px-5 pb-5 pt-6">
      <h2 className="px-2.5 text-xl font-semibold leading-7 text-black">Token Balance</h2>
      <div className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-3">
        <div
          className={`flex min-w-0 flex-1 flex-col overflow-clip break-all rounded-lg px-2.5 py-1 text-brand-800 ${
            hasBalance ? "" : "opacity-30"
          }`}
        >
          <p className="text-3xl font-semibold leading-10">
            {hasBalance ? balance : "0.0"} {tokenName || ""}
          </p>
          <p className="text-lg font-semibold leading-6 tracking-tight">
            ≈ {hasBalance ? fiatFormatted : "0.0"} {currency}
          </p>
        </div>
        <div className="flex w-full shrink-0 flex-col gap-3 sm:w-[200px]">
          <button
            type="button"
            onClick={onSubmit}
            disabled={!canSubmit || isFetching}
            className={`flex items-center justify-center gap-1.5 overflow-clip rounded-md p-4 text-base font-semibold text-white ${
              canSubmit && !isFetching
                ? "bg-brand cursor-pointer hover:opacity-90"
                : "bg-brand/60 cursor-not-allowed"
            }`}
          >
            {isFetching ? <LoadingSpinner hidden={false} /> : null}
            {isFetching ? "Fetching…" : "Get balance"}
          </button>
          <button
            type="button"
            onClick={onGeneratePdf}
            disabled={!hasBalance || isFetching}
            className={`flex items-center justify-center overflow-clip rounded-md border-[1.5px] p-4 text-base font-semibold ${
              hasBalance
                ? "border-brand text-brand cursor-pointer hover:bg-brand-100"
                : "border-neutral-300 text-neutral-300 cursor-not-allowed"
            }`}
          >
            Generate PDF
          </button>
        </div>
      </div>
      {errorMessage && (
        <p className="mt-3 rounded-md bg-red-200 px-3 py-2 text-sm font-medium text-red-700">
          {errorMessage}
        </p>
      )}
    </section>
  );
}
