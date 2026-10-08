---
'@fluxnative/tokens': minor
'@fluxnative/glass': minor
'@fluxnative/tw-runtime': minor
'@fluxnative/ui': minor
'@fluxnative/icons': minor
'@fluxnative/catalog': minor
---

Catalog layer and the closed `flux/glass` contract.

- `@fluxnative/catalog` (new): emits a dependency-free `theme/tokens.ts`, `components/Icon.tsx` and ten primitives (Press, Reveal, Skeleton, Scrim, Sheet, Chip, Button, IconButton, StateView, SectionHeader) into a Flux template, with colour overrides and a `.fluxnative-ui.json` manifest; `emit --check` catches drift.
- `@fluxnative/icons` (new): one closed icon table (SF Symbol, Material Symbol, SVG path) and an `<Icon>`; `FluxTabs.Tab` takes `iconName`.
- `@fluxnative/glass`: the `flux/glass` contract (`contract.ts`) with generated host files for the FluxBuilder web preview and FluxNative Expo under `hosts/`, checked in CI.
- `@fluxnative/tokens`: `destructive-foreground`.
- `@fluxnative/tw-runtime`: shadows, leading/tracking, transforms, border-x/y, max-w-*, screen sizes.
- `@fluxnative/ui`: `AppBar backLabel`, `TabBar shape` (Material 3 bar on Android), component render tests; `react-native-svg` is now a required peer.
