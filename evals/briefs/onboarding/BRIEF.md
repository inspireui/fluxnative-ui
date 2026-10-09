# Onboarding · health and fitness

**Purpose.** The goals step of a fitness app's onboarding: the user picks goals so the app can build a weekly plan.

**Content.** Step 2 of 3. Title "What are your goals?". Goals (pick up to 3): Lose weight, Build strength, Sleep better, Run a 5K, Reduce stress, Eat healthier. Activity level: Beginner, Intermediate, Advanced.

**Required elements.**
- A progress indicator for step 2 of 3 and a "Skip" text action at the top.
- Goals as multi-select chips, each with a leading icon; a fourth pick is refused with a short hint.
- Activity level as single-select options.
- A full-width "Continue" primary button, disabled until a goal is picked, and a "Back" text button.
- The content enters with a short stagger.

**States** (`previewState`).
- `live`: two goals and one level picked.
- `loading`: after Continue, "Building your plan" with placeholder blocks for the plan.
- `empty`: nothing picked yet; Continue disabled and a hint.
- `error`: the goals failed to save; a message and a "Try again" action.
