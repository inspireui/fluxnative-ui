# Stats dashboard · finance

**Purpose.** The spending overview of a personal finance app: where did the money go this period?

**Content.** Balance $4,218.40. Periods Week, Month, Year (Month selected). Spent $1,932 against $2,105 last month (8% less). Daily spend for 7 days. Categories Groceries $412, Rent $900, Transport $164, Dining $238, Shopping $218. 5 recent transactions (merchant, category, date, amount).

**Required elements.**
- A balance header with the change against last period, coloured by meaning (good or bad).
- The period as single-select chips.
- A bar chart of daily spend drawn with views or react-native-svg, with a screen-reader summary.
- A "By category" section: each category with an icon, its amount and a share bar.
- A "Recent" section title with a "See all" action, then tappable transaction rows.
- Cards enter with a short stagger.

**States** (`previewState`).
- `live`: the dashboard as described.
- `loading`: placeholder blocks for the balance, chart and rows.
- `empty`: no transactions this period; a message and an "Add a transaction" action.
- `error`: the data failed to load; a message and a "Try again" action.
