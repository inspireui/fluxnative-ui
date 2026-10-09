# Inbox · communication

**Purpose.** The conversation list of a team messaging app.

**Content.** 8 conversations (name, avatar initials, last message, time, unread count, muted flag): 3 unread, 1 mention. Filters All, Unread, Mentions.

**Required elements.**
- A title "Inbox" with a compose icon-only button (filled, with a screen-reader label).
- Filters as single-select chips.
- Conversation rows: initials avatar, name, one-line preview, time and an unread badge. Unread rows use a bolder name; muted rows are dimmed.
- Tapping a row opens it; a long press opens a bottom sheet with Mark as read, Mute, Archive and Delete (destructive) actions.
- Rows enter with a short stagger.

**States** (`previewState`).
- `live`: the list as described.
- `loading`: placeholder rows.
- `empty`: no conversations in the selected filter; a message and a "Start a conversation" action.
- `error`: messages failed to load; a message and a "Try again" action.
