# Versioning and API stability

Language models learn FluxNative UI's names from public code and docs, often
months before someone asks one to write an app. A rename that a person adapts
to in a day keeps showing up in generated code for a year. So the API changes
slowly, minor releases only add, and a break is announced long before it
lands.

All `@fluxnative/*` packages share one version number (a Changesets fixed
group): `@fluxnative/ui@1.4.0` goes with `@fluxnative/tokens@1.4.0`.

## Rules

1. **Minor releases are additive only.** They add components, props,
   string-union members, tokens and icons. They never rename, remove or
   narrow anything, and never change what an existing name means.
2. **Renames and removals happen only in a major release**, and there are at
   most one or two majors a year.
3. **Deprecate first.** A deprecated name keeps working for at least 6 months
   and at least 2 minor releases. It is typed `@deprecated`, not `never`, so
   existing code still compiles while editors strike the name through.
4. **Then it becomes `never`**, with a message that names the replacement.
   Code that still uses it fails to type-check, and the message says what to
   write instead.
5. **A name is never reused for a new meaning**, not even after it was
   removed.
6. **Every rename ships a codemod and an autofix rule.** (The autofix rule
   belongs in the ESLint plugin, which does not exist yet.)
7. **`docs/llm/AGENTS.index.md` changes with the API.** It states the version
   it describes, and it is updated in the same pull request as any
   user-visible API change.
8. **The catalog layer follows the same rules.** The files that
   `fluxnative-catalog emit` writes into a template are public API too. A
   template that changes an emitted file on purpose declares that fork in its
   `.fluxnative-ui.json`.

## A rename, step by step

`oldName` and `newName` stand for any prop, component, token or icon.

```ts
// 1.4.0 (minor): add the new name, deprecate the old one. Both work.
interface ExampleProps {
  newName?: string;
  /** @deprecated Use `newName`. */
  oldName?: string;
}

// 2.0.0 (major, at least 6 months and 2 minors later): the old name is `never`.
interface ExampleProps {
  newName?: string;
  /** @deprecated Removed in 2.0. Use `newName`. */
  oldName?: never;
}
```

The 1.4.0 release also ships the codemod and the autofix rule, and its
`AGENTS.index.md` lists only `newName`.

## Before 1.0

The packages are 0.x and not on npm yet. Semver lets any 0.x minor break,
and FluxNative UI still renames things before 1.0, so the deprecation window
(rules 2 to 4) starts at 1.0. What already holds in 0.x:

- Breaking changes land only in a 0.x minor (0.1 to 0.2), never in a patch,
  and each one is described in its changeset.
- A name is never reused for a new meaning.
- `AGENTS.index.md` is updated in the same pull request as the API.

Until 1.0, pin exact versions (`"0.1.0"`, not `"^0.1.0"`) and read the
changelog before upgrading.
