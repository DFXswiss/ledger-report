import { useEffect, useId, useRef, useState } from "react";
import type { UseFormRegister, FieldErrors } from "react-hook-form";

interface Props {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  register: UseFormRegister<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  errors: FieldErrors<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setValue: (name: any, value: string) => void;
}

// Detect macOS so we can suggest the right keyboard shortcut when the
// Clipboard API is blocked. The fall-through is "Ctrl + V" which covers
// Windows, Linux, and ChromeOS.
function pasteShortcutHint(): string {
  if (typeof navigator === "undefined") return "Ctrl + V";
  const platform = navigator.platform || "";
  const userAgent = navigator.userAgent || "";
  const isMac = /Mac|iPhone|iPad|iPod/i.test(platform) || /Mac OS X/.test(userAgent);
  return isMac ? "⌘V" : "Ctrl + V";
}

export function WalletAddressInput({ register, errors, setValue }: Props) {
  const headingId = useId();
  const [pasteFailed, setPasteFailed] = useState(false);
  const pasteFailedTimer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (pasteFailedTimer.current !== null) {
        window.clearTimeout(pasteFailedTimer.current);
      }
    };
  }, []);

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) setValue("address", text.trim());
    } catch {
      // Clipboard read can be blocked by browser permission (Safari, Firefox
      // without user gesture, locked-down enterprise policy). Surface a brief
      // inline hint so the user knows they can still paste manually with the
      // keyboard shortcut — the auto-clearing timer keeps it from sticking
      // around once the user has read it.
      setPasteFailed(true);
      if (pasteFailedTimer.current !== null) {
        window.clearTimeout(pasteFailedTimer.current);
      }
      pasteFailedTimer.current = window.setTimeout(() => {
        setPasteFailed(false);
        pasteFailedTimer.current = null;
      }, 4000);
    }
  };

  const hasError = Boolean(errors.address);

  return (
    <section className="w-full rounded-3xl bg-brand p-5" aria-labelledby={headingId}>
      <h2
        id={headingId}
        className="px-2.5 text-lg font-semibold leading-6 tracking-tight text-white"
      >
        Wallet Address
      </h2>
      <div
        className={`mt-1.5 flex h-11 items-center rounded-xl bg-white pl-3 pr-1.5 focus-within:ring-2 focus-within:ring-white focus-within:ring-offset-2 focus-within:ring-offset-brand ${
          hasError ? "outline outline-2 outline-red-500" : ""
        }`}
      >
        <input
          type="text"
          autoComplete="off"
          placeholder="Enter address"
          aria-labelledby={headingId}
          {...register("address", { required: "Wallet address is required" })}
          className="flex-1 bg-transparent text-base font-normal text-neutral-900 placeholder:text-neutral-400 focus:outline-none"
        />
        <button
          type="button"
          onClick={handlePaste}
          className="ml-2 cursor-pointer rounded-lg bg-brand px-4 py-1.5 text-xs font-semibold text-white hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-brand"
        >
          Paste
        </button>
      </div>
      {hasError && (
        <p className="mt-2 px-2.5 text-xs font-medium text-white">
          {(errors.address?.message as string) || "Wallet address is required"}
        </p>
      )}
      {pasteFailed && !hasError && (
        <p
          role="status"
          aria-live="polite"
          className="mt-2 px-2.5 text-xs font-medium text-white"
        >
          Clipboard blocked — use {pasteShortcutHint()} to paste manually.
        </p>
      )}
    </section>
  );
}
