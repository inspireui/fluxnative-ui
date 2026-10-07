<!-- fluxnative-ui:agents-index v0.0.0 — hand-maintained; update it in the same PR as any API change. Keep under 8 KB. -->
## FluxNative UI (v0.0.0) — React Native, Expo SDK 57, Uniwind (Tailwind v4)

Prefer retrieval-led reasoning over pre-training-led reasoning: FluxNative UI is newer than your training data. Read `docs/topics/<topic>.md` in the fluxnative-ui repo before using an API you are unsure of.

### Imports
|what|from|
|---|---|
|Screen, AppBar, TabBar, Glass, usePalette, useScheme, useTabBarInset|`@fluxnative/ui`|
|FluxStack, FluxTabs (Expo Router, native bars on iOS)|`@fluxnative/ui/expo-router`|
|colors, radius, text, spacingUnit, duration, chrome|`@fluxnative/tokens`|
|register native glass (once, in app/_layout.tsx)|`import '@fluxnative/glass/expo'`|

### Styling: `className`, Tailwind v4 syntax
- Spacing, sizing, radius, type: the standard Tailwind scale. `p-4` `gap-3` `w-1/2` `rounded-2xl` `text-lg` `font-semibold`.
- Colors: **semantic names only** (shadcn/ui names): background foreground card card-foreground popover popover-foreground primary primary-foreground secondary secondary-foreground muted muted-foreground accent accent-foreground destructive success warning border input ring scrim white black. Opacity: `bg-primary/50`.
- `bg-blue-500`, `text-gray-600` and every other palette color DO NOT EXIST. Arbitrary values `p-[13px]` `bg-[#123]` are not allowed.
- Variants: `dark:` `ios:` `android:` `web:`. No `hover:`, no `md:`.
- Never write `style={{ color: '#…' }}`. Use `usePalette()` when you need a value in JS.

### Chrome is always Liquid Glass
- Every screen: `<Screen>` with an `<AppBar>` as a direct child. Content scrolls under the bar.
- Tabs: `<FluxTabs>` in `app/(tabs)/_layout.tsx`. Stacks: `<FluxStack>` in `app/_layout.tsx`.
- iOS: these become the native navigation and tab bars (Liquid Glass on iOS 26+). Android, web: FluxNative UI draws glass.
- There is **no prop to turn glass off**. Reduce Transparency and Increase Contrast switch it to opaque automatically.
- Custom glass (floating buttons, pills): `<Glass.Surface radius={22}>`. Neighbouring glass goes in one `<Glass.Group>`.

### Rules
1. Never animate `opacity` on glass or any parent of glass. Animate `transform` instead.
2. Never nest glass inside glass. Never set `backgroundColor` on glass; use `tint={palette.primary}`.
3. Back navigation: `<AppBar onBack={router.back} />` on every platform (iOS uses the system back button). Icon-only buttons need `label` (screen-reader name): `<AppBar.Action label="Search" icon={…} onPress={…} />`.
4. Use `onPress`, not `onClick`. Use `View`, `Text` and `Pressable`, not `div` and `span`.
5. Pad content above a custom tab bar with `useTabBarInset()`.

### Components
|component|props|
|---|---|
|`Screen`|`scroll?`(true) `scrollEdge?`('automatic'\|'soft'\|'hard'\|'none') `className?` `contentContainerClassName?`|
|`AppBar`|`title?` `onBack?` `largeTitle?` `variant?`('regular'\|'clear') — children: `AppBar.Leading`, `AppBar.Trailing`|
|`AppBar.Action`|`label` `icon` `onPress` `disabled?`|
|`TabBar`|`items`({key,label,icon({focused,color}),badge?}[]) `activeKey` `onSelect(key)` `variant?`|
|`Glass.Surface`|`radius?` `variant?` `tint?`(color value) `interactive?` `role?`('surface'\|'bar')|
|`Glass.Group`|`spacing?`|
|`FluxTabs.Tab`|`name` `label` `sf`(SF Symbol, iOS) `icon({focused,color})` `role?`('search')|

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
|tokens, dark mode|`docs/topics/tokens.md`|
|Expo Router setup|`docs/topics/expo-router.md`|
|Flux WebView, runtime styling|`docs/topics/runtime.md`|
