# Cart and checkout · shopping

**Purpose.** Review the bag and pay: the shopper adjusts quantities, picks delivery and checks out.

**Content.** 3 line items (image URL, name, size, unit price, quantity). Delivery Standard (free, 3 to 5 days) or Express ($12, next day). Promo code "WELCOME10" applied (10% off). Subtotal, delivery, discount and total.

**Required elements.**
- A "Your bag" section title with the item count.
- Each line item: image, name, size, price, a quantity stepper (minus and plus icon-only buttons with labels; minus disabled at 1) and a remove icon-only button.
- Delivery choice as single-select chips.
- The applied promo code as a chip that removes it on press.
- An order summary with right-aligned amounts and a bold total.
- A full-width "Checkout · $total" primary button that shows a spinner while the order is placed.

**States** (`previewState`).
- `live`: the cart as described.
- `loading`: placeholder rows for the line items and the summary.
- `empty`: the bag is empty; a message and a "Start shopping" action.
- `error`: the cart failed to load; a message and a "Try again" action.
