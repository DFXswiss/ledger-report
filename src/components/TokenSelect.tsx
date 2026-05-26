import { useEffect, useId, useRef, useState } from "react";
import type { SupportedAsset } from "../types";
import { TokenGlyph } from "./TokenGlyph";

interface Props {
  options: SupportedAsset[];
  value: SupportedAsset | undefined;
  onChange: (value: SupportedAsset) => void;
  disabled?: boolean;
  ariaLabelledBy?: string;
}

export function TokenSelect({ options, value, onChange, disabled, ariaLabelledBy }: Props) {
  const [open, setOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState<number>(() =>
    value ? Math.max(0, options.findIndex((o) => o.id === value.id)) : 0,
  );
  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const listboxId = useId();

  // When the dropdown opens, anchor the highlight on the current value (or
  // the first option) and scroll it into view.
  useEffect(() => {
    if (!open) return;
    const initial = value
      ? Math.max(0, options.findIndex((o) => o.id === value.id))
      : 0;
    setHighlightIndex(initial);
    queueMicrotask(() => {
      optionRefs.current[initial]?.focus();
    });
  }, [open, options, value]);

  useEffect(() => {
    const onClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  const select = (option: SupportedAsset) => {
    onChange(option);
    setOpen(false);
    triggerRef.current?.focus();
  };

  const moveHighlight = (delta: number) => {
    if (options.length === 0) return;
    setHighlightIndex((prev) => {
      const next = (prev + delta + options.length) % options.length;
      optionRefs.current[next]?.focus();
      return next;
    });
  };

  const onTriggerKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;
    if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setOpen(true);
    }
  };

  const onListKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    switch (event.key) {
      case "Escape":
        event.preventDefault();
        setOpen(false);
        triggerRef.current?.focus();
        break;
      case "ArrowDown":
        event.preventDefault();
        moveHighlight(1);
        break;
      case "ArrowUp":
        event.preventDefault();
        moveHighlight(-1);
        break;
      case "Home":
        event.preventDefault();
        setHighlightIndex(0);
        optionRefs.current[0]?.focus();
        break;
      case "End":
        event.preventDefault();
        setHighlightIndex(options.length - 1);
        optionRefs.current[options.length - 1]?.focus();
        break;
    }
  };

  return (
    // data-print="hide" hides the entire Token SectionRow on print via the
    // `div:has(> div > [data-print="hide"])` rule in src/index.css. Without
    // it the "Token" heading would sit orphaned above an empty area because
    // the print sheet already hides `form button[type="button"]` (the
    // dropdown trigger).
    <div ref={ref} data-print="hide" className="relative w-full">
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        // The visible text is the token name (e.g. "BTC"), so the accessible
        // name has to include it to satisfy WCAG SC 2.5.3 (label in name).
        // The section heading still labels the listbox below via
        // aria-labelledby on the role=listbox container.
        aria-label={`Token: ${value?.name ?? "Select token"}`}
        onClick={() => !disabled && setOpen((o) => !o)}
        onKeyDown={onTriggerKeyDown}
        className={`flex h-11 w-full items-center justify-between rounded-xl border border-brand-200 bg-brand-100 px-3 py-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 ${
          disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"
        }`}
      >
        <span className="flex flex-1 items-center gap-1.5 text-base text-neutral-900">
          {value && <TokenGlyph name={value.name} className="size-5" />}
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
        <div
          id={listboxId}
          role="listbox"
          aria-labelledby={ariaLabelledBy}
          onKeyDown={onListKeyDown}
          className="absolute top-12 z-50 max-h-72 w-full overflow-auto rounded-xl border border-brand-200 bg-white py-1 shadow-lg"
        >
          {options.map((option, index) => {
            const isSelected = value?.id === option.id;
            const isHighlighted = index === highlightIndex;
            return (
              <button
                key={option.id}
                ref={(el) => {
                  optionRefs.current[index] = el;
                }}
                type="button"
                role="option"
                // selection-follows-focus pattern: announce the
                // keyboard-focused option as selected too, so SR users hear
                // a consistent selection state while arrow-keying through
                // the list.
                aria-selected={isSelected || isHighlighted}
                tabIndex={isHighlighted ? 0 : -1}
                className={`flex w-full items-center gap-2 px-3 py-2 text-left text-base text-neutral-900 focus-visible:outline-none focus-visible:bg-brand-100 ${
                  isHighlighted ? "bg-brand-100" : "hover:bg-brand-100"
                }`}
                onClick={() => select(option)}
                onMouseEnter={() => setHighlightIndex(index)}
              >
                <TokenGlyph name={option.name} className="size-5" />
                {option.name}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
