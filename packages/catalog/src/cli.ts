#!/usr/bin/env node
// fluxnative-catalog emit   --to <files dir> [--colors <json> | --brand <file|resolver|dir>] [--only A,B] [--check]
// fluxnative-catalog update --to <files dir> [--colors <json> | --brand <path>] [--only A,B | +A,-B] [--dry-run] [--json] [--merge --base-dir <dir>]
// fluxnative-catalog check  --to <files dir> [--colors <json> | --brand <path>] [--only A,B] [--upstream [--strict]]
// fluxnative-catalog build  [--check]   regenerate this package's own files/ (default colours)
//
// `emit` writes the layer into a Flux template's `files/` folder (theme/,
// components/) with a `.fluxnative-ui.json` manifest; `--check` writes
// nothing and exits 1 when any file differs from what emit would write now.
// `update` replaces the files that still match the manifest, deletes the ones
// the catalog dropped, leaves hand edits alone and reports them with a diff
// (`--merge` merges them three ways against `--base-dir`), and never writes a
// declared fork or composition: exit 0 in sync, 2 drift/conflict/stale fork,
// 1 error. `check` verifies a template against its own manifest (exit 1 on a
// hand edit or changed inputs); `--upstream` also lists what `update` would
// change, failing only with `--strict`.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { CATALOG_VERSION, FILES_DIR, GENERATED, render } from './emit.ts';
import { catalogCommit } from './git.ts';
import { MANIFEST_FILE, loadManifest, type Manifest } from './manifest.ts';
import { formatProblems } from '@fluxnative/tokens/brand';
import { loadBrandInput, type BrandInput } from './brand-input.ts';
import { validateOverrides } from './tokens.ts';
import { checkTemplate, templateDir, update, updateExitCode, type UpdateReport } from './update.ts';

const argv = process.argv.slice(2);
const command = argv[0];
// `update` exits 2 for drift, so its usage errors exit 1 like its other errors.
const usageCode = command === 'update' ? 1 : 2;

function usage(code: number): never {
  console.error(
    [
      'usage:',
      '  fluxnative-catalog emit   --to <files dir> [--colors <json> | --brand <file|resolver|dir>] [--only A,B] [--check]',
      '  fluxnative-catalog update --to <files dir> [--colors <json> | --brand <path>] [--only A,B | +A,-B] [--dry-run] [--json] [--merge --base-dir <dir>]',
      '  fluxnative-catalog check  --to <files dir> [--colors <json> | --brand <path>] [--only A,B] [--upstream [--strict]]',
      '  fluxnative-catalog build  [--check]',
    ].join('\n'),
  );
  process.exit(code);
}

function flag(argv: string[], name: string): string | undefined {
  const i = argv.indexOf(name);
  if (i < 0) return undefined;
  const value = argv[i + 1];
  if (value === undefined || value.startsWith('--')) usage(usageCode);
  return value;
}

/** `update` and `check` refuse arguments they do not know: a mistyped `--dry-run` must not write. */
function expectArgs(values: string[], switches: string[]): void {
  for (let i = 1; i < argv.length; i += 1) {
    const arg = argv[i] ?? '';
    if (values.includes(arg)) i += 1;
    else if (!switches.includes(arg)) {
      console.error(`fluxnative-catalog ${command}: unknown argument ${arg}`);
      usage(usageCode);
    }
  }
}

const display = (path: string) => relative(process.cwd(), path) || '.';
const toPosix = (path: string) => path.split(sep).join('/');

