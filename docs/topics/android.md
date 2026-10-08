# Android

FluxNative UI draws its own chrome on Android. This page says what that
chrome looks like, how it sits against the system bars, and which iOS-only
props Android ignores.

## System bars

Expo SDK 57 apps are edge-to-edge on Android: content draws under the status
and navigation bars, and `react-native-safe-area-context` reports their
heights as insets. FluxNative UI assumes that and nothing else:

- `Screen` pads its content clear of the status bar and of the `AppBar`.
- `TabBar` adds `insets.bottom` to its own height so the Material 3 bar sits
  on the gesture area, and `useTabBarInset()` includes it.
- Set the bar styles with `expo-status-bar` (`<StatusBar style="auto" />`);
  FluxNative UI never sets `translucent` or a bar colour. If an app opts out
  of edge-to-edge, the insets become 0 and the chrome still lines up.

## Chrome shapes

| | Android | iOS | web |
|---|---|---|---|
| `AppBar` | FluxNative UI glass bar (`translucent` tier today) | system navigation bar in a `FluxStack`, else FluxNative UI glass | FluxNative UI glass (`blur` tier) |
| `TabBar` default `shape` | `bar`: an edge-to-edge glass bar in the Material 3 navigation-bar form, 80 px + inset | not drawn (system tab bar) | `floating`: an inset glass pill |
| custom `Glass.Surface` | `translucent` fill + rim + sheen (no blur, see Known gaps) | `native-glass` / `blur` | `blur` |

`TabBar shape="floating"` is allowed on Android; `defaultTabBarShape()` only
chooses the default. Pass the same `shape` to `useTabBarInset(shape)`.

## iOS-only props Android ignores

| prop | on Android |
|---|---|
| `FluxTabs minimize` | ignored (the floating `TabBar` never minimises) |
| `FluxTabs.Tab sf` | ignored; `iconName` or `icon` draws the glyph |
| `FluxTabs.Tab role="search"` | ignored; the tab is a normal tab |
| `AppBar largeTitle` | drawn by FluxNative UI (a larger title row), not by the system |

## Not yet

- **No blur tier.** expo-blur on Android needs a `BlurTargetView` around the
  blurred content; until the adapter supports that, custom glass is
  `translucent`. The tier moves to `blur` automatically when it lands.
- **Predictive back** is the navigator's job (`react-native-screens`); FluxNative
  UI adds nothing.
