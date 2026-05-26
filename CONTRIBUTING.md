# Contributing

Thanks for considering a contribution. The project is a small Vite + React
frontend, so the workflow stays simple.

## Branches

- `develop` is the integration branch and the default target for new work.
- `main` is production. It is updated by release PRs from `develop`, never
  pushed to directly.
- Feature work happens on short-lived `feature/...` (or `fix/...`) branches
  off `develop`.

## Pull requests

- Open PRs against `develop`.
- Default to draft: `gh pr create --draft`. Mark ready for review once you've
  finished testing.
- Keep PRs focused; one logical change per PR.
- Do not force-push to `develop` or `main`. Force-pushing your own feature
  branch is fine while the PR is still in draft, but avoid it once review
  has started.

## Pre-push checklist

Run both commands locally and confirm they're clean before pushing:

```bash
npm run lint
npm run build
```

The build runs `tsc -b` first, so type errors block the build. Lint must
not regress beyond the existing warning count (currently zero errors and
five `react-hooks/exhaustive-deps` warnings in `src/App.tsx`).

## Commit messages

- Imperative subject ("Fix...", "Add...", "Use...") under ~72 chars.
- Explain the why, not just the what — the diff already shows the what.
- One logical change per commit.
- Match the style of `git log --oneline -20`.

## Code style

- TypeScript strict mode. No `any` for fresh code; the existing
  `eslint-disable any` on form generics is acknowledged and contained.
- No silent fallbacks: avoid `?? default` and `|| default` on values that
  represent missing data. Prefer throwing on missing data over returning
  zero, empty string, or a placeholder — a clear error is always better
  than a wrong number reaching a tax report.
- Existing label-override patterns (e.g. `BLOCKCHAIN_LABEL[chain] ?? chain`)
  are intentional cosmetic fallbacks and stay.
- Keep user-facing error messages human-readable. When interpolating chain
  identifiers, route them through `blockchainLabel()` from
  `src/utils/blockchainLabel.ts`.

## Tests

There is no automated test suite yet. New balance-fetch logic should be
verified by hand against a known historical balance on at least one
mainnet chain plus Bitcoin before opening a PR for review.

## License

By contributing you agree your contribution is licensed under the MIT
license of the project (see `LICENSE`).
