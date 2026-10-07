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
import '@flux-ui/glass/expo';
import { FluxStack } from '@flux-ui/core/expo-router';

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
import { FluxTabs } from '@flux-ui/core/expo-router';

export default function TabsLayout() {
  return (
    <FluxTabs minimize="onScrollDown">
      <FluxTabs.Tab name="index" label="Home" sf="house" icon={({ color }) => <HomeIcon color={color} />} />
      <FluxTabs.Tab name="search" label="Search" sf="magnifyingglass" role="search" icon={…} />
    </FluxTabs>
  );
}
```

## What renders where

| | iOS | Android, web |
|---|---|---|
| `FluxTabs` | System tab bar (`NativeTabs`): Liquid Glass, minimize on scroll, search role | Flux UI floating glass `TabBar` |
| `AppBar` in a `FluxStack` screen | System navigation bar, large titles, native back button | Flux UI glass `AppBar` |
| `AppBar` in a tab screen | Flux UI glass `AppBar` (wrap the tab in its own `FluxStack` for the system bar) | Flux UI glass `AppBar` |

## Rules

- Pass `onBack={router.back}` on pushed screens. iOS ignores it and keeps the system back button and swipe.
- `sf` names an SF Symbol and is used only on iOS. `icon` is used everywhere else. Give both.
- `Screen` already pads content clear of the bars. Don't add safe-area padding yourself.
