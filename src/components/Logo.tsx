export function Logo({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <img src="/assets/logo-logomark.svg" alt="" className="h-10 w-auto" aria-hidden="true" />
      <img src="/assets/logo-wordmark.svg" alt="LedgerReport" className="h-10 w-auto" />
    </div>
  );
}
