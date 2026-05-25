export function Logo({ className = "" }: { className?: string }) {
  // Below the sm breakpoint (~640px) the wordmark + logomark exceed the
  // header's available width once px-4 padding is accounted for, so we hide
  // the wordmark on the smallest viewports and keep just the logomark.
  return (
    <div className={`flex max-w-full items-center justify-center gap-3 ${className}`}>
      <img
        src="/assets/logo-logomark.svg"
        alt="LedgerReport"
        className="h-8 w-auto shrink-0 sm:h-10"
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
