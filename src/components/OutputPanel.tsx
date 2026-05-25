import { useId } from "react";
import { LoadingSpinner } from "./LoadingSpinner";
import { formatSwissNumber } from "../utils/formatNumber";
import type { Currency } from "../types";

interface Props {
  tokenName: string;
  balance: string | null;
  prices: { usd: number; eur: number; chf: number } | null;
  currency: Currency;
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
  const hasPrices = prices !== null;
  // Only compute the fiat line when both the balance and the FX rate are
  // available. Showing "0.00 CHF" next to a real balance when the price
  // fetch failed would lie to the user — see the pricing-correctness rule:
  // refuse to render a stale/wrong number, even as a placeholder.
  const fiatValue =
    prices && hasBalance
      ? currency === "USD"
        ? prices.usd
        : currency === "EUR"
        ? prices.eur
        : prices.chf
      : null;
  const fiatFormatted =
    fiatValue !== null && balance !== null
      ? formatSwissNumber(parseFloat(balance) * fiatValue)
      : null;
  const canGeneratePdf = hasBalance && hasPrices;
  const headingId = useId();

  return (
    <section
      aria-labelledby={headingId}
      className="w-full rounded-2xl bg-brand-100 px-5 pb-5 pt-6"
    >
      <h2 id={headingId} className="px-2.5 text-xl font-semibold leading-7 text-black">
        Token Balance
      </h2>
      <div className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-3">
        <div className="flex min-w-0 flex-1 flex-col overflow-clip break-all rounded-lg px-2.5 py-1 text-brand-800">
          {hasBalance ? (
            <>
              <p className="text-3xl font-semibold leading-10">
                {balance} {tokenName || ""}
              </p>
              {fiatFormatted !== null ? (
                <p className="text-lg font-semibold leading-6 tracking-tight">
                  ≈ {fiatFormatted} {currency}
                </p>
              ) : (
                // Keep the second line's height when the price fetch failed
                // so the panel doesn't shrink and the buttons stay aligned.
                <p className="text-lg leading-6 tracking-tight">&nbsp;</p>
              )}
            </>
          ) : (
            // Preserve the same height as the resolved state (3xl line +
            // lg line) so the panel doesn't jump when results arrive.
            <>
              <p className="text-base font-medium leading-10 text-brand-800/70">
                Click Get balance to fetch the balance.
              </p>
              <p className="text-lg leading-6 tracking-tight">&nbsp;</p>
            </>
          )}
        </div>
        <div className="flex w-full shrink-0 flex-col gap-3 sm:w-[200px]">
          <button
            type="button"
            onClick={onSubmit}
            disabled={!canSubmit || isFetching}
            className={`flex items-center justify-center gap-1.5 overflow-clip rounded-md p-4 text-base font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 ${
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
            disabled={!canGeneratePdf || isFetching}
            className={`flex items-center justify-center overflow-clip rounded-md border-[1.5px] p-4 text-base font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 ${
              canGeneratePdf
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
