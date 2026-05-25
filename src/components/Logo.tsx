export function Logo({ className = "" }: { className?: string }) {
  return (
    <div className={`flex max-w-full items-center justify-center gap-3 ${className}`}>
      <img
        src="/assets/logo-logomark.svg"
        alt=""
        aria-hidden="true"
        className="h-8 w-auto shrink-0 sm:h-10"
      />
      <img
        src="/assets/logo-wordmark.svg"
        alt="LedgerReport"
        className="h-8 w-auto min-w-0 sm:h-10"
      />
    </div>
  );
}
