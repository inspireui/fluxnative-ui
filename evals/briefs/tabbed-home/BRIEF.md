# Tabbed home · news

**Purpose.** The home screen of a news app, with section tabs at the top.

**Content.** Sections Top, World, Tech, Science, Sport. A featured story (image URL, kicker, headline, source, minutes ago). 6 more stories per section (thumbnail URL, headline, source, time, read time, saved flag).

**Required elements.**
- A header with today's date and a profile icon-only button.
- Section tabs as a horizontal row of chips with the tab role; one selected; switching changes the list.
- A large featured story card that opens the story.
- A "Latest" section title with a "See all" action, then story rows: thumbnail, headline (2 lines at most), source and time, and a bookmark icon-only button with a screen-reader label that toggles saved.
- Stories enter with a short stagger; pull to refresh.

**States** (`previewState`).
- `live`: the Top section.
- `loading`: placeholder blocks for the featured card and the rows.
- `empty`: the section has no stories; a message and a "Browse Top stories" action.
- `error`: offline; an inline banner with "Retry" above the cached stories.