function fail(error: unknown, json = false): void {
  const message = error instanceof Error ? error.message : String(error);
  if (json) console.log(JSON.stringify({ error: message }, null, 2));
  console.error(message);
  process.exitCode = 1;
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

/** A brand's warnings (errors throw) go to stderr; the emit still runs. */
function warnBrand(brand: BrandInput): void {
  const { warnings } = brand.brand;
  if (warnings.length) console.error(`brand: ${warnings.length} warning(s)\n${formatProblems(warnings)}`);
}

/** The template's manifest, so `emit` keeps its forks, compositions and selection. */
function previousManifest(target: string): Manifest | null {
  const file = join(target, MANIFEST_FILE);
  try {
    return loadManifest(file)?.manifest ?? null;
  } catch (error) {
    throw new Error(`${(error as Error).message}\nfix ${display(file)} or delete it to emit from scratch (its forks and compositions would be lost)`);
  }
}

function printUpdate(report: UpdateReport, target: string): void {
  const at = (path: string) => display(join(target, path));
  const done = (past: string, future: string) => (report.dryRun ? `would ${future}` : past);
  const release = ({ version, commit }: UpdateReport['from']) => `${version}${commit ? ` (${commit.slice(0, 12)})` : ''}`;
  for (const warning of report.warnings) console.error(`warning: ${warning}`);
  for (const path of report.written) console.log(`${report.merged.includes(path) ? done('merged', 'merge') : done('wrote', 'write')} ${at(path)}`);
  for (const path of report.deleted) console.log(`${done('deleted', 'delete')} ${at(path)}`);
  for (const path of report.keptLocal) console.log(`kept ${at(path)}: no longer emitted and edited by hand, so it is the template's own file now`);
  for (const { path, reason, diff } of report.drift) {
    const why = reason === 'no-base' ? 'no copy of it in --base-dir' : reason === 'base-mismatch' ? `the --base-dir copy is not the one ${MANIFEST_FILE} records` : 'edited by hand';
    console.error(`drift: ${at(path)} (${why}; not written)\n${diff.trimEnd()}`);
  }
  for (const path of report.conflicts) console.error(`conflict: ${at(path)} (${done('written', 'be written')} with conflict markers)`);
  for (const fork of report.staleForks) {
    const now = fork.current === null ? 'it is no longer in the catalog' : `now ${fork.current.slice(0, 12)}`;
    console.error(`stale fork: ${at(fork.path)} (follows ${fork.upstream.slice(0, 12)}; ${now})`);
  }
  const counts = [`${report.written.length} written`, `${report.deleted.length} deleted`, `${report.unchanged.length} unchanged`];
  if (report.drift.length) counts.push(`${report.drift.length} drift`);
  if (report.conflicts.length) counts.push(`${report.conflicts.length} conflict(s)`);
  if (report.staleForks.length) counts.push(`${report.staleForks.length} stale fork(s)`);
  if (report.keptLocal.length) counts.push(`${report.keptLocal.length} kept`);
  console.log(`@fluxnative/catalog ${release(report.from)} → ${release(report.to)} in ${display(target)}: ${counts.join(', ')}${report.dryRun ? ' (dry run, nothing written)' : ''}`);
  if (report.drift.length || report.conflicts.length) {
    console.error(`next: take the catalog copy (delete the file and re-run), declare a fork in ${MANIFEST_FILE}, or merge with --merge --base-dir <earlier copy>`);
  }
  if (report.merged.length) console.log('merged files keep their hand edits: `check` reports them until they are declared forks or reverted');
  if (report.staleForks.length) console.error('next: port the catalog change into each fork, then set forks[path].upstream to the new hash (`--json` lists it)');
}

const check = argv.includes('--check');

if (command === 'build') {
  const { files } = render();
  const subset = Object.fromEntries(Object.entries(files).filter(([rel]) => (GENERATED as readonly string[]).includes(rel) || rel === MANIFEST_FILE));
  const drift = writeAll(FILES_DIR, subset, check);
  if (drift) {
    console.error('catalog files out of date — run `pnpm tokens` (or `pnpm catalog build`)');
    process.exit(1);
  }
  if (check) console.log('catalog files up to date');
} else if (command === 'emit') {
  const to = flag(argv, '--to');
  if (!to) usage(2);
  try {
    const target = templateDir(to);
    const colorsPath = flag(argv, '--colors');
    const brandPath = flag(argv, '--brand');
    if (colorsPath && brandPath) {
      console.error('--colors and --brand are exclusive: a brand carries its own colours (color.* and its .dark.tokens.json)');
      process.exit(2);
    }
    const only = flag(argv, '--only')?.split(',').map((s) => s.trim()).filter(Boolean);
    let overrides;
    if (colorsPath) {
      const file = resolve(process.cwd(), colorsPath);
      overrides = validateOverrides(JSON.parse(readFileSync(file, 'utf8')), relative(process.cwd(), file));
    }
    let brand: BrandInput | undefined;
    if (brandPath) {
      brand = loadBrandInput(brandPath, target);
      warnBrand(brand);
    }
    const label = colorsPath ? toPosix(relative(target, resolve(process.cwd(), colorsPath))) : brand?.path;
    const previous = previousManifest(target);
    const { files } = render({
      overrides,
      brand,
      overridesLabel: label,
      colorsPath: colorsPath ? label : undefined,
      only: only ?? previous?.inputs.only ?? undefined,
      commit: catalogCommit(),
      previous,
    });
    const drift = writeAll(target, files, check);
    if (drift) {
      console.error(`${drift} file(s) differ from the catalog layer — re-run \`fluxnative-catalog emit --to ${to}\` or keep the hand edit out of generated files`);
      process.exitCode = 1;
    } else if (check) {
      console.log(`catalog layer in ${display(target)} is up to date`);
    }
  } catch (error) {
    fail(error);
  }
} else if (command === 'update') {
  expectArgs(['--to', '--colors', '--brand', '--only', '--base-dir'], ['--dry-run', '--json', '--merge']);
  const to = flag(argv, '--to');
  if (!to) usage(1);
  const json = argv.includes('--json');
  try {
    const report = update({
      to,
      colors: flag(argv, '--colors'),
      brand: flag(argv, '--brand'),
      only: flag(argv, '--only'),
      dryRun: argv.includes('--dry-run'),
      merge: argv.includes('--merge'),
      baseDir: flag(argv, '--base-dir'),
      commit: catalogCommit(),
    });
    if (json) console.log(JSON.stringify(report, null, 2));
    else printUpdate(report, resolve(process.cwd(), to));
    process.exitCode = updateExitCode(report);
  } catch (error) {
    fail(error, json);
  }
} else if (command === 'check') {
  expectArgs(['--to', '--colors', '--brand', '--only'], ['--upstream', '--strict', '--check']);
  const to = flag(argv, '--to');
  if (!to) usage(2);
  const upstream = argv.includes('--upstream');
  const strict = argv.includes('--strict');
  if (strict && !upstream) {
    console.error('--strict only applies with --upstream');
    usage(2);
  }
  try {
    const target = resolve(process.cwd(), to);
    const result = checkTemplate({ to, colors: flag(argv, '--colors'), brand: flag(argv, '--brand'), only: flag(argv, '--only'), upstream });
    for (const path of result.missing) console.error(`missing: ${display(join(target, path))}`);
    for (const path of result.stale) console.error(`stale: ${display(join(target, path))}`);
    for (const problem of result.inputs) console.error(`inputs: ${problem}`);
    const problems = result.missing.length + result.stale.length + result.inputs.length;
    if (problems) {
      console.error(
        `${problems} problem(s): ${display(target)} no longer matches its ${MANIFEST_FILE} — undo the hand edits or declare forks, and run \`fluxnative-catalog update --to ${to}\` for new inputs`,
      );
      process.exitCode = 1;
    } else {
      console.log(`catalog layer in ${display(target)} is up to date with its manifest (@fluxnative/catalog ${result.version})`);
    }
    if (upstream) {
      for (const { path, change } of result.updates) console.log(`update available: ${display(join(target, path))} (${change})`);
      for (const fork of result.staleForks) console.log(`fork behind the catalog: ${display(join(target, fork.path))}`);
      const pending = result.updates.length + result.staleForks.length;
      if (pending === 0) {
        console.log(`no update available from @fluxnative/catalog ${CATALOG_VERSION}`);
      } else {
        console.log(`@fluxnative/catalog ${CATALOG_VERSION} would change ${pending} file(s): run \`fluxnative-catalog update --to ${to}\``);
        if (strict) process.exitCode = 1;
      }
    }
  } catch (error) {
    fail(error);
  }
} else {
  usage(command === '--help' || command === '-h' ? 0 : 2);
}
