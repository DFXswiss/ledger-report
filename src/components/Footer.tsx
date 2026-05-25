export function Footer() {
  return (
    <footer className="mt-12 w-full bg-neutral-800 px-10 py-4">
      <a
        href="https://github.com/DFXswiss/ledger-report/issues/new"
        target="_blank"
        rel="noreferrer noopener"
        className="inline-flex items-center gap-2 rounded-sm text-sm font-bold text-white hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-800"
      >
        <img src="/assets/icon-github.svg" alt="" className="size-5" aria-hidden="true" />
        Submit an issue
      </a>
    </footer>
  );
}
