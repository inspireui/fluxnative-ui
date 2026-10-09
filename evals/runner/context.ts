// What the model gets to read besides the rules. `none` measures what it
// already knows about FluxNative UI; `index` hands it the passive index
// that ships with the kit, which is the channel this eval exists to tune.

import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { REPO_ROOT } from '../paths.ts';

export const CONTEXT_MODES = ['none', 'index'] as const;
export type ContextMode = (typeof CONTEXT_MODES)[number];

/** The template-dialect index, preferred once it exists. */
export const CATALOG_INDEX = 'docs/llm/CATALOG.index.md';
/** Until then: the app index (which teaches `className`) plus the catalog topic. */
export const FALLBACK_INDEX: readonly string[] = ['docs/llm/AGENTS.index.md', 'docs/topics/catalog.md'];

export interface ContextDoc {
  /** Repo-relative. */
  path: string;
  text: string;
  bytes: number;
  sha256: string;
}

export interface Context {
  mode: ContextMode;
  docs: ContextDoc[];
}

export function isContextMode(value: string): value is ContextMode {
  return (CONTEXT_MODES as readonly string[]).includes(value);
}

export function loadContext(mode: ContextMode, root: string = REPO_ROOT): Context {
  if (mode === 'none') return { mode, docs: [] };
  const paths = existsSync(join(root, CATALOG_INDEX)) ? [CATALOG_INDEX] : FALLBACK_INDEX;
  return { mode, docs: paths.map((path) => readDoc(root, path)) };
}

function readDoc(root: string, path: string): ContextDoc {
  const file = join(root, path);
  if (!existsSync(file)) throw new Error(`context: ${path} is missing`);
  const text = readFileSync(file, 'utf8');
  return { path, text, bytes: Buffer.byteLength(text), sha256: createHash('sha256').update(text).digest('hex') };
}
