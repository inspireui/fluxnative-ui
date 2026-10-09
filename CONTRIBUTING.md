# Contributing to FluxNative UI

Thanks for helping. Bug reports, docs fixes and pull requests are welcome. For
anything bigger than a fix, open an issue first so the API can be agreed on:
names are hard to change once models have learned them (see
[API stability](#api-stability)).

## Setup

You need Node.js 22 (see `.node-version`) and pnpm. Corepack installs the pnpm
version pinned in `package.json`:

```bash
corepack enable   # Node 25 and later don't ship Corepack: run `npm install -g corepack` first
pnpm install
```

## Checks

Run these before you open a pull request. CI runs the first line.

```bash
pnpm test && pnpm typecheck && pnpm tokens:check
cd apps/expo-example && npx expo export --platform web && npx expo export --platform ios
```

- Changed a token file? Run `pnpm tokens` and commit what it regenerates.
  Never edit generated files by hand.
- Changed a user-visible API? Update `docs/llm/AGENTS.index.md` in the same
  pull request and keep it under 8 KB.

## Changesets

Every change to a published package needs a changeset:

```bash
pnpm changeset
```

Pick the packages and the bump, and write one or two sentences for the
changelog. Before 1.0, anything breaking is a `minor`, never a `patch`.
Changes to docs, CI or the example app alone don't need one. All
`@fluxnative/*` packages are released together with one version number.

## Sign off your commits (DCO)

Contributions are accepted under the
[Developer Certificate of Origin 1.1](https://developercertificate.org/). By
signing off a commit you certify that you wrote it, or otherwise have the right
to submit it under the project's license:

```bash
git commit -s -m "docs: fix a typo in glass.md"
```

`-s` adds a `Signed-off-by: Your Name <you@example.com>` line. If you forgot:
`git commit --amend -s` fixes the last commit, and `git rebase --signoff main`
fixes a whole branch.

## API stability

Models keep writing a name long after it changes, so the API moves slowly. In
short:

- minor releases only add; renames and removals wait for a major release, and
  there are at most one or two a year;
- a deprecated name keeps working for at least 6 months and 2 minor releases,
  then becomes `never` with a message that names the replacement;
- a name is never reused for a new meaning, and every rename ships a codemod
  and an autofix rule;
- `docs/llm/AGENTS.index.md` changes in the same pull request as the API.

The deprecation window starts at 1.0. The full policy, and what applies during
0.x, is in [docs/topics/versioning.md](docs/topics/versioning.md).

## Coding agents

If a coding agent writes your change, point it at [AGENTS.md](AGENTS.md): it
has this repo's layout, rules and checks. `docs/llm/AGENTS.index.md` is a
different file, written for apps that *use* FluxNative UI.

## Pull requests

- One topic per pull request, with a conventional-commit title
  (`fix(glass): …`, `feat(ui): …`, `docs: …`).
- Fill in the checklist in the pull request template.

## Security

Never report a vulnerability in a public issue. See [SECURITY.md](SECURITY.md).

## License

By contributing, you agree that your contributions are licensed under the
[MIT License](LICENSE).
