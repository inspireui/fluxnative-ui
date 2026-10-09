// `fluxnative-catalog update` and `check`. Both read the template's
// `.fluxnative-ui.json`. A file whose bytes still match its manifest hash is
// pristine: `update` replaces it with the current catalog copy. Anything else
// is drift, which `update` reports with a diff (or, with `--merge`, merges
// three ways against an earlier emitted copy) and never overwrites. Forks and
// compositions belong to the template and are never written.

import { existsSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { unifiedDiff } from './diff.ts';
import { CATALOG_VERSION, FILES_DIR, componentDeps, render, type RenderOptions } from './emit.ts';
import { mergeFile } from './git.ts';
import { CATALOG_REPO, MANIFEST_FILE, loadManifest, renderManifest, sha256, sortKeys, type Manifest } from './manifest.ts';
import { validateOverrides, type ColorOverrides } from './tokens.ts';

const toPosix = (path: string) => path.split(sep).join('/');
const isComponent = (path: string) => path.startsWith('components/');
const componentName = (path: string) => path.replace(/^components\//, '').replace(/\.tsx?$/, '');
const sorted = (paths: Iterable<string>) => [...new Set(paths)].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
const has = (record: Record<string, unknown>, key: string) => Object.prototype.hasOwnProperty.call(record, key);
/** `record[key]` for own keys only: paths are data, never `toString` or `constructor`. */
const own = <T>(record: Record<string, T>, key: string): T | undefined => (has(record, key) ? record[key] : undefined);

function sameDir(a: string, b: string): boolean {
  try {
    return realpathSync(a) === realpathSync(b);
  } catch {
    return resolve(a) === resolve(b);
  }
}

/** The files dir to work on; refuses this package's own `files/`, which `build` owns. */
export function templateDir(to: string, cwd = process.cwd()): string {
  const target = resolve(cwd, to);
  if (sameDir(target, FILES_DIR)) throw new Error(`--to ${to} is @fluxnative/catalog's own files/; regenerate it with \`fluxnative-catalog build\``);
  return target;
}

function requireManifest(target: string, to: string): Manifest {
  const loaded = loadManifest(join(target, MANIFEST_FILE));
  if (loaded === null) throw new Error(`${to} has no ${MANIFEST_FILE}: run \`fluxnative-catalog emit --to ${to}\` first`);
  return loaded.manifest;
}

// ---------------------------------------------------------------- inputs

/** What the template's files are rendered from, besides the catalog itself. */
export interface TemplateInputs {
  overrides?: ColorOverrides;
  /** The overrides file relative to the files dir, or null when there are none. */
  colorsPath: string | null;
}

function readJson(file: string, label: string): unknown {
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch (error) {
    throw new Error(`${label}: ${(error as Error).message}`);
  }
}

/**
 * `--colors` when given (relative to `cwd`); otherwise the manifest's
 * `colorsPath` (relative to the files dir) when that file exists. Throws when
 * the manifest records overrides whose file can no longer be found.
 */
export function resolveInputs(target: string, manifest: Manifest, colors?: string, cwd = process.cwd()): TemplateInputs {
  let file: string | undefined;
  if (colors !== undefined) {
    file = resolve(cwd, colors);
    if (!existsSync(file)) throw new Error(`--colors: ${colors} does not exist`);
  } else if (manifest.inputs.colorsPath !== null && existsSync(resolve(target, manifest.inputs.colorsPath))) {
    file = resolve(target, manifest.inputs.colorsPath);
  } else if (manifest.inputs.colors !== null) {
    throw new Error(
      manifest.inputs.colorsPath === null
        ? `${MANIFEST_FILE} records colour overrides but not their file (schema 1 manifests never do): pass --colors <colors.json> once`
        : `${MANIFEST_FILE} records colour overrides from ${manifest.inputs.colorsPath}, which is gone: restore it or pass --colors`,
    );
  }
  if (file === undefined) return { colorsPath: null };
  const label = relative(cwd, file) || file;
  return { overrides: validateOverrides(readJson(file, label), label), colorsPath: toPosix(relative(target, file)) };
}

function renderOptions(inputs: TemplateInputs, commit: string | null): RenderOptions {
  const colorsPath = inputs.colorsPath ?? undefined;
  return { overrides: inputs.overrides, overridesLabel: colorsPath, colorsPath, commit };
}

// ------------------------------------------------------------------ --only

/** An `--only` argument: absent, a new list (`A,B`), or changes to the current one (`+A,-B`). */
export type OnlyChange = { kind: 'keep' } | { kind: 'set'; names: string[] } | { kind: 'edit'; add: string[]; remove: string[] };

export function parseOnly(arg: string | undefined): OnlyChange {
  if (arg === undefined) return { kind: 'keep' };
  const items = arg.split(',').map((item) => item.trim()).filter(Boolean);
  if (items.length === 0) throw new Error('--only: expected component names (A,B) or changes to the selection (+A,-B)');
  const signed = items.filter((item) => item.startsWith('+') || item.startsWith('-'));
  if (signed.length === 0) return { kind: 'set', names: [...new Set(items)] };
  if (signed.length !== items.length) throw new Error(`--only: either list the components (A,B) or change the selection (+A,-B), not both: ${arg}`);
  const names = (prefix: string) => [...new Set(items.filter((item) => item.startsWith(prefix)).map((item) => item.slice(1).trim()))];
  const add = names('+');
  const remove = names('-');
  if ([...add, ...remove].some((name) => name === '')) throw new Error(`--only: a + or - needs a component name: ${arg}`);
  return { kind: 'edit', add, remove };
}

/**
 * The selection after `change`, given the catalog's component names. Names
 * the catalog no longer has are dropped from a kept selection, with a warning.
 */
export function applyOnly(current: string[] | null, change: OnlyChange, known: string[]): { only: string[] | null; warnings: string[] } {
  const warnings: string[] = [];
  const unknown = (names: string[]) => names.filter((name) => !known.includes(name));
  const fail = (names: string[]) => new Error(`--only: unknown component(s) ${names.join(', ')}. Known: ${known.join(', ')}`);
  if (change.kind === 'set') {
    if (unknown(change.names).length) throw fail(unknown(change.names));
    return { only: change.names, warnings };
  }
  let names = current;
  const gone = unknown(names ?? []);
  if (names !== null && gone.length) {
    warnings.push(`--only: ${gone.join(', ')} ${gone.length === 1 ? 'is' : 'are'} no longer in the catalog; dropped from the selection`);
    names = names.filter((name) => known.includes(name));
    if (names.length === 0) throw new Error(`--only: nothing is left of the selection without ${gone.join(', ')}; pass --only A,B`);
  }
  if (change.kind === 'keep') return { only: names, warnings };
  if (unknown(change.add).length) throw fail(unknown(change.add));
  if (names === null && change.remove.length === 0) return { only: null, warnings };
  let next = names ?? [...known];
  for (const name of change.add) if (!next.includes(name)) next = [...next, name];
  next = next.filter((selected) => !change.remove.includes(selected));
  if (next.length === 0) throw new Error('--only: the change leaves nothing selected');
  return { only: next, warnings };
}

interface Plan {
  /** Every catalog file for these inputs (forks are compared against it). */
  full: Record<string, string>;
  /** The files the selection emits. */
  next: Record<string, string>;
  only: string[] | null;
  /** `inputs` for the manifest. */
  manifestInputs: Manifest['inputs'];
  warnings: string[];
}

function plan(manifest: Manifest, inputs: TemplateInputs, change: OnlyChange, commit: string | null): Plan {
  const options = renderOptions(inputs, commit);
  const full = render(options);
  const known = Object.keys(full.files).filter(isComponent).map(componentName);
  const { only, warnings } = applyOnly(manifest.inputs.only, change, known);
  const next = only ? render({ ...options, only }) : full;
  const strip = (files: Record<string, string>) => Object.fromEntries(Object.entries(files).filter(([path]) => path !== MANIFEST_FILE));
  const layer = strip(full.files);
  if (change.kind === 'edit') {
    // A removed name can come back as a dependency; say which, or that it was never selected.
    const deps = componentDeps(layer);
    const before = manifest.inputs.only ?? known;
    for (const name of change.remove) {
      const importers = (only ?? []).filter((selected) => own(deps, selected)?.includes(name));
      if (importers.length) warnings.push(`--only: ${name} stays, ${importers.join(', ')} import${importers.length === 1 ? 's' : ''} it`);
      else if (!before.includes(name)) warnings.push(`--only: ${name} is not in the selection`);
    }
  }
  return { full: layer, next: strip(next.files), only, manifestInputs: next.manifest.inputs, warnings };
}

// ------------------------------------------------------------------ update

export interface UpdateOptions {
  /** The template's files dir. */
  to: string;
  /** `--colors`, relative to `cwd`. Without it the manifest's `colorsPath` is reused. */
  colors?: string;
  /** `--only`: absent keeps the manifest's selection, `A,B` replaces it, `+A,-B` changes it. */
  only?: string;
  /** Report what would happen; write nothing. */
  dryRun?: boolean;
  /** Merge drifted files three ways against `baseDir`. */
  merge?: boolean;
  /** An earlier emitted copy of the files dir (same relative paths): the merge base. */
  baseDir?: string;
  /** `catalog.commit` to record (see `catalogCommit()`). */
  commit: string | null;
  cwd?: string;
}

export type DriftReason = 'edited' | 'no-base' | 'base-mismatch';

export interface UpdateReport {
  from: { version: string; commit: string | null };
  to: { version: string; commit: string | null };
  dryRun: boolean;
  /** Written with the catalog's copy, or merged cleanly (also listed in `merged`). */
  written: string[];
  merged: string[];
  deleted: string[];
  unchanged: string[];
  /** Edited by hand and left alone: `diff` turns the local file into the catalog's copy. */
  drift: { path: string; reason: DriftReason; diff: string }[];
  /** Written with conflict markers. */
  conflicts: string[];
  /** Declared forks whose catalog copy changed since `forks[path].upstream`; `current` is null when it is gone. */
  staleForks: { path: string; upstream: string; current: string | null }[];
  /** No longer emitted but edited by hand: left in place and dropped from the manifest. */
  keptLocal: string[];
  warnings: string[];
}

/** 0 when the template is in sync, 2 when something needs a person (drift, conflict, stale fork). */
export function updateExitCode(report: UpdateReport): 0 | 2 {
  return report.drift.length || report.conflicts.length || report.staleForks.length ? 2 : 0;
}

export function update(options: UpdateOptions): UpdateReport {
  const cwd = options.cwd ?? process.cwd();
  const target = templateDir(options.to, cwd);
  if (options.merge && options.baseDir === undefined) throw new Error('--merge needs --base-dir <dir>: an earlier emitted copy of the files dir');
  if (!options.merge && options.baseDir !== undefined) throw new Error('--base-dir only applies with --merge');
  const baseDir = options.baseDir === undefined ? undefined : resolve(cwd, options.baseDir);
  if (baseDir !== undefined && !existsSync(baseDir)) throw new Error(`--base-dir: ${options.baseDir} does not exist`);
  const manifest = requireManifest(target, options.to);
  const inputs = resolveInputs(target, manifest, options.colors, cwd);
  const { full, next, manifestInputs, warnings } = plan(manifest, inputs, parseOnly(options.only), options.commit);
  const dryRun = options.dryRun === true;
  const report: UpdateReport = {
    from: { version: manifest.catalog.version, commit: manifest.catalog.commit },
    to: { version: CATALOG_VERSION, commit: options.commit },
    dryRun,
    written: [],
    merged: [],
    deleted: [],
    unchanged: [],
    drift: [],
    conflicts: [],
    staleForks: [],
    keptLocal: [],
    warnings,
  };
  const write = (file: string, content: string) => {
    if (dryRun) return;
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, content);
  };
  // `files[path]` is the hash of the catalog copy the file was last synced to:
  // a pristine or written file's own hash; for drift, the hash it still has to
  // match before `update` may replace it.
  const files: Record<string, string> = {};
  const paths = sorted([...Object.keys(next), ...Object.keys(manifest.files), ...Object.keys(manifest.forks), ...Object.keys(manifest.compositions)]);
  for (const path of paths) {
    const fork = own(manifest.forks, path);
    if (fork !== undefined) {
      const upstream = own(full, path);
      const current = upstream === undefined ? null : sha256(upstream);
      if (current !== fork.upstream) report.staleForks.push({ path, upstream: fork.upstream, current });
      continue;
    }
    if (has(manifest.compositions, path)) continue;
    const file = join(target, path);
    const local = existsSync(file) ? readFileSync(file, 'utf8') : null;
    const recorded = own(manifest.files, path);
    const want = own(next, path);
    if (want === undefined) {
      if (local === null) continue;
      if (recorded !== undefined && sha256(local) === recorded) {
        if (!dryRun) rmSync(file);
        report.deleted.push(path);
      } else {
        report.keptLocal.push(path);
      }
      continue;
    }
    if (local === want) {
      report.unchanged.push(path);
      files[path] = sha256(want);
      continue;
    }
    if (local === null || (recorded !== undefined && sha256(local) === recorded)) {
      write(file, want);
      report.written.push(path);
      files[path] = sha256(want);
      continue;
    }
    const drift = (reason: DriftReason) => {
      report.drift.push({ path, reason, diff: unifiedDiff(local, want, { from: `a/${path}`, to: `b/${path}` }) });
      files[path] = recorded ?? sha256(want);
    };
    if (baseDir === undefined) {
      drift('edited');
      continue;
    }
    const baseFile = join(baseDir, path);
    const base = existsSync(baseFile) ? readFileSync(baseFile, 'utf8') : null;
    if (base === null) {
      drift('no-base');
      continue;
    }
    if (recorded !== undefined && sha256(base) !== recorded) {
      drift('base-mismatch');
      continue;
    }
    const merged = mergeFile(local, base, want, {
      local: `${path} (template)`,
      base: `${path} (base)`,
      theirs: `${path} (@fluxnative/catalog ${CATALOG_VERSION})`,
    });
    write(file, merged.content);
    files[path] = sha256(want);
    if (merged.conflicts > 0) {
      report.conflicts.push(path);
    } else {
      report.written.push(path);
      report.merged.push(path);
    }
  }
  const nextManifest: Manifest = {
    schema: 2,
    catalog: { version: CATALOG_VERSION, commit: options.commit, repo: CATALOG_REPO },
    inputs: manifestInputs,
    files,
    forks: manifest.forks,
    compositions: manifest.compositions,
    applied: manifest.applied,
  };
  const manifestFile = join(target, MANIFEST_FILE);
  const text = renderManifest(nextManifest);
  if (!dryRun && readFileSync(manifestFile, 'utf8') !== text) writeFileSync(manifestFile, text);
  return report;
}

// ------------------------------------------------------------------- check

export interface CheckOptions {
  to: string;
  /** `--colors`, relative to `cwd`; without it the manifest's `colorsPath` is used. */
  colors?: string;
  /** `--only A,B`: must name the manifest's selection. */
  only?: string;
  /** Also render the current catalog and list what `update` would change. */
  upstream?: boolean;
  cwd?: string;
}

export interface CheckResult {
  /** The catalog version the manifest records. */
  version: string;
  /** Managed files that are gone. */
  missing: string[];
  /** Managed files whose bytes differ from their manifest hash (hand edits). */
  stale: string[];
  /** Inputs that no longer match the manifest. */
  inputs: string[];
  /** With `upstream`: what `update` would change. */
  updates: { path: string; change: 'changed' | 'added' | 'removed' }[];
  /** With `upstream`: forks whose catalog copy moved on. */
  staleForks: { path: string; upstream: string; current: string | null }[];
}

const sameSelection = (a: string[] | null, b: string[] | null) => JSON.stringify(a === null ? null : sorted(a)) === JSON.stringify(b === null ? null : sorted(b));

/** Verifies a template against its own manifest; `upstream` adds what the current catalog would change. */
export function checkTemplate(options: CheckOptions): CheckResult {
  const cwd = options.cwd ?? process.cwd();
  const target = resolve(cwd, options.to);
  const manifest = requireManifest(target, options.to);
  const result: CheckResult = { version: manifest.catalog.version, missing: [], stale: [], inputs: [], updates: [], staleForks: [] };
  for (const [path, hash] of Object.entries(sortKeys(manifest.files))) {
    if (has(manifest.forks, path) || has(manifest.compositions, path)) continue;
    const file = join(target, path);
    if (!existsSync(file)) result.missing.push(path);
    else if (sha256(readFileSync(file, 'utf8')) !== hash) result.stale.push(path);
  }
  let inputs: TemplateInputs | undefined;
  try {
    inputs = resolveInputs(target, manifest, options.colors, cwd);
  } catch (error) {
    result.inputs.push((error as Error).message);
  }
  if (inputs !== undefined) {
    const hash = inputs.overrides ? sha256(JSON.stringify(inputs.overrides)) : null;
    if (hash !== manifest.inputs.colors) {
      result.inputs.push(
        manifest.inputs.colors === null
          ? `colour overrides ${inputs.colorsPath} were given, but the files were emitted without overrides`
          : `colour overrides ${inputs.colorsPath} changed since the files were emitted`,
      );
    }
  }
  if (options.only !== undefined) {
    const change = parseOnly(options.only);
    if (change.kind !== 'set') result.inputs.push('--only: check takes the selection (A,B), not changes to it (+A,-B)');
    else if (!sameSelection(change.names, manifest.inputs.only)) {
      result.inputs.push(`--only ${change.names.join(',')} is not the manifest's selection (${manifest.inputs.only?.join(',') ?? 'everything'})`);
    }
  }
  if (options.upstream && inputs !== undefined) {
    const { full, next } = plan(manifest, inputs, { kind: 'keep' }, null);
    for (const path of sorted([...Object.keys(next), ...Object.keys(manifest.files)])) {
      if (has(manifest.forks, path) || has(manifest.compositions, path)) continue;
      const want = own(next, path);
      const recorded = own(manifest.files, path);
      if (want === undefined) result.updates.push({ path, change: 'removed' });
      else if (recorded === undefined) result.updates.push({ path, change: 'added' });
      else if (sha256(want) !== recorded) result.updates.push({ path, change: 'changed' });
    }
    for (const [path, fork] of Object.entries(sortKeys(manifest.forks))) {
      const upstream = own(full, path);
      const current = upstream === undefined ? null : sha256(upstream);
      if (current !== fork.upstream) result.staleForks.push({ path, upstream: fork.upstream, current });
    }
  }
  return result;
}
