---
"@fluxnative/icons": patch
"@fluxnative/catalog": patch
---

`Icon` no longer passes `accessible` / `accessibilityLabel` / `accessibilityRole` to `<Svg>`: react-native-svg's web build forwards unknown props to the DOM `<svg>` and React logs "Received `false` for a non-boolean attribute `accessible`" for every icon. A decorative icon is now a bare `<Svg>`; a labelled one is wrapped in a `View` that carries the accessibility props (role `image`). Same change in the catalog-emitted `components/Icon.tsx`.
