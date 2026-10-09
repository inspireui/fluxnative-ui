---
"@fluxnative/catalog": patch
---

`npx fluxnative-catalog` now runs from an installed copy: a plain-JS launcher strips the TypeScript of this package and the other `@fluxnative` packages it imports (Node refuses to under `node_modules`). Colour descriptions are resolved through `@fluxnative/tokens`' exports, so an npm install emits the same bytes as the monorepo. Tests no longer ship in any package tarball, and every package has a README.
