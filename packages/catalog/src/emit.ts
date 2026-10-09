// Renders the whole catalog layer for one target: the static primitives
// copied from `files/`, plus `theme/tokens.ts` and `components/Icon.tsx`
// generated for the template's colours. Pure: returns path → content.

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, posix, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { emitIcon } from './icon.ts';
import { MANIFEST_FILE, renderManifest, sha256, type Manifest } from './manifest.ts';
import { emitTokens, validateOverrides, type ColorOverrides } from './tokens.ts';

const here = dirname(fileURLToPath(import.meta.url));
export const PACKAGE_ROOT = join(here, '..');
/** The canonical copy of the layer (static sources plus default generated files). */
export const FILES_DIR = join(PACKAGE_ROOT, 'files');

export const GENERATED = ['theme/tokens.ts', 'components/Icon.tsx'] as const;

const version = (JSON.parse(readFileSync(join(PACKAGE_ROOT, 'package.json'), 'utf8')) as { version: string }).version;

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
  // has it as JSDoc. Resolve the light scheme file through the tokens package.
  const tokensDir = join(PACKAGE_ROOT, 'node_modules', '@fluxnative', 'tokens', 'tokens');
  const file = join(tokensDir, 'color.light.tokens.json');
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
const isComponent = (rel: string) => rel.startsWith('components/');
const componentName = (rel: string) => rel.replace(/^components\//, '').replace(/\.tsx?$/, '');

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
  for (const rel of Object.keys(layer).filter(isComponent).sort()) {
    out[componentName(rel)] = [...closure([rel], graph)].filter((dep) => dep !== rel && isComponent(dep)).map(componentName).sort();
  }
  return out;
}

export interface RenderOptions {
  overrides?: ColorOverrides;
  overridesLabel?: string;
  /** Component base names to emit (`Press`, `Sheet`); theme files always ship. */
  only?: string[];
}

/**
 * Which relative paths `--only` keeps: the named components, everything they
 * import (followed transitively through the layer's relative imports) and
 * every theme file. `read` returns a path's source and defaults to this
 * package's `files/`.
 */
export function selectFiles(all: string[], only?: string[], read: (rel: string) => string = readLayerFile): string[] {
  if (!only || only.length === 0) return all;
  const known = new Map(all.filter(isComponent).map((rel) => [componentName(rel), rel]));
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

export function render({ overrides, overridesLabel, only }: RenderOptions = {}): Rendered {
  const validated = overrides ? validateOverrides(overrides) : undefined;
  const layer: Record<string, string> = {};
  for (const rel of listFiles()) {
    if (isGenerated(rel)) continue;
    layer[rel] = readFileSync(join(FILES_DIR, rel), 'utf8');
  }
  layer['theme/tokens.ts'] = emitTokens({ overrides: validated, overridesLabel, colorDescriptions: readColorDescriptions() });
  layer['components/Icon.tsx'] = emitIcon();
  const files: Record<string, string> = {};
  for (const rel of selectFiles(Object.keys(layer).sort(), only, (path) => layer[path] ?? '')) files[rel] = layer[rel] ?? '';
  const manifest: Manifest = {
    version,
    colors: validated ? sha256(JSON.stringify(validated)) : null,
    only: only && only.length ? [...only] : null,
    files: Object.fromEntries(Object.entries(files).map(([path, content]) => [path, sha256(content)])),
  };
  files[MANIFEST_FILE] = renderManifest(manifest);
  return { files, manifest };
}
