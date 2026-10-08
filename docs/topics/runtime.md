# Runtime styling (Flux WebView, Snack)

Some hosts can't run a Tailwind build step: the FluxBuilder WebView and Expo Snack. On those hosts:

```tsx
<FluxNativeProvider styleEngine="runtime">…</FluxNativeProvider>
```

FluxNative UI components then resolve `className` with `@fluxnative/tw-runtime`. It accepts the same contract as Uniwind under the FluxNative UI theme.

Your own views use the hook:

```tsx
import { useClassStyle } from '@fluxnative/tw-runtime';
const style = useClassStyle('flex-row items-center gap-3 rounded-2xl bg-card p-4');
<View style={style} />
```

Unknown classes produce one development warning each, naming the valid alternative. For example, `bg-blue-500` produces a warning that lists the semantic colors.

## Supported classes

Layout, spacing, radius, type and semantic colors follow the Tailwind v4 names (see AGENTS.md). Beyond those, the resolver reads:

| Classes | React Native output |
| --- | --- |
| `shadow`, `shadow-2xs` … `shadow-2xl`, `shadow-none` | `shadowColor` `#000000`, `shadowOffset`, `shadowOpacity`, `shadowRadius` (first layer of the Tailwind shadow) plus `elevation` 3 / 1, 1, 2, 4, 8, 12, 16 / 0 |
| `leading-none` … `leading-loose`, `leading-3` … `leading-10` | `lineHeight`: the multiplier times the `text-*` size in the same string (16 without one); numeric steps are 4 px each. Wins over the `text-*` line height whichever comes first, as in Tailwind |
| `tracking-tighter` … `tracking-widest` | `letterSpacing` in px: the em value times the `text-*` size in the same string (16 without one) |
| `translate-x-<n>`, `translate-y-<n>`, `rotate-<deg>`, `scale-<n>`, `scale-x-<n>`, `scale-y-<n>` (negatives with a leading `-`) | one `transform` array in CSS order: translate, rotate, scale. Translate uses the spacing scale (`-translate-x-1/2` → `'-50%'`), rotate gives `'45deg'`, scale gives `1.1` |
| `border-x`, `border-y`, `border-x-<n>`, `border-y-<n>` (0, 2, 4, 8; also `border-t-<n>` etc.) | both `borderLeftWidth` / `borderRightWidth` or `borderTopWidth` / `borderBottomWidth` |
| `w-screen`, `h-screen` | the window width / height. `useClassStyle` reads `useWindowDimensions()`; a direct `resolve()` call passes `window: { width, height }` |
| `max-w-xs` … `max-w-7xl`, `max-w-full`, `max-w-none` | `maxWidth` 320 … 1280, `'100%'`, or unset |

Two Tailwind classes are props, not styles, and warn with the replacement: `line-clamp-<n>` is `numberOfLines={n}` on `Text`, and `active:` is Pressable's `style={({ pressed }) => …}`.

## Glass in the Flux runtime

FluxBuilder templates import glass from the host: `import { GlassSurface, GlassGroup, useGlassTier } from 'flux/glass'`. The contract matches `@fluxnative/glass`. A template that imports it must declare the `glass` capability. See `dashboard/src/flux/GLASS.md` in the template catalog.
