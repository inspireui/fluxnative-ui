# AI chat · assistant

**Purpose.** The conversation screen of an AI assistant app.

**Content.** Assistant "Nova". A 4-message conversation about planning a weekend in Kyoto. Suggestions "Plan a trip", "Summarise an article", "Draft an email", "Explain a concept". Free plan: 20 messages a day.

**Required elements.**
- A message list: user messages right-aligned on the primary colour, assistant messages left-aligned on a muted surface, each assistant message with a copy icon-only button.
- A composer: a multiline text field and a send icon-only button (labelled, disabled while empty).
- While a reply streams: the partial text with a blinking caret, and a stop icon-only button in place of send.
- Suggestion chips that fill the composer.
- New messages fade in.

**States** (`previewState`).
- `live`: the finished conversation.
- `loading`: placeholder bubbles while the history loads.
- `empty`: a new conversation: a greeting and the suggestion chips.
- `error`: the last reply failed; an inline message with "Retry" under the last user message.
- `streaming`: the assistant's reply arriving, with the stop button.
- `quota`: today's 20 messages are used; composer disabled, a message and an "Upgrade" button.
