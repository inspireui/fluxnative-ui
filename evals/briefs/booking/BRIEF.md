# Booking · events

**Purpose.** Book concert tickets: pick a date, choose ticket types and confirm.

**Content.** "Lumen Orchestra Live" at Riverside Hall. Dates Fri 14, Sat 15 and Sun 16 June (Sunday sold out). Tickets Standard $45, Balcony $65, VIP $120 (2 left). Booking fee $3 per ticket.

**Required elements.**
- An event header: image URL, title, venue with a pin icon, and a back icon-only button.
- Dates as single-select chips; the sold-out date is crossed out and can't be picked.
- A "Tickets" section title; each ticket type with name, price, a note and a quantity stepper (minus and plus icon-only buttons with labels; at most 6 per type, VIP at most 2).
- A total line and a full-width "Book N tickets · $total" primary button, disabled at zero tickets.
- Booking opens a bottom sheet that sums up the order, with "Confirm and pay" and "Edit" buttons.

**States** (`previewState`).
- `live`: Saturday picked, 2 Standard tickets.
- `loading`: placeholder blocks for the header, dates and ticket rows.
- `empty`: every date is sold out; a message and a "Join the waitlist" action.
- `error`: availability failed to load; a message and a "Try again" action.
