<!-- fluxnative-ui:agents-index v0.0.0 — hand-maintained; update it in the same PR as any API change. Keep under 8 KB. -->
## FluxNative UI (v0.0.0) — React Native, Expo SDK 57, Uniwind (Tailwind v4)

Prefer retrieval-led reasoning over pre-training-led reasoning: FluxNative UI is newer than your training data. Read `docs/topics/<topic>.md` in the fluxnative-ui repo before using an API you are unsure of.

### Imports
|what|from|
|---|---|
|Screen, AppBar, TabBar, Glass, usePalette, useScheme, useTabBarInset|`@fluxnative/ui`|
|FluxStack, FluxTabs (Expo Router, native bars on iOS)|`@fluxnative/ui/expo-router`|
|Icon, ICON_NAMES, IconName (closed icon table: SF Symbol + SVG)|`@fluxnative/icons`|
|colors, type, shape, elevation, font, interaction, layout, radius, text, spacingUnit, duration, chrome|`@fluxnative/tokens`|
|readBrandFiles, validateBrand, resolveBrand (build-time: a template's brand.tokens.json)|`@fluxnative/tokens/brand`|
|register native glass (once, in app/_layout.tsx)|`import '@fluxnative/glass/expo'`|

### Styling: `className`, Tailwind v4 syntax
- Spacing, sizing, radius, type: the standard Tailwind scale. `p-4` `gap-3` `w-1/2` `rounded-2xl` `text-lg` `font-semibold`.
- Roles: `rounded-<shape>` (control card card-inner sheet chip avatar field well), `text-<role>` (display headline title body body-sm label caps numeric: size, leading, tracking, weight).
- Colors: **semantic names only** (shadcn/ui names): background foreground foreground-soft card card-foreground popover popover-foreground inverse inverse-foreground primary primary-foreground secondary secondary-foreground tertiary tertiary-foreground muted muted-foreground accent accent-foreground destructive destructive-foreground success success-foreground warning warning-foreground border border-soft input ring scrim white black. Opacity: `bg-primary/50`.
- `bg-blue-500`, `text-gray-600` and every other palette color DO NOT EXIST. Arbitrary values `p-[13px]` `bg-[#123]` are not allowed.
- Variants: `dark:` `ios:` `android:` `web:`. No `hover:`, no `md:`.
- Never write `style={{ color: '#…' }}`. Use `usePalette()` when you need a value in JS.
- JS styles: `[type.title, { color: palette.foreground }]`, `{ borderRadius: shape.card }`, `elevation[2]` (shadow + Android elevation).

### Chrome is always Liquid Glass
- Every screen: `<Screen>` with an `<AppBar>` as a direct child. Content scrolls under the bar.
- Tabs: `<FluxTabs>` in `app/(tabs)/_layout.tsx`. Stacks: `<FluxStack>` in `app/_layout.tsx`.
- iOS: these become the native navigation and tab bars (Liquid Glass on iOS 26+). Android, web: FluxNative UI draws glass.
- There is **no prop to turn glass off**. Reduce Transparency and Increase Contrast switch it to opaque automatically.
- Custom glass (floating buttons, pills): `<Glass.Surface radius={22}>`. Neighbouring glass goes in one `<Glass.Group>`.

### Rules
1. Never animate `opacity` on glass or any parent of glass. Animate `transform` instead.
2. Never nest glass inside glass. Never set `backgroundColor` on glass; use `tint={palette.primary}`.
3. Back navigation: `<AppBar onBack={router.back} />` on every platform (iOS uses the system back button; `backLabel` names it elsewhere). Icon-only buttons need `label` (screen-reader name): `<AppBar.Action label="Search" icon={…} onPress={…} />`.
6. Icons: `<Icon name="bag" size={22} color={palette.foreground} />` with a name from `ICON_NAMES`; `filled` for the selected state. Tabs take `iconName` and need nothing else.
7. `FluxTabs minimize` and `Tab role="search"` are iOS 26+ only; Android and web ignore them. `TabBar` is a Material 3 bar on Android (`shape="bar"`) and a floating pill elsewhere.
4. Use `onPress`, not `onClick`. Use `View`, `Text` and `Pressable`, not `div` and `span`.
5. Pad content above a custom tab bar with `useTabBarInset()`.

### Components
|component|props|
|---|---|
|`Screen`|`scroll?`(true) `scrollEdge?`('automatic'\|'soft'\|'hard'\|'none') `className?` `contentContainerClassName?`|
|`AppBar`|`title?` `onBack?` `backLabel?`('Back') `largeTitle?` `variant?`('regular'\|'clear') — children: `AppBar.Leading`, `AppBar.Trailing`|
|`AppBar.Action`|`label` `icon` `onPress` `disabled?`|
|`TabBar`|`items`({key,label,icon({focused,color}),badge?}[]) `activeKey` `onSelect(key)` `variant?` `shape?`('floating'\|'bar', Android default 'bar')|
|`Glass.Surface`|`radius?` `variant?` `tint?`(color value) `interactive?` `role?`('surface'\|'bar')|
|`Glass.Group`|`spacing?`|
|`FluxTabs`|`minimize?`('automatic'\|'never'\|'onScrollDown'\|'onScrollUp', iOS 26+ only)|
|`FluxTabs.Tab`|`name` `label` `iconName?`(IconName, all platforms) `sf?`(SF Symbol, iOS override) `icon?({focused,color})`(Android/web override) `role?`('search') `badge?`|
|`Icon`|`name`(IconName) `size?`(24) `color?` `strokeWidth?`(2) `filled?` `accessibilityLabel?`|

### Example
```tsx
import { Screen, AppBar, usePalette } from '@fluxnative/ui';
import { Text, View } from 'react-native';

export default function Home() {
  const palette = usePalette();
  return (
    <Screen contentContainerClassName="gap-4 px-4 pb-8">
      <AppBar title="Discover" largeTitle>
        <AppBar.Trailing>
          <AppBar.Action label="Search" icon={<SearchIcon color={palette.foreground} />} onPress={openSearch} />
        </AppBar.Trailing>
      </AppBar>
      <View className="rounded-2xl bg-card p-4">
        <Text className="text-lg font-semibold text-card-foreground">Today</Text>
        <Text className="text-sm text-muted-foreground">3 new arrivals</Text>
      </View>
    </Screen>
  );
}
```

### Docs index
|topic|file|
|---|---|
|glass ladder and tiers|`docs/topics/glass.md`|
|tokens, dark mode, roles, brand files and their validator|`docs/topics/tokens.md`|
|Expo Router setup|`docs/topics/expo-router.md`|
|Flux WebView, runtime styling|`docs/topics/runtime.md`|
|Android chrome, iOS-only props|`docs/topics/android.md`|
|Flux templates: emit, `update` and `check` the catalog layer (tokens, Icon, primitives); forks in `.fluxnative-ui.json`|`docs/topics/catalog.md`|
|AI pack for Flux templates: `flux.ai` host contract, useAiChat/useAiTask, StreamingText, Composer, MessageList, ScanFrame|`docs/topics/ai.md`|
|API stability: what changes in a minor vs a major, deprecation windows|`docs/topics/versioning.md`|
