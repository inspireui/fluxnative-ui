---
'@fluxnative/catalog': minor
---

`fluxnative-catalog update`, manifest schema 2 and self-identifying files.

- `update --to <files> [--colors <json>] [--only A,B | +A,-B] [--dry-run] [--json] [--merge --base-dir <dir>]`: writes the catalog's copy over every file that still matches `.fluxnative-ui.json`, deletes the pristine files the catalog no longer ships, and reports hand edits with a diff instead of overwriting them (exit 2). `--merge` merges a hand-edited file with `git merge-file --zdiff3` against an earlier emitted copy. Declared forks are never written (a fork whose catalog copy moved on is reported); compositions are never touched.
- Manifest schema 2: `catalog { version, commit, repo }`, `inputs { colors, colorsPath, brand, brandPath, only }`, `files`, plus the owner-written `forks`, `compositions` and `applied` (reserved for release codemods). Schema 1 manifests are read and upgraded on the next write. This package's own `files/.fluxnative-ui.json` records `commit: null`.
- `check` verifies a template against its own manifest (file hashes, input hashes) instead of the current catalog; `check --upstream [--strict]` lists what `update` would change. `emit --check` still compares bytes.
- Every emitted file under `components/` and `theme/` starts with a header naming it and linking the catalog docs (no version number, covered by the hashes); the sources in `files/` stay header-less.
- `--only` follows the files' relative imports instead of a hand-written table, which also ships `bridge.ts` with `Reveal`, `Skeleton` and `Sheet` (their `useReducedMotion.ts` imports it).
- API: `Manifest` is the schema 2 shape (`inputs.only`, `inputs.colors`); new `update`, `checkTemplate`, `componentDeps`, `importGraph`, `parseManifest`, `loadManifest`, `upgradeManifest`, `catalogCommit`, `emittedHeader`.
