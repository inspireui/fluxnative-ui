---
"@fluxnative/tokens": minor
"@fluxnative/catalog": minor
---

Brand files work end to end with manifest v2. `emit`, `update` and `check` take `--brand`; the manifest records `inputs.brand`, `brandPath` and `brandFiles` (a sha256 per brand file, so another tool can verify the DNA without resolving it), `check` names the brand file that changed, and `update` re-renders from the recorded `brandPath`. The brand reader, validator and sys emitters move to `@fluxnative/tokens/brand`, so the package's main entry is only the generated constants an app bundles.
