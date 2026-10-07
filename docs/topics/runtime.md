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

## Glass in the Flux runtime

FluxBuilder templates import glass from the host: `import { GlassSurface, GlassGroup, useGlassTier } from 'flux/glass'`. The contract matches `@fluxnative/glass`. A template that imports it must declare the `glass` capability. See `dashboard/src/flux/GLASS.md` in the template catalog.
