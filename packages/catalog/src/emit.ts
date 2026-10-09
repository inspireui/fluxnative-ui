// Renders the whole catalog layer for one target: the static primitives
// copied from `files/`, plus `theme/tokens.ts` and `components/Icon.tsx`
// generated for the template's colours, each with a header that names it.
// Pure: returns path → content.

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, posix, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { emitIcon } from './icon.ts';
import { CATALOG_REPO, MANIFEST_FILE, renderManifest, sha256, type Manifest } from './manifest.ts';
import type { BrandInput } from './brand-input.ts';
import { emitTokens, validateOverrides, type ColorOverrides } from './tokens.ts';

const here = dirname(fileURLToPath(import.meta.url));
export const PACKAGE_ROOT = join(here, '..');
/** The canonical copy of the layer (static sources plus default generated files). */
export const FILES_DIR = join(PACKAGE_ROOT, 'files');

export const GENERATED = ['theme/tokens.ts', 'components/Icon.tsx'] as const;

/** Where every emitted file sends its reader. */
export const DOCS_URL = 'https://github.com/inspireui/fluxnative-ui/blob/main/docs/topics/catalog.md';

export const CATALOG_VERSION = (JSON.parse(readFileSync(join(PACKAGE_ROOT, 'package.json'), 'utf8')) as { version: string }).version;

function walk(dir: string, base = dir): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir).sort()) {
    if (entry.startsWith('.')) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full, base));
    else out.push(relative(base, full).split('\\').join('/'));
  }
  return out;
}

/** Every file the layer ships, generated ones included. */
export function listFiles(): string[] {
  return walk(FILES_DIR);
}

function readColorDescriptions(): Record<string, string> {
  // The DTCG source carries each colour's description; the generated TS only
  // has it as JSDoc. Resolve the light scheme file through the tokens
  // package's exports, so an npm install (hoisted, not nested under this
  // package) emits the same bytes as the monorepo.
  const file = fileURLToPath(import.meta.resolve('@fluxnative/tokens/tokens/color.light.tokens.json'));
  if (!existsSync(file)) return {};
  const doc = JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>;
  const out: Record<string, string> = {};
  const visit = (node: unknown, path: string[]) => {
    if (node === null || typeof node !== 'object') return;
    const obj = node as Record<string, unknown>;
    if ('$value' in obj) {
      if (typeof obj.$description === 'string') out[path.slice(1).join('-')] = obj.$description;
      return;
    }
    for (const [key, child] of Object.entries(obj)) {
      if (!key.startsWith('$')) visit(child, [...path, key]);
    }
  };
  visit(doc, []);
  return out;
}

const isGenerated = (rel: string) => (GENERATED as readonly string[]).includes(rel);
/** A path under `components/`, sub-folders included (`components/commerce/ProductCard.tsx`). */
const isComponent = (rel: string) => rel.startsWith('components/');
/** A component's name is its file's base name: `components/commerce/ProductCard.tsx` → `ProductCard`. */
export const componentName = (rel: string) => posix.basename(rel).replace(/\.tsx?$/, '');

/** Component name → path. Two components with one name would make `--only` ambiguous, so that throws. */
export function componentPaths(paths: string[]): Map<string, string> {
  const out = new Map<string, string>();
  for (const rel of paths.filter(isComponent)) {
    const name = componentName(rel);
    const taken = out.get(name);
    if (taken !== undefined) throw new Error(`two catalog components are named ${name}: ${taken} and ${rel}`);
    out.set(name, rel);
  }
  return out;
}

/**
 * The lines `render()` puts at the top of every emitted source under
 * `components/` and `theme/`: what the file is and where its docs live, then,
 * for a copied primitive, where a change belongs. A generated file keeps its
 * own "do not edit by hand" header right below the first line. No version
 * number, so a release that leaves a file alone leaves its bytes alone.
 */
export function emittedHeader(rel: string): string {
  const first = `// FluxNative UI catalog · ${rel} · ${DOCS_URL}\n`;
  if (isGenerated(rel)) return first;
  return `${first}// Emitted by fluxnative-catalog — declare a fork in ${MANIFEST_FILE} instead of editing.\n\n`;
}

function withHeader(rel: string, content: string): string {
  return /^(components|theme)\/.+\.tsx?$/.test(rel) ? emittedHeader(rel) + content : content;
}

