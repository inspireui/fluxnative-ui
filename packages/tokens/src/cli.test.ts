import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const PACKAGE_ROOT = join(import.meta.dirname, '..');
const pkg = JSON.parse(readFileSync(join(PACKAGE_ROOT, 'package.json'), 'utf8')) as {
  bin: Record<string, string>;
  files: string[];
};
const BIN = pkg.bin['fluxnative-tokens'] ?? 'missing bin';
// What `pnpm tokens` writes for the example app. The CLI must write the same bytes.
const EXPECTED = readFileSync(join(PACKAGE_ROOT, '..', '..', 'apps', 'expo-example', 'src', 'global.css'), 'utf8');

function cli(args: string[], cwd: string, root = PACKAGE_ROOT) {
  return spawnSync(process.execPath, [join(root, BIN), ...args], { cwd, encoding: 'utf8' });
}

function inTempDir(fn: (dir: string) => void): void {
  const dir = mkdtempSync(join(tmpdir(), 'fluxnative-tokens-'));
  try {
    fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test('global-css writes the global.css that `pnpm tokens` writes', () =>
  inTempDir((dir) => {
    const first = cli(['global-css', '--out', 'src/global.css'], dir);
    assert.equal(first.status, 0, first.stderr);
    assert.match(first.stdout, /wrote src[\\/]global\.css/);
    assert.equal(readFileSync(join(dir, 'src', 'global.css'), 'utf8'), EXPECTED);

    const again = cli(['global-css', '--out=src/global.css'], dir);
    assert.equal(again.status, 0, again.stderr);
    assert.match(again.stdout, /is up to date/);
  }));

test('--check writes nothing and exits 1 when the file is missing or edited', () =>
  inTempDir((dir) => {
    const file = join(dir, 'global.css');
    const args = ['global-css', '--out', 'global.css', '--check'];

    const missing = cli(args, dir);
    assert.equal(missing.status, 1);
    assert.match(missing.stderr, /missing: global\.css/);
    assert.equal(existsSync(file), false);

    const edited = `${EXPECTED}/* hand edit */\n`;
    writeFileSync(file, edited);
    const stale = cli(args, dir);
    assert.equal(stale.status, 1);
    assert.match(stale.stderr, /stale: global\.css — run `npx fluxnative-tokens global-css --out global\.css`/);
    assert.equal(readFileSync(file, 'utf8'), edited);

    writeFileSync(file, EXPECTED);
    assert.equal(cli(args, dir).status, 0);
  }));

test('the bin runs from an installed copy under node_modules', () =>
  inTempDir((dir) => {
    // Node refuses to strip types under node_modules; the bin must not rely on it.
    const installed = join(dir, 'node_modules', '@fluxnative', 'tokens');
    mkdirSync(installed, { recursive: true });
    // `files` also lists negated globs (tests stay out of the tarball); copy the plain entries.
    for (const entry of ['package.json', ...pkg.files.filter((f: string) => !f.startsWith('!'))]) {
      cpSync(join(PACKAGE_ROOT, entry), join(installed, entry), { recursive: true });
    }
    const result = cli(['global-css', '--out', 'src/global.css'], dir, installed);
    assert.equal(result.status, 0, result.stderr);
    assert.doesNotMatch(result.stderr, /stripTypeScriptTypes/);
    assert.equal(readFileSync(join(dir, 'src', 'global.css'), 'utf8'), EXPECTED);
  }));

test('refuses to write inside the package or a node_modules folder', () =>
  inTempDir((dir) => {
    symlinkSync(PACKAGE_ROOT, join(dir, 'linked'), 'junction');
    const targets = [
      join(PACKAGE_ROOT, 'global.css'),
      join('node_modules', 'some-lib', 'global.css'),
      join('linked', 'out', 'global.css'),
    ];
    for (const out of targets) {
      const result = cli(['global-css', '--out', out], dir);
      assert.equal(result.status, 2, out);
      assert.match(result.stderr, /refusing to write/);
    }
    assert.equal(existsSync(join(PACKAGE_ROOT, 'global.css')), false);
    assert.equal(existsSync(join(PACKAGE_ROOT, 'out')), false);
    assert.equal(existsSync(join(dir, 'node_modules')), false);
  }));

test('usage errors exit 2 and print the usage', () =>
  inTempDir((dir) => {
    const bad = [[], ['css'], ['global-css'], ['global-css', '--out'], ['global-css', '--out', 'a.css', '--force']];
    for (const args of bad) {
      const result = cli(args, dir);
      assert.equal(result.status, 2, args.join(' '));
      assert.match(result.stderr, /usage: fluxnative-tokens global-css --out <path> \[--check\]/);
    }
    const directory = cli(['global-css', '--out', '.'], dir);
    assert.equal(directory.status, 2);
    assert.match(directory.stderr, /is a directory/);

    const help = cli(['--help'], dir);
    assert.equal(help.status, 0);
    assert.match(help.stdout, /usage: fluxnative-tokens/);
  }));
