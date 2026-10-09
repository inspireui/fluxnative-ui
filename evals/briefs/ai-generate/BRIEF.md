# AI image generation · creative

**Purpose.** Turn a text prompt into images: write a prompt, generate, keep the good ones.

**Content.** Prompt "A lighthouse at dusk, watercolor". Styles Photo, Watercolor, 3D, Anime. Aspect ratios 1:1, 4:5, 16:9. 4 result images (image URLs). 12 of 50 credits left, 1 credit per image.

**Required elements.**
- A multiline prompt field with a character count, and example prompts as chips while it is empty.
- Style and aspect ratio as single-select chips.
- A full-width "Generate · 4 credits" primary button.
- While generating: a progress bar with a percentage, tiles that appear as they finish, and a "Cancel" button.
- Results in a 2 × 2 grid; each image has a save icon-only button with a screen-reader label; a "Regenerate" button under the grid.

**States** (`previewState`).
- `live`: four results for the prompt.
- `loading`: placeholder tiles while recent generations load.
- `empty`: no generations yet; the prompt field and the example chips.
- `error`: the generation failed; a message and a "Try again" action, the prompt kept.
- `streaming`: generating, 60% done, two tiles finished, with Cancel.
- `quota`: out of credits; Generate disabled, a message and a "Get credits" button.
