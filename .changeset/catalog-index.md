---
"@fluxnative/catalog": minor
---

`fluxnative-catalog index` writes `docs/llm/CATALOG.index.md`: the ≤ 8 KB index a model reads before it writes a Flux template screen, generated from the layer itself (component props with their closed values, token roles, the dialect rules and one example). `pnpm tokens` regenerates it and `pnpm tokens:check` fails on drift.
