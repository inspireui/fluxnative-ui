---
'@fluxnative/catalog': minor
---

The primitives read token contract v0.1, and four recipes join the catalog.

- Defaults come from `theme/tokens`: `Press` takes its haptic, press scale, hit slop and spring from `interaction.press`; `Reveal` its offset, duration and stagger from `interaction.reveal`; `Skeleton` its mode, colours and timing from `interaction.skeleton`, with a new `color` mode that pulses between two palette roles. Text uses `type` roles and corners `shape` roles (`Button`, `Chip`, `IconButton`, `Sheet`, `StateView`, `SectionHeader`, the `Skeleton` default radius). With the kit's tokens nothing changes on screen; a test renders every primitive against its previous source to prove it. A brand that changes a role or the profile now restyles them.
- `Button`: `size="xl"` (60 px), `labelRole` (a `type` role, used as is), and the exported comp table `buttonHeight`.
- `IconButton`: `variant="outline-on-surface"` (a `card` face with a hairline ring), `badge` also takes a boolean (`true` draws a dot, `false` hides it), `dot`, and a count or text badge now joins the screen-reader name ("Bag, 3"). Hit slop and corners follow the profile and `shape.control`.
- `StateView`: `variant` (`'inline'`, the same as `inline`, or `'card'`) and `badge` (an icon in an `accent` circle above the title). A title on a card surface (banner or card) is drawn in `card-foreground`.
- New recipes: `useCountUp(target, { duration?, delay?, enabled? })`, `Toggle`, `Snackbar` and `commerce/ProductCard` (emitted as `components/commerce/ProductCard.tsx`, with `formatPrice`).
- `emit`, `update` and `check` handle a component in a sub-folder: its name is its file's base name (`--only ProductCard`), and two components with one name are refused.

Visual: none with the kit's tokens.
