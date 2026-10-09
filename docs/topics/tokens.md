# Tokens and styling

Style with `className` in Tailwind v4 syntax.

## Scales: Tailwind's own

- Spacing: `p-4` = 16px. Any multiple of 0.25 works (`gap-2.5`). Fractions work (`w-1/2`), as do `px`, `auto` and `full`.
- Radius: `rounded-xs` `-sm` `-md` `-lg` `-xl` `-2xl` `-3xl` `-4xl` `-full`, plus the bare `rounded`.
- Type: `text-xs` `-sm` `-base` `-lg` `-xl` `-2xl` … `-6xl`. Weights: `font-thin` … `font-black`.
- Roles (see [Sys groups](#sys-groups-token-contract-v01)): `rounded-control` `-card` `-card-inner` `-sheet` `-chip` `-avatar` `-field` `-well`, and `text-display` `-headline` `-title` `-body` `-body-sm` `-label` `-caps` `-numeric`. A `text-<role>` sets size, line height, tracking and weight; `leading-*`, `tracking-*` and `font-*` still win. A role's font family and `tabular-nums` come from JS (`type.numeric`), or `tabular-nums` as a class.

## Colors: semantic only

These are the only colors:

| Class | Meaning |
|---|---|
| `background` / `foreground` | The app canvas and its text |
| `foreground-soft` | Secondary text that must stay readable (stronger than `muted-foreground`) |
| `card`, `card-foreground` | Raised content |
| `popover`, `popover-foreground` | Menus |
| `inverse`, `inverse-foreground` | Inverted surface: snackbars, a selected chip |
| `primary`, `primary-foreground` | The brand action |
| `secondary`, `secondary-foreground` | Secondary action fill |
| `tertiary`, `tertiary-foreground` | A third hue: likes, tags, highlights |
| `muted`, `muted-foreground` | Quiet fills; secondary text |
| `accent`, `accent-foreground` | Pressed and selected states |
| `destructive`, `success`, `warning` | Status |
| `destructive-foreground`, `success-foreground`, `warning-foreground` | Ink on a status fill |
| `border`, `border-soft`, `input`, `ring` | Lines and focus |
| `scrim` | Dimming layer |
| `white`, `black` | Literal |

- Use them with `bg-`, `text-` and `border-`. Add `/50` for opacity.
- Light and dark come from the system automatically. Use `dark:` only for a deliberate difference.
- Palette classes such as `bg-blue-500` do not exist, and neither do arbitrary values such as `p-[13px]`.

## In JavaScript

```tsx
import { usePalette } from '@fluxnative/ui';
import { type, shape, elevation, radius, text, duration } from '@fluxnative/tokens';
const palette = usePalette(); // the current scheme's colors

<Text style={[type.title, { color: palette.foreground }]}>Today</Text>
<View style={[{ borderRadius: shape.card, backgroundColor: palette.card }, elevation[2]]} />
```

## Sys groups (token contract v0.1)

Roles a template's brand may override. The defaults reproduce what the catalog primitives do today.

| Group | Keys in JS | Default |
|---|---|---|
| `font` | `display` `text` `numeric` | `["System"]`; `numeric` turns on `tabular-nums` |
| `type` | `display` `headline` `title` `body` `bodySm` `label` `caps` `numeric` | 30 / 24 / 20 / 16 / 14 / 14 / 11 / 16 px on the `text` scale; `title` is the Sheet title, `label` the Chip label, `caps` the section eyebrow |
| `shape` | `control` `card` `cardInner` `sheet` `chip` `avatar` `field` `well` | radius `full` `2xl` `xl` `3xl` `full` `full` `xl` `lg` |
| `elevation` | `0` … `4` | black, alpha 0 → 0.16, offsetY 0 → 12, blur 0 → 24; Android 0 / 1 / 3 / 6 / 12 |
| `interaction` | `press` `reveal` `skeleton` | Press: haptic `none`, scale 0.96, no hit slop, spring 40/0. Reveal: 16 px, 600 ms, 55 ms per index. Skeleton: `opacity` pulse on `muted`, 900 ms, 0.5, 0.8 when Reduce Motion |
| `layout` | `gutter` `safeTop` `tabBarHeight` | 16, 8, `chrome.tabBarHeight` (56) |

- Token paths are kebab-case (`type.body-sm`, `interaction.press.active-scale`); the emitted constants are camelCase (`type.bodySm`, `interaction.press.activeScale`).
- `type.<role>` is Text style data: `fontSize`, `lineHeight` (px), `fontWeight` (`'700'`), `letterSpacing` (px), plus `fontFamily` only for a named family (`System` is the platform font) and `fontVariant` when the role turns one on.
- `elevation[n]` is View style data: `shadowColor`, `shadowOpacity`, `shadowRadius`, `shadowOffset`, and Android's `elevation`.
- Enum choices are not tokens: the press haptic, skeleton mode and colours, and density live in code, and a brand picks them in its metadata.

## Brand files: a template's DNA

A Flux template overrides the sys groups and colour roles with a DTCG file, `design/brand.tokens.json`, plus an optional `brand.dark.tokens.json` beside it holding dark colours only. `fluxnative-catalog emit --to files --brand design` validates the brand and emits it into `theme/tokens.ts` ([catalog.md](catalog.md)). In code, `readBrandFiles` reads it and `validateBrand` / `resolveBrand` check and resolve it (`@fluxnative/tokens`).

- Overridable: `color` (the light scheme; dark goes in the `.dark` file), `font`, `type`, `shape`, `elevation`, `duration`, `easing`, `interaction`, `layout`.
- Kit-only, an error if present: `spacing`, `radius`, `text`, `font-weight`, `glass`, `chrome`.
- A brand token replaces the kit token at its path. Its `$extensions["dev.fluxnative"]` keys (`fontVariant` on `font` and `type`, `android` on `elevation`) override the kit's one by one, so an `elevation.2` without `android` keeps the kit's 3.
- Aliases resolve after the merge: the kit's `type.title` takes the brand's `font.display`, and `inverse` follows the brand's `foreground`.
- Every token needs a `$type`, on itself or a group in the same file.

### Example

```json
{
  "$extensions": {
    "dev.fluxnative.brand": {
      "schemaVersion": 1,
      "scheme": "system",
      "density": "comfy",
      "personality": ["quiet", "editorial"],
      "haptic": "light",
      "skeleton": { "mode": "color", "base": "muted", "highlight": "card" }
    }
  },
  "color": {
    "$type": "color",
    "primary": { "$value": { "colorSpace": "srgb", "components": [0.1059, 0.3686, 0.1255], "hex": "#1b5e20" } },
    "foreground-soft": { "$value": { "colorSpace": "srgb", "components": [0.2902, 0.2902, 0.2902], "hex": "#4a4a4a" } },
    "destructive": { "$value": { "colorSpace": "srgb", "components": [0.702, 0.149, 0.1176], "hex": "#b3261e" } },
    "border": { "$value": { "colorSpace": "srgb", "components": [0.2353, 0.2353, 0.2627], "alpha": 0.29, "hex": "#3c3c43" } }
  },
  "font": { "$type": "fontFamily", "display": { "$value": ["Georgia", "serif"] } },
  "type": {
    "$type": "typography",
    "display": {
      "$value": {
        "fontFamily": "{font.display}",
        "fontSize": { "value": 28, "unit": "px" },
        "fontWeight": 700,
        "lineHeight": 1.15,
        "letterSpacing": { "value": -0.4, "unit": "px" }
      }
    },
    "numeric": {
      "$value": {
        "fontFamily": "{font.numeric}",
        "fontSize": { "value": 24, "unit": "px" },
        "fontWeight": 600,
        "lineHeight": 1.2,
        "letterSpacing": { "value": -0.02, "unit": "em" }
      }
    }
  },
  "shape": { "$type": "dimension", "card": { "$value": "{radius.3xl}" }, "card-inner": { "$value": "{radius.2xl}" } },
  "elevation": {
    "$type": "shadow",
    "1": {
      "$value": {
        "color": { "colorSpace": "srgb", "components": [0, 0, 0], "alpha": 0.1, "hex": "#000000" },
        "offsetX": { "value": 0, "unit": "px" },
        "offsetY": { "value": 1, "unit": "px" },
        "blur": { "value": 3, "unit": "px" },
        "spread": { "value": 0, "unit": "px" }
      },
      "$extensions": { "dev.fluxnative": { "android": 2 } }
    }
  },
  "duration": { "$type": "duration", "normal": { "$value": { "value": 220, "unit": "ms" } } },
  "easing": { "$type": "cubicBezier", "standard": { "$value": [0.25, 0.1, 0.25, 1] } },
  "interaction": {
    "press": {
      "active-scale": { "$type": "number", "$value": 0.95 },
      "hit-slop": { "$type": "dimension", "$value": { "value": 8, "unit": "px" } }
    },
    "reveal": { "offset": { "$type": "dimension", "$value": { "value": 20, "unit": "px" } } }
  },
  "layout": {
    "$type": "dimension",
    "gutter": { "$value": { "value": 20, "unit": "px" } },
    "tab-bar-height": { "$value": { "value": 64, "unit": "px" } }
  }
}
```

Its `brand.dark.tokens.json` sets `primary`, `foreground-soft`, `destructive` and `border` again (every role the light file sets), plus `primary-foreground` and `destructive-foreground` for the lighter dark fills. The same files are the test fixture in `packages/tokens/src/fixtures/brand/`.

### Root metadata: `$extensions["dev.fluxnative.brand"]`

| Key | Values | Default |
|---|---|---|
| `schemaVersion` | `1`, required | |
| `scheme` | `light` / `dark` lock the template to one scheme; `system` follows the OS | `system` |
| `density` | `compact` `regular` `comfy` | `regular` |
| `personality` | words for reviewers and models; not emitted | `[]` |
| `haptic` | `none` `light` `selection` `medium` | `none` |
| `skeleton` | `{ "mode": "opacity" \| "color", "base": <role>, "highlight": <role> }` | `opacity`, `muted`, `accent` |

### Resolver

`brand.resolver.json` (DTCG Resolver 2025.10) is read in this subset: `sets` whose `sources` are `{ "$ref": "<path relative to the resolver>" }`, at most one `theme` modifier with `light` and `dark` contexts (colour-only sources), and a `resolutionOrder` that lists every set and puts the theme modifier last. The kit comes first, implicitly. Anything else is rejected with the reason.

```json
{
  "version": "2025.10",
  "sets": { "brand": { "sources": [{ "$ref": "brand.tokens.json" }] } },
  "modifiers": { "theme": { "contexts": { "light": [], "dark": [{ "$ref": "brand.dark.tokens.json" }] } } },
  "resolutionOrder": [{ "$ref": "#/sets/brand" }, { "$ref": "#/modifiers/theme" }]
}
```

### Validator rules

The checks are deterministic. `validateBrand` collects every problem, and `resolveBrand` throws a `BrandError` listing them when any is an error.

| Rule | Threshold | Level |
|---|---|---|
| Contrast 4.5:1 | foreground/background, card-foreground/card, primary-foreground/primary, secondary-foreground/secondary, accent-foreground/accent, destructive-foreground/destructive, inverse-foreground/inverse | error |
| Contrast 3:1 | muted-foreground on background and on card, foreground-soft/background, primary/background | error |
| Contrast 1.5:1 | border/background | error |
| Type order | display > headline > title > body ≥ body-sm ≥ label ≥ caps (font size) | error |
| Type | body 14–17 px; lineHeight 1.0–1.6; letterSpacing −0.05em to +0.12em; caps ≥ +0.04em | error |
| Small type | any role under 11 px | warning |
| Fonts | a stack ends with `System`, `serif`, `sans-serif` or `monospace`; only those and `Georgia`, `Menlo`, `Courier` (hosts load no web fonts yet) | error |
| Shape | aliases of `{radius.*}` only; card-inner ≤ card; chip ≥ radius.md | error |
| Elevation | alpha ≤ 0.30 (≤ 0.60 when `scheme` is `dark`); blur ≤ 32 px; offsetY ≤ 16 px; alpha never drops as the level rises; no `inset` | error |
| Elevation | layers after the first, non-zero spread (React Native draws neither) | warning |
| Motion | duration fast 100–180, normal 180–300, slow 300–500 ms, increasing; easing x1 and x2 within 0–1 | error |
| Interaction | active-scale 0.9–1; hit-slop 0–12 px; stagger ≤ 80 ms; skeleton opacities 0–1 | error |
| Layout | gutter 16, 20 or 24; tab-bar-height 56–88 and a multiple of 4 | error |
| Closed | an unknown group, token, extension or metadata key; a token without `$value` or with extra keys; a missing `$type`; a typography value missing one of its five fields; a broken alias; a dark file missing a role the light file sets | error |
| Schemes | light colours with no dark file under `scheme: system`, or with `scheme: dark` | warning |

Contrast is checked on each scheme the template shows (one when `scheme` locks it), with translucent colours laid over the background. A pair the brand leaves at the kit's values is a warning: the kit's iOS palette is itself under three thresholds (white on `primary` 4.02:1 light and 3.65:1 dark, white on `destructive` 3.55:1 and 3.41:1, light `border` 1.37:1).

## Changing the design

Edit `packages/tokens/tokens/*.tokens.json` (W3C DTCG 2025.10) and run `pnpm tokens`. Light and dark must define the same color names; the build fails and names any that are missing.
