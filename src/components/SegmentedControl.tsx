interface SegmentedControlProps<T extends string> {
  options: { value: T; label: string }[];
  value: T | undefined;
  onChange: (value: T) => void;
  layout?: "wrap" | "equal";
  ariaLabel?: string;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  layout = "wrap",
  ariaLabel,
}: SegmentedControlProps<T>) {
  const container =
    layout === "equal"
      ? "flex w-full gap-1 rounded-xl"
      : "flex flex-wrap content-center gap-1 rounded-xl";

  return (
    <div className={container} role="radiogroup" aria-label={ariaLabel}>
      {options.map((option) => {
        const active = option.value === value;
        const base = "flex items-center justify-center overflow-clip rounded-lg transition-colors";
        const size = layout === "equal" ? "flex-1 h-10 px-3" : "min-w-[80px] pt-2 pb-1.5 px-1";
        const typography =
          layout === "equal"
            ? "text-base font-bold leading-5"
            : "text-xs font-medium leading-4";
        const colors = active
          ? "bg-brand-100 text-brand-800"
          : "text-neutral-500 hover:bg-neutral-150";

        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
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
