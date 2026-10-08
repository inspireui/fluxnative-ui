#!/usr/bin/env node
// fluxnative-catalog emit  --to <template files dir> [--colors <overrides.json>] [--only Press,Sheet,…] [--check]
// fluxnative-catalog check --to <template files dir> [--colors …] [--only …]     (alias of emit --check)
// fluxnative-catalog build [--check]   regenerate this package's own files/ (default colours)
//
// `emit` writes the layer into a Flux template's `files/` folder (theme/,
// components/) with a `.fluxnative-ui.json` manifest. `--check` writes
// nothing and exits 1 when any emitted file differs from what emit would
// write now, naming each one.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { FILES_DIR, GENERATED, render } from './emit.ts';
import { MANIFEST_FILE, readManifest } from './manifest.ts';
import { validateOverrides } from './tokens.ts';

function usage(code: number): never {
  console.error(
    [
      'usage:',
      '  fluxnative-catalog emit  --to <files dir> [--colors <json>] [--only A,B] [--check]',
      '  fluxnative-catalog check --to <files dir> [--colors <json>] [--only A,B]',
      '  fluxnative-catalog build [--check]',
    ].join('\n'),
  );
  process.exit(code);
}

function flag(argv: string[], name: string): string | undefined {
  const i = argv.indexOf(name);
  if (i < 0) return undefined;
  const value = argv[i + 1];
  if (value === undefined || value.startsWith('--')) usage(2);
  return value;
}

function writeAll(target: string, files: Record<string, string>, check: boolean): number {
  let drift = 0;
  for (const [rel, content] of Object.entries(files)) {
    const file = join(target, rel);
    const current = existsSync(file) ? readFileSync(file, 'utf8') : null;
    if (current === content) continue;
    if (check) {
      drift += 1;
      console.error(`${current === null ? 'missing' : 'stale'}: ${relative(process.cwd(), file)}`);
      continue;
    }
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, content);
    console.log(`wrote ${relative(process.cwd(), file)}`);
  }
  return drift;
}

const argv = process.argv.slice(2);
const command = argv[0];
const check = argv.includes('--check') || command === 'check';

if (command === 'build') {
  const { files } = render();
  const subset = Object.fromEntries(Object.entries(files).filter(([rel]) => (GENERATED as readonly string[]).includes(rel) || rel === MANIFEST_FILE));
  const drift = writeAll(FILES_DIR, subset, check);
  if (drift) {
    console.error(`catalog files out of date — run \`pnpm catalog\``);
    process.exit(1);
  }
  if (check) console.log('catalog files up to date');
} else if (command === 'emit' || command === 'check') {
  const to = flag(argv, '--to');
  if (!to) usage(2);
  const target = resolve(process.cwd(), to);
  const colorsPath = flag(argv, '--colors');
  const only = flag(argv, '--only')?.split(',').map((s) => s.trim()).filter(Boolean);
  let overrides;
  if (colorsPath) {
    const file = resolve(process.cwd(), colorsPath);
    overrides = validateOverrides(JSON.parse(readFileSync(file, 'utf8')), relative(process.cwd(), file));
  }
  const previous = readManifest(join(target, MANIFEST_FILE));
  const { files } = render({ overrides, overridesLabel: colorsPath ? relative(target, resolve(process.cwd(), colorsPath)) : undefined, only: only ?? previous?.only ?? undefined });
  const drift = writeAll(target, files, check);
  if (drift) {
    console.error(`${drift} file(s) differ from the catalog layer — re-run \`fluxnative-catalog emit --to ${to}\` or keep the hand edit out of generated files`);
    process.exit(1);
  }
  if (check) console.log(`catalog layer in ${relative(process.cwd(), target) || '.'} is up to date`);
} else {
  usage(command === '--help' || command === '-h' ? 0 : 2);
}
