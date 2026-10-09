// Briefs: `evals/briefs/<id>/BRIEF.md` (what the screen is for, in product
// words) and `expect.json` (the recipes a good answer renders and the
// `previewState` values it must handle).

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Expect } from '../graders/coverage.ts';
import { BRIEFS_DIR } from '../paths.ts';

/** Every `previewState` a brief may ask for; `streaming` and `quota` are for the AI briefs. */
export const STATES = ['live', 'loading', 'empty', 'error', 'streaming', 'quota'] as const;

export interface Brief {
  id: string;
  /** First heading of BRIEF.md (`Catalog grid · shopping`). */
  title: string;
  /** BRIEF.md as written. */
  text: string;
  expect: Expect;
  /** `catalog-grid` → `CatalogGridScreen`: the default export, checked as `screens/<screenName>.tsx`. */
  screenName: string;
}

export function screenName(id: string): string {
  const pascal = id
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
  return `${pascal}Screen`;
}

export function listBriefIds(dir: string = BRIEFS_DIR): string[] {
  return readdirSync(dir)
    .filter((entry) => existsSync(join(dir, entry, 'BRIEF.md')))
    .sort();
}

export function loadBrief(id: string, dir: string = BRIEFS_DIR): Brief {
  const folder = join(dir, id);
  const text = readFileSync(join(folder, 'BRIEF.md'), 'utf8');
  const raw: unknown = JSON.parse(readFileSync(join(folder, 'expect.json'), 'utf8'));
  const title = /^#\s+(.+)$/m.exec(text)?.[1]?.trim() ?? id;
  return { id, title, text, expect: parseExpect(raw, `${id}/expect.json`), screenName: screenName(id) };
}

/** `all` (or nothing) → every brief; otherwise a comma-separated list of ids. */
export function selectBriefs(spec: string | undefined, dir: string = BRIEFS_DIR): Brief[] {
  const known = listBriefIds(dir);
  const ids = spec === undefined || spec === 'all' ? known : [...new Set(spec.split(',').map((s) => s.trim()).filter(Boolean))];
  const unknown = ids.filter((id) => !known.includes(id));
  if (unknown.length > 0) throw new Error(`unknown brief(s): ${unknown.join(', ')}. Known: ${known.join(', ')}`);
  if (ids.length === 0) throw new Error('--briefs selected nothing');
  return ids.map((id) => loadBrief(id, dir));
}

function parseExpect(raw: unknown, where: string): Expect {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) throw new Error(`${where}: expected { "recipes": [...], "states": [...] }`);
  const record = raw as Record<string, unknown>;
  const strings = (key: string): string[] => {
    const value = record[key];
    if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) throw new Error(`${where}: "${key}" must be an array of strings`);
    return value as string[];
  };
  const states = strings('states');
  const bad = states.filter((s) => !(STATES as readonly string[]).includes(s));
  if (bad.length > 0) throw new Error(`${where}: unknown state(s) ${bad.join(', ')}; known: ${STATES.join(', ')}`);
  return { recipes: strings('recipes'), states };
}