// `import X from './Y'`, `import type { X } from '../theme/Y'`, `import './Y'`,
// `export { X } from './Y'`, including imports that span several lines.
const IMPORT_RE = /^[ \t]*(?:import|export)\s+(?:[^'"`;]*?\s+from\s+)?['"]([^'"]+)['"]/gm;

function resolveImport(from: string, specifier: string, known: Set<string>): string | undefined {
  const base = posix.normalize(posix.join(posix.dirname(from), specifier));
  return [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`].find((candidate) => known.has(candidate));
}

/** The relative imports between the layer's files: path → the layer paths it imports. */
export function importGraph(sources: Record<string, string>): Record<string, string[]> {
  const known = new Set(Object.keys(sources));
  const graph: Record<string, string[]> = {};
  for (const [rel, text] of Object.entries(sources)) {
    const deps = new Set<string>();
    for (const match of text.matchAll(IMPORT_RE)) {
      const specifier = match[1];
      if (specifier === undefined || !/^\.\.?\//.test(specifier)) continue;
      const target = resolveImport(rel, specifier, known);
      if (target === undefined) throw new Error(`${rel} imports '${specifier}', which is not a file of the catalog layer`);
      deps.add(target);
    }
    graph[rel] = [...deps].sort();
  }
  return graph;
}

function closure(start: string[], graph: Record<string, string[]>): Set<string> {
  const seen = new Set<string>();
  const queue = [...start];
  for (let rel = queue.pop(); rel !== undefined; rel = queue.pop()) {
    if (seen.has(rel)) continue;
    seen.add(rel);
    queue.push(...(graph[rel] ?? []));
  }
  return seen;
}

function readLayerFile(rel: string): string {
  return readFileSync(join(FILES_DIR, rel), 'utf8');
}

/** Each component's transitive dependencies inside `components/`, by name (theme files always ship). */
export function componentDeps(sources?: Record<string, string>): Record<string, string[]> {
  const layer = sources ?? Object.fromEntries(listFiles().map((rel) => [rel, readLayerFile(rel)]));
  const graph = importGraph(layer);
  const out: Record<string, string[]> = {};
  for (const [name, rel] of componentPaths(Object.keys(layer).sort())) {
    out[name] = [...closure([rel], graph)].filter((dep) => dep !== rel && isComponent(dep)).map(componentName).sort();
  }
  return out;
}

export interface RenderOptions {
  overrides?: ColorOverrides;
  /** A template's brand (`loadBrandInput`), instead of `overrides`; recorded as `inputs.brand*`. */
  brand?: BrandInput;
  /** Where the overrides or the brand came from, shown in theme/tokens.ts. */
  overridesLabel?: string;
  /** Component base names to emit (`Press`, `Sheet`); theme files always ship. */
  only?: string[];
  /** The overrides file, relative to the files dir; recorded as `inputs.colorsPath`. */
  colorsPath?: string;
  /** `catalog.commit` for the manifest. Default null, which is what this package's own copy records. */
  commit?: string | null;
  /**
   * The template's current manifest. Its `forks`, `compositions` and
   * `applied` carry over, and forked or composed paths are left out of
   * `files`: they belong to the template.
   */
  previous?: Manifest | null;
}

/**
 * Which relative paths `--only` keeps: the named components, everything they
 * import (followed transitively through the layer's relative imports) and
 * every theme file. `read` returns a path's source and defaults to this
 * package's `files/`.
 */
export function selectFiles(all: string[], only?: string[], read: (rel: string) => string = readLayerFile): string[] {
  if (!only || only.length === 0) return all;
  const known = componentPaths(all);
  const unknown = only.filter((name) => !known.has(name));
  if (unknown.length) throw new Error(`--only: unknown component(s) ${unknown.join(', ')}. Known: ${[...known.keys()].join(', ')}`);
  const graph = importGraph(Object.fromEntries(all.map((rel) => [rel, read(rel)])));
  const keep = closure(only.flatMap((name) => known.get(name) ?? []), graph);
  return all.filter((rel) => !isComponent(rel) || keep.has(rel));
}

export interface Rendered {
  files: Record<string, string>;
  manifest: Manifest;
}

export function render(options: RenderOptions = {}): Rendered {
  const { overrides, brand, overridesLabel, only, previous } = options;
  if (overrides && brand) throw new Error('pass colour overrides or a brand, not both: a brand carries its own colours');
  const validated = overrides ? validateOverrides(overrides) : undefined;
  const layer: Record<string, string> = {};
  for (const rel of listFiles()) {
    if (isGenerated(rel)) continue;
    layer[rel] = readFileSync(join(FILES_DIR, rel), 'utf8');
  }
  layer['theme/tokens.ts'] = emitTokens({ overrides: validated, brand: brand?.brand, overridesLabel, colorDescriptions: readColorDescriptions() });
  layer['components/Icon.tsx'] = emitIcon();
  const owned = new Set([...Object.keys(previous?.forks ?? {}), ...Object.keys(previous?.compositions ?? {})]);
  const files: Record<string, string> = {};
  for (const rel of selectFiles(Object.keys(layer).sort(), only, (path) => layer[path] ?? '')) {
    if (!owned.has(rel)) files[rel] = withHeader(rel, layer[rel] ?? '');
  }
  const manifest: Manifest = {
    schema: 2,
    catalog: { version: CATALOG_VERSION, commit: options.commit ?? null, repo: CATALOG_REPO },
    inputs: {
      colors: validated ? sha256(JSON.stringify(validated)) : null,
      colorsPath: validated ? (options.colorsPath ?? null) : null,
      brand: brand ? brand.hash : null,
      brandPath: brand ? brand.path : null,
      brandFiles: brand ? { ...brand.files } : null,
      only: only && only.length ? [...only] : null,
    },
    files: Object.fromEntries(Object.entries(files).map(([path, content]) => [path, sha256(content)])),
    forks: { ...previous?.forks },
    compositions: { ...previous?.compositions },
    applied: { codemods: [...(previous?.applied.codemods ?? [])] },
  };
  files[MANIFEST_FILE] = renderManifest(manifest);
  return { files, manifest };
}
