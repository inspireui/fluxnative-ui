# Catalog grid · shopping

**Purpose.** The browse screen of a fashion store: shoppers scan new arrivals by category and save favourites.

**Content.** Title "New in" with the item count. Categories All, Tops, Bottoms, Shoes, Accessories. 8 products, each with name, brand, price, image URL and a saved flag. 2 active filters.

**Required elements.**
- A horizontal row of category chips, exactly one selected; tapping one selects it.
- A filter icon-only button in the header with a badge showing the active filter count.
- A "Trending" section title with a "See all" action above the grid.
- A two-column product grid. Each card shows image, brand, name and price, opens the product on press, and has a heart toggle: an icon-only button with a screen-reader label.
- Cards enter with a short stagger.

**States** (`previewState`).
- `live`: the grid as described.
- `loading`: placeholder blocks in the shape of the chips and cards.
- `empty`: the selected category has no products; a message and a "Clear filters" action.
- `error`: the products failed to load; a message and a "Try again" action.
