---
"@fluxnative/catalog": patch
---

The emitted `Icon` puts `style` on a wrapping `View` instead of `<Svg>`, so FluxNative's web preview typecheck no longer rejects it (`StyleProp<ViewStyle>` is not react-native-svg's style type there).
