interface SegmentedControlProps<T extends string> {
  options: { value: T; label: string }[];
  value: T | undefined;
  onChange: (value: T) => void;
  layout?: "wrap" | "equal";
  ariaLabel?: string;
  ariaLabelledBy?: string;
}

// We render plain buttons with aria-pressed instead of the ARIA radio pattern
// — the radio pattern requires arrow-key navigation with a tabindex roving,
// and a single segmented row of buttons is just as accessible without that
// extra wiring.
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  layout = "wrap",
  ariaLabel,
  ariaLabelledBy,
}: SegmentedControlProps<T>) {
  const container =
    layout === "equal"
      ? "flex w-full gap-1 rounded-xl"
      : "flex flex-wrap content-center gap-1 rounded-xl";

  return (
    <div
      className={container}
      role="group"
      aria-label={ariaLabelledBy ? undefined : ariaLabel}
      aria-labelledby={ariaLabelledBy}
    >
      {options.map((option) => {
        const active = option.value === value;
        const base =
          "flex items-center justify-center overflow-clip rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2";
        const size = layout === "equal" ? "flex-1 h-10 px-3" : "min-w-[80px] pt-2 pb-1.5 px-1";
        const typography =
          layout === "equal"
            ? "text-base font-bold leading-5"
            : "text-xs font-medium leading-4";
        const colors = active
          ? "bg-brand-100 text-brand-800"
          : "text-neutral-700 hover:bg-neutral-150";

        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            className={`${base} ${size} ${typography} ${colors} cursor-pointer`}
            onClick={() => onChange(option.value)}
          >
            <span className="break-words text-center">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
