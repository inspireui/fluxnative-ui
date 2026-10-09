---
'@fluxnative/tokens': minor
'@fluxnative/tw-runtime': minor
'@fluxnative/catalog': minor
---

Token contract v0.1: a template's design DNA beyond colour.

- `@fluxnative/tokens`: the DTCG reader takes `fontFamily`, `typography` and `shadow`, with aliases inside composite values. New sys groups `font`, `type`, `shape`, `elevation`, `interaction` and `layout` (constants plus `TypeRole`, `ShapeRole` and `ElevationLevel`) default to what the catalog primitives do today. Eight colour roles join both schemes: `foreground-soft`, `border-soft`, `success-foreground`, `warning-foreground`, `inverse`, `inverse-foreground`, `tertiary` and `tertiary-foreground`. Brand files (`brand.tokens.json`, `brand.dark.tokens.json`, or a subset of DTCG Resolver 2025.10) load through `readBrandFiles`. `validateBrand` and `resolveBrand` check them with deterministic rules: contrast, the type scale, system fonts only, shape, elevation, motion, interaction, layout and closed keys. The Uniwind theme adds `rounded-<shape>` and `text-<role>`.
- `@fluxnative/tw-runtime`: resolves `rounded-<shape>` and `text-<role>`. As in Tailwind, `leading-*`, `tracking-*` and `font-*` win over a role.
- `@fluxnative/catalog`: `emit --brand <file | resolver | folder>` (exclusive with `--colors`), `render({ brand })`, `emitTokens({ brand })` and `loadBrand`. `theme/tokens.ts` appends the sys sections and `density`. With no brand, the existing sections don't change apart from the new colour roles.
