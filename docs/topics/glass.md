# Glass

FluxNative UI chrome is always glass. A surface's **tier** depends on the device and the user's settings. App code never chooses it.

| Tier | When | Rendered with |
|---|---|---|
| `native-bar` | An `AppBar` inside `FluxStack`, on iOS | The system navigation bar: Liquid Glass on iOS 26+, chrome material before that |
| `native-glass` | iOS 26+ (UIGlassEffect) | `expo-glass-effect` `GlassView` |
| `blur` | iOS < 26, web | `expo-blur` on iOS; `backdrop-filter` on the web |
| `translucent` | No blur (Android today, hosts without an adapter) | A tinted fill with a rim and a sheen |
| `opaque` | Reduce Transparency or Increase Contrast is on | A solid surface with a visible border |

## Custom glass

Use custom glass for things that float: a floating action button, a pill or a mini player.

```tsx
<Glass.Group spacing={8}>
  <Glass.Surface radius={22} interactive>
    <Pressable onPress={play} accessibilityLabel="Play">…</Pressable>
  </Glass.Surface>
</Glass.Group>
```

`Glass.Surface` props:
- `radius`
- `variant` (`regular` or `clear`; `clear` only over photos and video)
- `tint` (a palette value, e.g. `palette.primary`)
- `interactive`
- `role` (`surface` or `bar`)
- `tier` (forced; for tests and screenshots only)

`useGlassTier(role?)` returns the tier a surface would get on this device.

## Rules

- Never animate `opacity` on glass or any of its parents. iOS stops drawing glass under a faded parent. Animate `transform` instead.
- Never put glass inside glass. Wrap neighbouring glass in one `Glass.Group`; on iOS 26 the group also morphs between its members.
- Never set `backgroundColor` on glass. Use `tint`.
- Don't use glass for content such as cards and list rows. Glass is the navigation layer.
