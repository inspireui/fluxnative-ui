// `.fluxnative-ui.json`: what the catalog layer last emitted into a
// template, with a hash per file, so `check` and `update` can tell a pristine
// file from a hand edit, plus the parts the template owner writes by hand
// (`forks`, `compositions`). Schema 2; schema 1 files are read and upgraded on
// the next write. No timestamps and a fixed key order, so the bytes only
// change when the content does.

import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';

export const MANIFEST_FILE = '.fluxnative-ui.json';
export const MANIFEST_SCHEMA = 2;
export const CATALOG_REPO = 'inspireui/fluxnative-ui';

/** A catalog file the template copied and changed on purpose. `update` never writes it. */
export interface ForkEntry {
  /** Why the template needs its own copy. */
  reason: string;
  /** Catalog version the fork was taken from. */
  since: string;
  /** sha256 of the catalog's copy the fork follows (its `files` hash when it was forked). */
  upstream: string;
}

/** A template file that wraps a catalog component instead of copying it. */
export interface CompositionEntry {
  /** The catalog component it wraps (`Button`). */
  wraps: string;
  reason: string;
}

export interface ManifestInputs {
  /** sha256 of the colour overrides, or null when none were given. */
  colors: string | null;
  /** The overrides file, relative to the files dir. */
  colorsPath: string | null;
  /** Fingerprint of the brand files (see `brandFiles`), or null when no brand was given. */
  brand: string | null;
  /** The `--brand` argument (file, resolver or folder), relative to the files dir. */
  brandPath: string | null;
  /** Every file the brand was read from, relative to the files dir → sha256 of its bytes. */
  brandFiles: Record<string, string> | null;
  /** The `--only` selection, or null for everything. */
  only: string[] | null;
}

export interface Manifest {
  schema: 2;
  catalog: {
    /** @fluxnative/catalog version that emitted the files. */
    version: string;
    /** Commit of the catalog checkout, or null when it was not a clean checkout. */
    commit: string | null;
    repo: string;
  };
  inputs: ManifestInputs;
  /** Relative path → sha256 of the catalog's copy the file was last synced to. */
  files: Record<string, string>;
  forks: Record<string, ForkEntry>;
  compositions: Record<string, CompositionEntry>;
  /** Reserved: release codemods already run on this template. */
  applied: { codemods: string[] };
}

/** The schema 1 shape, written before `update` existed. */
export interface ManifestV1 {
  version: string;
  colors: string | null;
  only: string[] | null;
  files: Record<string, string>;
}

