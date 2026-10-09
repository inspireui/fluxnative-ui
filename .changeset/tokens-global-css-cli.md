---
'@fluxnative/tokens': patch
---

New `fluxnative-tokens` command for apps outside this repo: `npx fluxnative-tokens global-css --out src/global.css` writes the Uniwind CSS entry file (the `tailwindcss` and `uniwind` imports plus the theme) from the package's tokens, the same file `pnpm tokens` writes for the example app. `--check` writes nothing and exits 1 when the file is missing or stale. It refuses to write inside the package or any `node_modules` folder. The bin is a small JS launcher (`src/bin.js`) because Node does not strip TypeScript types under `node_modules`; it needs Node.js 22.15 or newer.
