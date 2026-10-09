# AI scan · plant identifier

**Purpose.** Point the camera at a plant, capture, and get an identification with a confidence score.

**Content.** A camera view (a placeholder area: a template has no camera API). Result Monstera deliciosa, "Swiss cheese plant", 92% confidence; care: water weekly, bright indirect light, toxic to pets; alternatives Philodendron 5%, Pothos 3%. 3 free scans a day.

**Required elements.**
- A viewfinder with framing corners, a close icon-only button, a flash toggle icon-only button and a hint line.
- A large capture icon-only button with a screen-reader label.
- While analysing: the captured frame dimmed, a progress indicator and a "Cancel" button.
- The result in a bottom sheet over the viewfinder: name, common name, a confidence bar with the percentage, care facts with icons, alternatives as chips, and a "Scan again" button.

**States** (`previewState`).
- `live`: the result sheet open.
- `loading`: analysing the capture.
- `empty`: the camera is ready, nothing captured.
- `error`: no plant recognised; a message and a "Try again" action.
- `streaming`: the result arriving: the name shown, the care facts still placeholders.
- `quota`: today's scans are used; capture disabled, a message and an "Upgrade" button.
