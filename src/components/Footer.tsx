const linkClass =
  "rounded-sm text-sm text-white hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-800";

export function Footer() {
  return (
    <footer className="mt-12 w-full bg-neutral-800 px-10 py-4 text-white">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
        <nav
          aria-label="Footer"
          className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm font-medium"
        >
          <span>&copy; LedgerReport</span>
          <span aria-hidden="true" className="text-neutral-400">
            &middot;
          </span>
          <a
            href="https://github.com/ledgerreport/app"
            target="_blank"
            rel="noreferrer noopener"
            className={`inline-flex items-center gap-2 font-bold ${linkClass}`}
          >
            <img src="/assets/icon-github.svg" alt="" className="size-5" aria-hidden="true" />
            Source
          </a>
        </nav>
        <p className="max-w-md text-xs leading-5 text-neutral-300 sm:text-right">
          Address never stored. Data is queried on-demand from Alchemy, mempool.space,
          and CoinGecko.
        </p>
      </div>
    </footer>
  );
}
