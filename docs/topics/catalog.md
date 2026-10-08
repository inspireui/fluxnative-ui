# Catalog layer (`@fluxnative/catalog`)

Flux templates (the FluxBuilder catalog, FluxNative imports) are written in
a narrower dialect than an Expo app: `import React from 'react'`, only
`react`, `react-native`, `react-native-svg`, `flux`, `flux/navigation` and
relative imports; no `className`, no build step; strict `tsc` with
`noUncheckedIndexedAccess`. `@fluxnative/catalog` emits FluxNative UI's
tokens, icon set and primitives **in that dialect**, so a template carries
them as plain files and still matches the library's design.

```mermaid
flowchart LR
  T[@fluxnative/tokens<br/>DTCG JSON] --> C[fluxnative-catalog emit]
  I[@fluxnative/icons<br/>table] --> C
  P[packages/catalog/files<br/>primitives, hand-written] --> C
  O[templates/id/colors.json<br/>optional overrides] --> C
  C --> F[templates/id/files/<br/>theme/ components/ .fluxnative-ui.json]
```

## Emit into a template

```bash
# from the fluxnative-ui checkout
node packages/catalog/src/cli.ts emit --to <catalog repo>/templates/<id>/files [--colors <catalog repo>/templates/<id>/colors.json] [--only Button,Sheet]
node packages/catalog/src/cli.ts check --to <catalog repo>/templates/<id>/files [--colors …]   # exit 1 on drift, nothing written
```

`emit` writes:

| path | content |
|---|---|
| `theme/tokens.ts` | generated: `colors` (light + dark), `lockedScheme`, `space`, `radius`, `text`, `fontWeight`, `duration`, `easing`, `glass`, `chrome`; imports nothing |
| `theme/usePalette.ts` | `useScheme()` and `usePalette()` (honours `lockedScheme`) |
| `components/Icon.tsx` | generated from the icon table; `<Icon name="bag" size={22} filled />` |
| `components/*.tsx` | the primitives below |
| `.fluxnative-ui.json` | catalog version, overrides hash, `--only` selection, sha256 per file |

`--only` keeps the named components (and what they import); the theme files
always ship. `check` reuses the manifest's selection, so a template's CI only
needs `check --to … --colors …`.

## Colour overrides

A template that is designed for one palette keeps a `colors.json` next to its
files and passes it with `--colors`:

```json
{
  "scheme": "light",
  "light": { "background": "#FFFFFF", "primary": "#111111", "primary-foreground": "#FFFFFF", "muted": "#F2F2F2" }
}
```

- `scheme`: `light`, `dark` or `system` (default). `light`/`dark` sets
  `lockedScheme` so `usePalette()` ignores the OS setting.
- `light` / `dark`: any subset of the token colour names (`ColorName`), values
  `#rgb`, `#rrggbb`, `#rrggbbaa`, `rgb()`, `rgba()` or `transparent`. Unknown
  names and other formats fail the emit with every problem listed.

Nothing else is overridable: spacing, radius and type come from the library,
which is what keeps templates on one scale.

## Primitives

All default exports, all with a required `accessibilityLabel` where a control
needs one, all respecting Reduce Motion.

| component | props |
|---|---|
| `Press` | `onPress` `onLongPress?` `accessibilityLabel` `accessibilityRole?` `haptic?`('none'\|'light'\|'selection'\|'medium') `activeScale?`(0.96) `hitSlop?` `disabled?` |
| `Reveal` | `index?` `delay?` `offset?` — entrance; `stagger(index)` caps at 7 × 55 ms |
| `Skeleton` | `width?` `height?` `radius?` `circle?` |
| `Scrim` | `progress`(Animated) `active` `onPress?` `accessibilityLabel?` |
| `Sheet` | `open` `onClose` `title?` `trailing?` `footer?` `height?` `closeLabel?` — spring up, drag or scrim closes; absolute inside the screen, never `Modal` |
| `Chip` | `label` `selected?` `onPress?` `size?`('sm'\|'md') `round?` `struck?` `leading?` `accessibilityRole?` |
| `Button` | `label` `onPress` `variant?`('primary'\|'secondary'\|'outline'\|'ghost'\|'destructive') `size?`('sm'\|'md'\|'lg') `loading?` `leading?` `trailing?` `block?` |
| `IconButton` | `children`(icon) `onPress` `accessibilityLabel` `variant?`('plain'\|'tonal'\|'filled'\|'translucent'\|'outline') `size?` `badge?` `selected?` |
| `StateView` | `title` `body?` `actionLabel?` `onAction?` `tone?`('neutral'\|'error') `icon?` `inline?` — empty and error states |
| `SectionHeader` | `title` `eyebrow?` `action?` `onAction?` |

The bridge to the host (`components/bridge.ts`) is optional-chained
everywhere: `bridge()?.ui?.haptic?.('light')`, `bridge()?.ui?.toast?.(…)`,
`bridge()?.storage?.get?.(key)`.

## Hosts for `flux/glass`

The `flux/glass` module a template may import is specified in
`packages/glass/src/contract.ts` and generated into
`packages/glass/hosts/web/glass.tsx` (FluxBuilder's react-native-web preview)
and `packages/glass/hosts/expo/glass.tsx` (FluxNative Expo projects). Host
repos vendor those two files; `pnpm tokens:check` fails when they drift from
the contract.

## Develop

```bash
pnpm catalog build          # regenerate packages/catalog/files (tokens.ts, Icon.tsx, manifest)
pnpm catalog build --check  # part of pnpm tokens:check
pnpm --filter @fluxnative/catalog test typecheck   # node:test + tsc over src/ and files/ (template dialect)
```

Primitives are edited in `packages/catalog/files/components/` directly; the
`files/` tsconfig has no path aliases and `jsx: react`, so what passes there
passes a template's `tsc`.
