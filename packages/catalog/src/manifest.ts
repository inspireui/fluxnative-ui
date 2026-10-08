// `.fluxnative-ui.json`: what the catalog layer last emitted into a
// template, with a hash per file, so `check` can tell a hand edit from an
// upstream change and a template can be re-emitted after a catalog release.

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

export const MANIFEST_FILE = '.fluxnative-ui.json';

export interface Manifest {
  /** @fluxnative/catalog version that emitted the files. */
  version: string;
  /** Hash of the colour overrides file, or null when none was given. */
  colors: string | null;
  /** The `--only` selection, or null for everything. */
  only: string[] | null;
  /** Relative path → sha256 of the emitted content. */
  files: Record<string, string>;
}

export function sha256(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

export function readManifest(path: string): Manifest | null {
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as Partial<Manifest>;
    if (typeof parsed.version !== 'string' || typeof parsed.files !== 'object' || parsed.files === null) return null;
    return { version: parsed.version, colors: parsed.colors ?? null, only: parsed.only ?? null, files: parsed.files };
  } catch {
    return null;
  }
}

export function renderManifest(manifest: Manifest): string {
  const files = Object.fromEntries(Object.entries(manifest.files).sort(([a], [b]) => a.localeCompare(b)));
  return `${JSON.stringify({ ...manifest, files }, null, 2)}\n`;
}
