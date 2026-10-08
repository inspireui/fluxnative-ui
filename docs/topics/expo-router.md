# Expo Router setup

```text
src/
  global.css              generated from the tokens
  app/
    _layout.tsx           FluxStack (root)
    (tabs)/_layout.tsx    FluxTabs
    (tabs)/index.tsx      a screen: <Screen> + <AppBar>
    detail.tsx            a pushed screen
```

```tsx
// src/app/_layout.tsx
import '../global.css';
import '@fluxnative/glass/expo';
import { FluxStack } from '@fluxnative/ui/expo-router';

export default function RootLayout() {
  return (
    <FluxStack>
      <FluxStack.Screen name="(tabs)" />
      <FluxStack.Screen name="detail" />
    </FluxStack>
  );
}
```

```tsx
// src/app/(tabs)/_layout.tsx
import { FluxTabs } from '@fluxnative/ui/expo-router';

export default function TabsLayout() {
  return (
    <FluxTabs minimize="onScrollDown">
      <FluxTabs.Tab name="index" label="Home" iconName="home" />
      <FluxTabs.Tab name="search" label="Search" iconName="search" role="search" />
      <FluxTabs.Tab name="you" label="You" sf="person.crop.circle" icon={({ color }) => <Avatar color={color} />} />
    </FluxTabs>
  );
}
```

## What renders where

| | iOS | Android, web |
|---|---|---|
| `FluxTabs` | System tab bar (`NativeTabs`): Liquid Glass, minimize on scroll, search role | FluxNative UI floating glass `TabBar` |
| `AppBar` in a `FluxStack` screen | System navigation bar, large titles, native back button | FluxNative UI glass `AppBar` |
| `AppBar` in a tab screen | FluxNative UI glass `AppBar` (wrap the tab in its own `FluxStack` for the system bar) | FluxNative UI glass `AppBar` |

## Rules

- Pass `onBack={router.back}` on pushed screens. iOS ignores it and keeps the system back button and swipe. `backLabel` names the back control for screen readers on the other platforms.
- `iconName` is one name from the `@fluxnative/icons` table and covers every platform: the SF Symbol on iOS, the SVG glyph (filled when focused) on Android and web. `sf` (iOS) and `icon` (Android, web) override it per platform; a tab with neither and no `iconName` has no icon.
- `minimize` and `role="search"` are iOS 26+ only. Android and web ignore them (see `docs/topics/android.md`).
- `Screen` already pads content clear of the bars. Don't add safe-area padding yourself.
