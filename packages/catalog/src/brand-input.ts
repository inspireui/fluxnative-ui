// A template's brand as an emit input: the resolved brand plus a fingerprint
// of the files it was read from. The manifest records the fingerprint, so
// `check` and `update` notice when the DNA changed after the files were
// emitted, and a checker in another language can verify it from the file
// hashes alone (`inputs.brandFiles`), without resolving the brand again.

import { existsSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import type { ResolvedBrand } from '@fluxnative/tokens/brand';
import { sha256 } from './manifest.ts';
import { loadBrand } from './tokens.ts';

export interface BrandInput {
  brand: ResolvedBrand;
  /** The `--brand` argument (file, resolver or folder), relative to the files dir. */
  path: string;
  /** Every file the brand was read from, relative to the files dir → sha256 of its text. */
  files: Record<string, string>;
  /** `brandFingerprint(files)`. */
  hash: string;
}

const toPosix = (path: string) => path.split(sep).join('/');

/** sha256 over one `<path> <sha256>` line per brand file, sorted by path. */
export function brandFingerprint(files: Record<string, string>): string {
  const lines = Object.keys(files)
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
    .map((path) => `${path} ${files[path]}\n`);
  return sha256(lines.join(''));
}

/** The file a `--brand` argument names: itself, or the resolver or brand file in a folder. */
function entryFile(path: string): string {
  if (!existsSync(path) || !statSync(path).isDirectory()) return path;
  const resolver = join(path, 'brand.resolver.json');
  return existsSync(resolver) ? resolver : join(path, 'brand.tokens.json');
}

/**
 * Loads `--brand` (relative to `cwd`) for the template whose files dir is
 * `target`. Throws the brand's errors; warnings are on `brand.warnings`.
 */
export function loadBrandInput(arg: string, target: string, cwd = process.cwd()): BrandInput {
  const absolute = resolve(cwd, arg);
  const brand = loadBrand(absolute);
  const files: Record<string, string> = {};
  for (const file of [entryFile(absolute), ...brand.sources.map((source) => resolve(cwd, source.file))]) {
    files[toPosix(relative(target, file))] = sha256(readFileSync(file, 'utf8'));
  }
  return { brand, path: toPosix(relative(target, absolute)), files, hash: brandFingerprint(files) };
}
