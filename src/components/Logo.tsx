export function Logo({ className = "" }: { className?: string }) {
  // Below the sm breakpoint (~640px) the wordmark + logomark exceed the
  // header's available width once px-4 padding is accounted for, so we hide
  // the wordmark on the smallest viewports and keep just the logomark.
  //
  // Heights mirror the Figma "Logo" component proportions: the logomark fills
  // the full visual height, the wordmark sits at ~90.7% of that height so the
  // typographic baseline reads correctly next to the mark. The cap-height of
  // the wordmark glyphs aligns with the top of the logomark.
  return (
    <div className={`flex max-w-full items-center justify-center gap-2.5 ${className}`}>
      <img
        src="/assets/logo-logomark.svg"
        alt="LedgerReport"
        className="h-9 w-auto shrink-0 sm:h-11"
      />
      <img
        src="/assets/logo-wordmark.svg"
        alt=""
        aria-hidden="true"
        className="hidden h-8 w-auto min-w-0 sm:inline sm:h-10"
      />
    </div>
  );
}
