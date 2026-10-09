# Search and filters · travel

**Purpose.** Search stays for a trip and narrow the results with filters.

**Content.** Query "Lisbon", 12 to 16 May, 2 guests. Recent searches Porto, Seville, Madeira. 6 stays (photo URL, name, area, rating, price per night). Filters: price Under $100, $100 to $200, $200+; type Hotel, Apartment, Hostel; rating 4+.

**Required elements.**
- A search field with a search icon and a clear button; dates and guests as a summary line under it.
- Recent searches as chips that fill the field.
- A filter icon-only button with a badge of active filters. It opens a bottom sheet with the filter groups as chips, a "Clear all" action in its header and a "Show N stays" primary button in its footer.
- Result cards: photo, name, area, rating with a star icon and price per night; tapping opens the stay; a save icon-only button with a screen-reader label.

**States** (`previewState`).
- `live`: results for "Lisbon" with two filters active.
- `loading`: placeholder result cards.
- `empty`: no stays match; a message and a "Clear filters" action.
- `error`: the search failed; a message and a "Try again" action.