export function sha256(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

/** Key-sorted copy, in code-point order so no locale changes the bytes. */
export function sortKeys<T>(record: Record<string, T>): Record<string, T> {
  return Object.fromEntries(Object.entries(record).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
}

export function upgradeManifest(v1: ManifestV1): Manifest {
  return {
    schema: 2,
    catalog: { version: v1.version, commit: null, repo: CATALOG_REPO },
    inputs: { colors: v1.colors, colorsPath: null, brand: null, brandPath: null, brandFiles: null, only: v1.only },
    files: { ...v1.files },
    forks: {},
    compositions: {},
    applied: { codemods: [] },
  };
}

type Json = Record<string, unknown>;

const isObject = (value: unknown): value is Json => value !== null && typeof value === 'object' && !Array.isArray(value);

/**
 * A manifest path: relative, forward slashes, no empty, `.`, `..` or
 * `__proto__` segments. `update` writes and deletes these, so none may point
 * outside the files dir.
 */
export function isSafePath(path: string): boolean {
  if (path === '' || path.startsWith('/') || path.includes('\\') || /^[a-zA-Z]:/.test(path)) return false;
  return path.split('/').every((segment) => segment !== '' && segment !== '.' && segment !== '..' && segment !== '__proto__');
}

class ManifestError extends Error {}

function expectKeys(where: string, value: Json, allowed: readonly string[]): void {
  const unknown = Object.keys(value).filter((key) => !allowed.includes(key));
  if (unknown.length) throw new ManifestError(`${where}: unknown key(s) ${unknown.join(', ')}`);
}

function stringOrNull(where: string, value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') throw new ManifestError(`${where}: expected a string or null`);
  return value;
}

function requiredString(where: string, value: unknown): string {
  if (typeof value !== 'string' || value.trim() === '') throw new ManifestError(`${where}: expected a non-empty string`);
  return value;
}

function stringList(where: string, value: unknown): string[] | null {
  if (value === undefined || value === null) return null;
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    throw new ManifestError(`${where}: expected an array of strings or null`);
  }
  return [...(value as string[])];
}

function pathMap<T>(where: string, value: unknown, entry: (where: string, value: unknown) => T): Record<string, T> {
  if (value === undefined) return {};
  if (!isObject(value)) throw new ManifestError(`${where}: expected an object of path → entry`);
  const out: Record<string, T> = {};
  for (const [path, item] of Object.entries(value)) {
    if (!isSafePath(path)) throw new ManifestError(`${where}: "${path}" is not a relative path inside the files dir`);
    out[path] = entry(`${where}["${path}"]`, item);
  }
  return out;
}

/** `inputs.brandFiles`: paths relative to the files dir, usually `../design/…`, so `..` is allowed here. */
function brandFileMap(where: string, value: unknown): Record<string, string> {
  if (!isObject(value)) throw new ManifestError(`${where}: expected an object of path → sha256`);
  const out: Record<string, string> = {};
  for (const [path, item] of Object.entries(value)) {
    if (path === '' || path.startsWith('/') || /^[a-z]:/i.test(path) || path.includes('\\')) {
      throw new ManifestError(`${where}: "${path}" is not a relative POSIX path`);
    }
    out[path] = hashEntry(`${where}["${path}"]`, item);
  }
  return out;
}
function hashEntry(where: string, value: unknown): string {
  if (typeof value !== 'string' || !/^[0-9a-f]{64}$/.test(value)) throw new ManifestError(`${where}: expected a sha256 hex digest`);
  return value;
}

function forkEntry(where: string, value: unknown): ForkEntry {
  if (!isObject(value)) throw new ManifestError(`${where}: expected { "reason", "since", "upstream" }`);
  expectKeys(where, value, ['reason', 'since', 'upstream']);
  return {
    reason: requiredString(`${where}.reason`, value.reason),
    since: requiredString(`${where}.since`, value.since),
    upstream: hashEntry(`${where}.upstream`, value.upstream),
  };
}

function compositionEntry(where: string, value: unknown): CompositionEntry {
  if (!isObject(value)) throw new ManifestError(`${where}: expected { "wraps", "reason" }`);
  expectKeys(where, value, ['wraps', 'reason']);
  return { wraps: requiredString(`${where}.wraps`, value.wraps), reason: requiredString(`${where}.reason`, value.reason) };
}

/** Parses schema 1 or 2 and returns schema 2. Throws naming the offending field on anything else. */
export function parseManifest(text: string, where = MANIFEST_FILE): { manifest: Manifest; schema: 1 | 2 } {
  let doc: unknown;
  try {
    doc = JSON.parse(text);
  } catch (error) {
    throw new Error(`${where}: not valid JSON (${(error as Error).message})`);
  }
  try {
    if (!isObject(doc)) throw new ManifestError('expected an object');
    if (doc.schema === undefined) {
      if (typeof doc.version !== 'string') throw new ManifestError('neither a "schema" nor a schema 1 "version" field');
      const v1: ManifestV1 = {
        version: doc.version,
        colors: stringOrNull('colors', doc.colors),
        only: stringList('only', doc.only),
        files: pathMap('files', doc.files, hashEntry),
      };
      return { manifest: upgradeManifest(v1), schema: 1 };
    }
    if (doc.schema !== MANIFEST_SCHEMA) {
      throw new ManifestError(`schema ${JSON.stringify(doc.schema)} is not supported (this @fluxnative/catalog reads 1 and 2; upgrade it)`);
    }
    expectKeys('manifest', doc, ['schema', 'catalog', 'inputs', 'files', 'forks', 'compositions', 'applied']);
    if (!isObject(doc.catalog)) throw new ManifestError('catalog: expected { "version", "commit", "repo" }');
    expectKeys('catalog', doc.catalog, ['version', 'commit', 'repo']);
    const inputs = doc.inputs ?? {};
    if (!isObject(inputs)) throw new ManifestError('inputs: expected an object');
    expectKeys('inputs', inputs, ['colors', 'colorsPath', 'brand', 'brandPath', 'brandFiles', 'only']);
    const applied = doc.applied ?? {};
    if (!isObject(applied)) throw new ManifestError('applied: expected { "codemods" }');
    expectKeys('applied', applied, ['codemods']);
    const manifest: Manifest = {
      schema: 2,
      catalog: {
        version: requiredString('catalog.version', doc.catalog.version),
        commit: stringOrNull('catalog.commit', doc.catalog.commit),
        repo: stringOrNull('catalog.repo', doc.catalog.repo) ?? CATALOG_REPO,
      },
      inputs: {
        colors: stringOrNull('inputs.colors', inputs.colors),
        colorsPath: stringOrNull('inputs.colorsPath', inputs.colorsPath),
        brand: stringOrNull('inputs.brand', inputs.brand),
        brandPath: stringOrNull('inputs.brandPath', inputs.brandPath),
        brandFiles: inputs.brandFiles === undefined || inputs.brandFiles === null ? null : brandFileMap('inputs.brandFiles', inputs.brandFiles),
        only: stringList('inputs.only', inputs.only),
      },
      files: pathMap('files', doc.files, hashEntry),
      forks: pathMap('forks', doc.forks, forkEntry),
      compositions: pathMap('compositions', doc.compositions, compositionEntry),
      applied: { codemods: stringList('applied.codemods', applied.codemods) ?? [] },
    };
    return { manifest, schema: 2 };
  } catch (error) {
    if (error instanceof ManifestError) throw new Error(`${where}: ${error.message}`);
    throw error;
  }
}

/** The manifest at `path`, or null when there is none. Throws when the file exists but does not parse. */
export function loadManifest(path: string): { manifest: Manifest; schema: 1 | 2 } | null {
  if (!existsSync(path)) return null;
  return parseManifest(readFileSync(path, 'utf8'), path);
}

/** Lenient read: the manifest (schema 1 upgraded), or null when it is missing or unreadable. */
export function readManifest(path: string): Manifest | null {
  try {
    return loadManifest(path)?.manifest ?? null;
  } catch {
    return null;
  }
}

/** Canonical JSON: fixed key order, path maps sorted, two-space indent, trailing newline. */
export function renderManifest(manifest: Manifest): string {
  const forks = Object.fromEntries(
    Object.entries(manifest.forks).map(([path, fork]) => [path, { reason: fork.reason, since: fork.since, upstream: fork.upstream }]),
  );
  const compositions = Object.fromEntries(
    Object.entries(manifest.compositions).map(([path, entry]) => [path, { wraps: entry.wraps, reason: entry.reason }]),
  );
  const doc = {
    schema: MANIFEST_SCHEMA,
    catalog: { version: manifest.catalog.version, commit: manifest.catalog.commit, repo: manifest.catalog.repo },
    inputs: {
      colors: manifest.inputs.colors,
      colorsPath: manifest.inputs.colorsPath,
      brand: manifest.inputs.brand,
      brandPath: manifest.inputs.brandPath,
      brandFiles: manifest.inputs.brandFiles === null ? null : sortKeys(manifest.inputs.brandFiles),
      only: manifest.inputs.only,
    },
    files: sortKeys(manifest.files),
    forks: sortKeys(forks),
    compositions: sortKeys(compositions),
    applied: { codemods: [...manifest.applied.codemods] },
  };
  return `${JSON.stringify(doc, null, 2)}\n`;
}
