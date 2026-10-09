## What and why

<!-- One or two sentences. Link the issue: "Fixes #123". -->

## Checklist

- [ ] `pnpm test` passes
- [ ] `pnpm typecheck` passes
- [ ] `pnpm tokens:check` passes (after a token change, `pnpm tokens` was run and its output committed)
- [ ] User-visible API change: `docs/llm/AGENTS.index.md` is updated in this PR, or there is no API change
- [ ] Renames and removals follow [`docs/topics/versioning.md`](https://github.com/inspireui/fluxnative-ui/blob/main/docs/topics/versioning.md), or there are none
- [ ] Changeset added (`pnpm changeset`), or not needed (docs, CI or example app only)
- [ ] Every commit is signed off (`git commit -s`, [DCO](https://developercertificate.org/))
