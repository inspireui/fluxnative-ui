# FluxNative UI

React Native components whose navigation chrome is **always Liquid Glass**, styled with **Tailwind v4 classes** and built so that **language models write it correctly**.

> Status: v0 scaffold. APIs will change before 1.0.

```tsx
import { Screen, AppBar } from '@fluxnative/ui';

export default function Home() {
  return (
    <Screen contentContainerClassName="gap-4 px-4">
      <AppBar title="Discover" largeTitle />
      <View className="rounded-2xl bg-card p-4">
        <Text className="text-lg font-semibold text-card-foreground">Today</Text>
      </View>
    </Screen>
  );
}
```

## Why

- **Glass is the default, not an option.**
  - On iOS, `AppBar` and `FluxTabs` *are* the system navigation and tab bars, so iOS 26+ draws real Liquid Glass and owns the accessibility behaviour.
  - Everywhere else FluxNative UI draws glass itself, choosing the best tier the device can render.
- **Tailwind syntax as-is.**
  - Spacing, radius and type use Tailwind's own scale, because that is what models already write.
  - Colors are the one exception: only semantic names (shadcn/ui names) exist, so dark mode can't break.
- **Small, closed vocabulary.**
  - The whole API fits in an 8 KB `AGENTS.md` index ([`docs/llm/AGENTS.index.md`](docs/llm/AGENTS.index.md)).
  - Props are closed string unions, so TypeScript rejects unknown values.
  - The runtime resolver warns on unknown classes and names the valid alternative.
  - `pnpm typecheck` rejects unknown prop values; there is no ESLint plugin yet (see Known gaps).

## The glass ladder

```mermaid
flowchart LR
  A{role = bar<br/>and native stack/tabs<br/>and iOS} -- yes --> NB[native-bar<br/>system bar]
  A -- no --> B{Reduce Transparency<br/>or Increase Contrast}
  B -- yes --> OP[opaque]
  B -- no --> C{UIGlassEffect<br/>available}
  C -- yes --> NG[native-glass<br/>expo-glass-effect]
  C -- no --> D{blur available}
  D -- yes --> BL[blur<br/>expo-blur / backdrop-filter]
  D -- no --> TR[translucent<br/>fill + rim + sheen]
```

There is no prop that turns glass off. Only the platform and the user's accessibility settings move a surface down the ladder, and they do it live.

## Packages

| Package | What it does |
|---|---|
| `@fluxnative/tokens` | W3C DTCG 2025.10 tokens (`tokens/*.tokens.json`), compiled to TypeScript constants and a Uniwind `global.css` |
| `@fluxnative/glass` | Tier resolver, `GlassSurface`, `GlassGroup` and the adapter registry. `@fluxnative/glass/expo` registers expo-glass-effect and expo-blur |
| `@fluxnative/ui` | `Screen`, `AppBar`, `TabBar`, `Glass`. `@fluxnative/ui/expo-router` provides `FluxStack` and `FluxTabs` |
| `@fluxnative/tw-runtime` | Resolves the same class contract at runtime, for hosts with no build step (the Flux WebView, Snack) |
| `@fluxnative/icons` | One closed icon table (SF Symbol, Material Symbol, SVG path) and an `<Icon>`; `FluxTabs.Tab iconName` |
| `@fluxnative/catalog` | Emits the tokens, `Icon` and ten primitives into a Flux template as dependency-free files ([`docs/topics/catalog.md`](docs/topics/catalog.md)) |

## Setup (Expo SDK 57)

1. Install the packages:
   ```bash
   npx expo install uniwind tailwindcss expo-glass-effect expo-blur react-native-safe-area-context react-native-svg
   ```
2. Wrap the Metro config with `withUniwindConfig(config, { cssEntryFile: './src/global.css' })`. It must be the outermost wrapper.
3. Generate `src/global.css` from the tokens. In this repo that is `pnpm tokens`.
4. In `src/app/_layout.tsx`, add `import '../global.css'` and `import '@fluxnative/glass/expo'`, then render `<FluxStack>`.

See [`apps/expo-example`](apps/expo-example) for a complete app.

## Develop

```bash
pnpm install
pnpm tokens        # regenerate token outputs, the example's global.css, the flux/glass hosts and the catalog files
pnpm tokens:check  # the same, failing on drift (CI runs it)
pnpm test          # node:test suites (tokens, glass, class resolver, icons, catalog) + jest render tests (ui)
pnpm typecheck
pnpm catalog emit --to <template>/files [--colors <template>/colors.json]   # the catalog layer into a Flux template
EXPO_PUBLIC_STYLE_ENGINE=runtime pnpm --filter fluxnative-ui-expo-example web   # the example on the runtime class engine
pnpm --filter fluxnative-ui-expo-example web
pnpm --filter fluxnative-ui-expo-example ios
```

## Packaging: source packages

The packages publish **TypeScript source** (`main` and `exports` point at `src/*.ts`), which Metro, Expo web and Vite consume directly. A consumer therefore needs:

| requirement | why |
|---|---|
| TypeScript ≥ 5.5 with `allowImportingTsExtensions` or `rewriteRelativeImportExtensions` (or `moduleResolution: bundler`) | sources import each other with `.ts`/`.tsx` extensions |
| Metro / Expo SDK 57+ (or Vite with the React Native Web plugin) | no JS build is shipped |
| `react-native-svg` ≥ 15 | `@fluxnative/icons` and `FluxTabs iconName` draw SVG |
| Jest consumers: add `@fluxnative` to `transformIgnorePatterns` | the sources are not transpiled |

A compiled build (react-native-builder-bob, `.d.ts` output) is the next step before the packages leave `0.x`; until then, pin exact versions.

## Known gaps in v0

- **Android has no blur tier yet.** expo-blur needs a `BlurTargetView` around the content, so Android custom glass is `translucent` ([`docs/topics/android.md`](docs/topics/android.md)).
- **No CLI yet** beyond `fluxnative-catalog` (`fluxnative-ui init / add / agents-md / doctor` are still to do), and no ESLint plugin or MCP server.
- **No compiled build.** See *Packaging: source packages* above.
- **iOS native header items are plain React views.** `unstable_headerRightItems` / `Stack.Toolbar` support is still to do.
- **The `flux/glass` hosts are vendored by hand.** Host repos copy `packages/glass/hosts/*/glass.tsx` and check the hash; there is no npm distribution of the hosts yet.

## License

MIT © InspireUI and the FluxNative UI contributors.
