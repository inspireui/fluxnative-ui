# Settings · productivity

**Purpose.** The settings screen of a notes app: account, preferences and sign-out.

**Content.** Profile Mai Tran, mai@example.com, Pro plan. Groups: Account (Profile, Subscription "Pro", Devices "3"), Preferences (Notifications on, Sync over cellular off, Language "English"), Appearance (Light, Dark, System), Support (Help center, Send feedback).

**Required elements.**
- A profile row at the top: initials avatar, name, email and a chevron; it opens the profile.
- Grouped rows under section titles; each tappable row has a leading icon, a label, an optional value and a chevron.
- On/off preferences use a switch.
- Appearance as three single-select chips.
- A destructive "Sign out" button at the bottom that opens a bottom sheet asking for confirmation, with "Sign out" and "Cancel" buttons.

**States** (`previewState`).
- `live`: every group as described.
- `loading`: placeholder rows in the shape of the groups.
- `empty`: signed out; a message and a "Sign in" action, no account group.
- `error`: settings failed to sync; an inline banner with "Retry" above the groups, which stay visible.
