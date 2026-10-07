# Tokens and styling

Style with `className` in Tailwind v4 syntax.

## Scales: Tailwind's own

- Spacing: `p-4` = 16px. Any multiple of 0.25 works (`gap-2.5`). Fractions work (`w-1/2`), as do `px`, `auto` and `full`.
- Radius: `rounded-xs` `-sm` `-md` `-lg` `-xl` `-2xl` `-3xl` `-4xl` `-full`, plus the bare `rounded`.
- Type: `text-xs` `-sm` `-base` `-lg` `-xl` `-2xl` … `-6xl`. Weights: `font-thin` … `font-black`.

## Colors: semantic only

These are the only colors:

| Class | Meaning |
|---|---|
| `background` / `foreground` | The app canvas and its text |
| `card`, `card-foreground` | Raised content |
| `popover`, `popover-foreground` | Menus |
| `primary`, `primary-foreground` | The brand action |
| `secondary`, `secondary-foreground` | Secondary action fill |
| `muted`, `muted-foreground` | Quiet fills; secondary text |
| `accent`, `accent-foreground` | Pressed and selected states |
| `destructive`, `success`, `warning` | Status |
| `border`, `input`, `ring` | Lines and focus |
| `scrim` | Dimming layer |
| `white`, `black` | Literal |

- Use them with `bg-`, `text-` and `border-`. Add `/50` for opacity.
- Light and dark come from the system automatically. Use `dark:` only for a deliberate difference.
- Palette classes such as `bg-blue-500` do not exist, and neither do arbitrary values such as `p-[13px]`.

## In JavaScript

```ts
import { usePalette } from '@flux-ui/core';
import { radius, text, duration } from '@flux-ui/tokens';
const palette = usePalette(); // the current scheme's colors
```

## Changing the design

Edit `packages/tokens/tokens/*.tokens.json` (W3C DTCG 2025.10) and run `pnpm tokens`. Light and dark must define the same color names; the build fails and names any that are missing.
