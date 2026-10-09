# Product detail · shopping

**Purpose.** One product page of a fashion store: the shopper picks a size and adds the item to the bag.

**Content.** "Linen overshirt" by Atelier Nord, $89, rating 4.6 from 212 reviews, 3 photos (image URLs), colours Sand, Olive and Navy, sizes XS to XL with XL sold out, a two-sentence description.

**Required elements.**
- A full-width photo with back, share and save (heart) icon-only buttons floating over it, each with a screen-reader label.
- Name, brand, price and a star rating row.
- Colour options as chips labelled with the colour name (no swatches).
- Size options as round chips, single choice; the sold-out size is crossed out and can't be picked.
- A "Size guide" action that opens a bottom sheet with a size, chest and length table.
- A full-width "Add to bag" primary button pinned at the bottom, disabled until a size is chosen.

**States** (`previewState`).
- `live`: the page as described.
- `loading`: placeholder blocks for the photo, title, price and size row.
- `empty`: the product was removed; a message and a "Browse similar" action.
- `error`: the product failed to load; a message and a "Try again" action.
