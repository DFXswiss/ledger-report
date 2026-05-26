# LedgerReport

Wallet balance reports for Bitcoin and EVM tokens at any past date — for tax
filings, audits, and accounting. Enter a wallet address, pick a token and a
date, and get a downloadable PDF with the on-chain balance and its fiat
value (CHF/EUR/USD) on that day. Swiss wealth-tax filings use the official
ESTV ICTax CHF rate when one is published for the requested year-end.

## Live

- Production: <https://ledgerreport.com>
- Development: <https://dev.ledgerreport.com>

## Stack

- Vite + React 19 + Tailwind 4 (TypeScript, strict mode)
- Bitcoin balances via mempool.space Esplora (override with `VITE_ESPLORA_URL`)
- EVM balances via Alchemy (requires `VITE_ALCHEMY_API_KEY`)
- Prices via CoinGecko (`/coins/.../history` for the snapshot date,
  `/simple/token_price` fallback for newer tokens)
- ESTV ICTax CHF override on known Swiss year-end record dates

Supports 8 EVM chains today: Ethereum, BNB Smart Chain, Polygon, Arbitrum,
Optimism, Base, Haqq, Gnosis — plus Bitcoin.

## Local development

```bash
npm install
cp .env.example .env
# edit .env to add your VITE_ALCHEMY_API_KEY
npm run dev
```

Vite will serve the app on <http://localhost:5173>.

## Build

```bash
npm run build      # tsc -b && vite build
npm run lint
```

Both commands must be clean before pushing.

## Icons

`public/apple-touch-icon.png` is 180×180 PNG, regenerated from
`public/assets/logo-logomark.svg` whenever the logomark changes. The matching
favicon set (`favicon.ico`, `favicon-16x16.png`, `favicon-32x32.png`) lives
alongside it.

## Deployment

- `develop` → `dev.ledgerreport.com` (automatic, via GitHub Actions FTP)
- `main` → `ledgerreport.com` (automatic, via GitHub Actions FTP)

Both deploy jobs run `npm ci && npm run build` and ship `dist/` over FTP
with `dangerous-clean-slate: true` so the remote tree always reflects the
build output exactly. Hosting, secrets, and rotation procedure are
documented separately in the private infrastructure repo.

## Contributing

See [`CONTRIBUTING.md`](./CONTRIBUTING.md).

## License

MIT — see [`LICENSE`](./LICENSE).
