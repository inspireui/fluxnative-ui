// Renders the whole catalog layer for one target: the static primitives
// copied from `files/`, plus `theme/tokens.ts` and `components/Icon.tsx`
// generated for the template's colours. Pure: returns path → content.

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { emitIcon } from './icon.ts';
import { MANIFEST_FILE, renderManifest, sha256, type Manifest } from './manifest.ts';
import { emitTokens, validateOverrides, type ColorOverrides } from './tokens.ts';
import type { ResolvedBrand } from '@fluxnative/tokens';

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

export interface RenderOptions {
  overrides?: ColorOverrides;
  /** A resolved brand (`loadBrand`) instead of `overrides`. */
  brand?: ResolvedBrand;
  overridesLabel?: string;
  /** Component base names to emit (`Press`, `Sheet`); theme files always ship. */
  only?: string[];
}

/** Which relative paths `--only` keeps. */
export function selectFiles(all: string[], only?: string[]): string[] {
  if (!only || only.length === 0) return all;
  const wanted = new Set(only);
  const known = new Set(all.filter((f) => f.startsWith('components/')).map((f) => f.replace(/^components\//, '').replace(/\.tsx?$/, '')));
  const unknown = only.filter((name) => !known.has(name));
  if (unknown.length) throw new Error(`--only: unknown component(s) ${unknown.join(', ')}. Known: ${[...known].join(', ')}`);
  // Primitives lean on each other: keep the files a selected one imports.
  const deps: Record<string, string[]> = {
    Press: ['bridge', 'useReducedMotion'],
    Reveal: ['useReducedMotion'],
    Skeleton: ['useReducedMotion'],
    Sheet: ['Scrim', 'useReducedMotion'],
    Chip: ['Press', 'bridge', 'useReducedMotion'],
    Button: ['Press', 'bridge', 'useReducedMotion'],
    IconButton: ['Press', 'bridge', 'useReducedMotion'],
    SectionHeader: ['Press', 'bridge', 'useReducedMotion'],
    StateView: ['Button', 'Press', 'bridge', 'useReducedMotion'],
  };
  for (const name of only) for (const dep of deps[name] ?? []) wanted.add(dep);
  return all.filter((f) => !f.startsWith('components/') || wanted.has(f.replace(/^components\//, '').replace(/\.tsx?$/, '')));
}

export interface Rendered {
  files: Record<string, string>;
  manifest: Manifest;
}

export function render({ overrides, brand, overridesLabel, only }: RenderOptions = {}): Rendered {
  const validated = overrides ? validateOverrides(overrides) : undefined;
  const files: Record<string, string> = {};
  for (const rel of selectFiles(listFiles(), only)) {
    if ((GENERATED as readonly string[]).includes(rel)) continue;
    files[rel] = readFileSync(join(FILES_DIR, rel), 'utf8');
  }
  files['theme/tokens.ts'] = emitTokens({ overrides: validated, brand, overridesLabel, colorDescriptions: readColorDescriptions() });
  if (!only || only.includes('Icon')) files['components/Icon.tsx'] = emitIcon();
  const manifest: Manifest = {
    version,
    colors: validated ? sha256(JSON.stringify(validated)) : brand ? sha256(JSON.stringify(brand.sources.map((s) => s.doc))) : null,
    only: only && only.length ? [...only] : null,
    files: Object.fromEntries(Object.entries(files).map(([path, content]) => [path, sha256(content)])),
  };
  files[MANIFEST_FILE] = renderManifest(manifest);
  return { files, manifest };
}
