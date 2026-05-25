import { useEffect, useRef, useState } from "react";
import type { SupportedAsset } from "../types";

interface Props {
  options: SupportedAsset[];
  value: SupportedAsset | undefined;
  onChange: (value: SupportedAsset) => void;
  disabled?: boolean;
}

// Maps the asset name returned by the DFX API to a local SVG icon. Unknown
// tokens fall back to a generic coin glyph so the layout stays stable.
const TOKEN_ICON: Record<string, string> = {
  ETH: "/assets/icon-eth.svg",
};

function tokenIcon(name: string): string | undefined {
  return TOKEN_ICON[name];
}

export function TokenSelect({ options, value, onChange, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  const iconSrc = value ? tokenIcon(value.name) : undefined;

  return (
    <div ref={ref} className="relative w-full">
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((o) => !o)}
        className={`flex h-11 w-full items-center justify-between rounded-xl border border-brand-200 bg-brand-100 px-3 py-2.5 ${
          disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"
        }`}
      >
        <span className="flex flex-1 items-center gap-1.5 text-base text-neutral-900">
          {iconSrc && <img src={iconSrc} alt="" aria-hidden="true" className="size-5" />}
          {value?.name ?? "Select token"}
        </span>
        <img
          src="/assets/icon-chevron-down.svg"
          alt=""
          aria-hidden="true"
          className={`size-5 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div className="absolute top-12 z-50 max-h-72 w-full overflow-auto rounded-xl border border-brand-200 bg-white py-1 shadow-lg">
          {options.map((option) => (
            <button
              key={option.id}
              type="button"
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-base text-neutral-900 hover:bg-brand-100"
              onClick={() => {
                onChange(option);
                setOpen(false);
              }}
            >
              {tokenIcon(option.name) && (
                <img src={tokenIcon(option.name)} alt="" aria-hidden="true" className="size-5" />
              )}
              {option.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
