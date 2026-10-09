import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { test, type TestContext } from 'node:test';
import { unifiedDiff } from './diff.ts';
import { CATALOG_VERSION, FILES_DIR, GENERATED, render } from './emit.ts';
import { MANIFEST_FILE, loadManifest, renderManifest, sha256, type Manifest } from './manifest.ts';
import { validateOverrides, type ColorOverrides } from './tokens.ts';
import { applyOnly, parseOnly } from './update.ts';

const CLI = join(import.meta.dirname, 'cli.ts');
/** What CLI runs record as `catalog.commit` (FLUXNATIVE_CATALOG_COMMIT). */
const COMMIT = '0123456789abcdef0123456789abcdef01234567';
const BUTTON = 'components/Button.tsx';

function tempDir(t: TestContext): string {
  const dir = mkdtempSync(join(tmpdir(), 'fluxnative-update-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}

function cli(args: string[]): { status: number | null; stdout: string; stderr: string } {
  const result = spawnSync(process.execPath, [CLI, ...args], { encoding: 'utf8', env: { ...process.env, FLUXNATIVE_CATALOG_COMMIT: COMMIT } });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

/** `update --json` (plus `args`), asserting the exit code; returns the report. */
function updateJson(files: string, args: string[], status: number) {
  const result = cli(['update', '--to', files, '--json', ...args]);
  assert.equal(result.status, status, result.stderr);
  return JSON.parse(result.stdout);
}

/** `emit` into `<dir>/files`; returns the files dir. */
function emitTemplate(dir: string, args: string[] = []): string {
  const files = join(dir, 'files');
  const result = cli(['emit', '--to', files, ...args]);
  assert.equal(result.status, 0, result.stderr);
  return files;
}

const read = (files: string, path: string) => readFileSync(join(files, path), 'utf8');
const write = (files: string, path: string, content: string) => {
  mkdirSync(join(files, path, '..'), { recursive: true });
  writeFileSync(join(files, path), content);
};

function manifestOf(files: string): Manifest {
  const loaded = loadManifest(join(files, MANIFEST_FILE));
  assert.ok(loaded);
  return loaded.manifest;
}

function editManifest(files: string, edit: (manifest: Manifest) => void): void {
  const manifest = manifestOf(files);
  edit(manifest);
  writeFileSync(join(files, MANIFEST_FILE), renderManifest(manifest));
}

/**
 * Makes `path` look like an older catalog emitted it as `old`: the file holds
 * `old` and the manifest records its hash, so it is pristine but behind.
 */
function rewind(files: string, path: string, old: string): void {
  write(files, path, old);
  editManifest(files, (manifest) => {
    manifest.files[path] = sha256(old);
  });
}

/** Path → content and mtime of everything under `dir`. */
function snapshot(dir: string): Record<string, string> {
  const out: Record<string, string> = {};
  const visit = (current: string) => {
    for (const entry of readdirSync(current)) {
      const full = join(current, entry);
      if (statSync(full).isDirectory()) visit(full);
      else out[relative(dir, full)] = `${statSync(full).mtimeMs} ${readFileSync(full, 'utf8')}`;
    }
  };
  visit(dir);
  return out;
}

test('--only parsing: a list replaces, +/- edits, names the catalog dropped are reported', () => {
  const known = ['Button', 'Press', 'Sheet', 'Icon'];
  assert.deepEqual(parseOnly(undefined), { kind: 'keep' });
  assert.deepEqual(parseOnly('Button, Icon,Button'), { kind: 'set', names: ['Button', 'Icon'] });
  assert.deepEqual(parseOnly('+Sheet,-Icon'), { kind: 'edit', add: ['Sheet'], remove: ['Icon'] });
  assert.throws(() => parseOnly('Button,+Sheet'), /not both/);
  assert.throws(() => parseOnly('+'), /needs a component name/);
  assert.deepEqual(applyOnly(['Button'], parseOnly('+Sheet'), known), { only: ['Button', 'Sheet'], warnings: [] });
  assert.deepEqual(applyOnly(null, parseOnly('+Sheet'), known), { only: null, warnings: [] });
  assert.deepEqual(applyOnly(null, parseOnly('-Sheet'), known).only, ['Button', 'Press', 'Icon']);
  assert.throws(() => applyOnly(['Button'], parseOnly('+Modal'), known), /unknown component\(s\) Modal/);
  assert.throws(() => applyOnly(['Button'], parseOnly('-Button'), known), /leaves nothing selected/);
  const dropped = applyOnly(['Button', 'Toggle'], parseOnly(undefined), known);
  assert.deepEqual(dropped.only, ['Button']);
  assert.match(dropped.warnings[0] ?? '', /Toggle is no longer in the catalog/);
});

test('unifiedDiff writes standard hunks and marks a missing final newline', () => {
  assert.equal(unifiedDiff('a\nb\n', 'a\nb\n', { from: 'a/f', to: 'b/f' }), '');
  assert.equal(unifiedDiff('a\nb\nc\n', 'a\nB\nc\n', { from: 'a/f', to: 'b/f' }), '--- a/f\n+++ b/f\n@@ -1,3 +1,3 @@\n a\n-b\n+B\n c\n');
  assert.equal(unifiedDiff('x\n', 'x', { from: 'a/f', to: 'b/f' }), '--- a/f\n+++ b/f\n@@ -1 +1 @@\n-x\n+x\n\\ No newline at end of file\n');
});

test('update replaces pristine files that are behind the catalog, then does nothing on a second run', (t) => {
  const files = emitTemplate(tempDir(t), ['--only', 'Button']);
  const current = read(files, BUTTON);
  rewind(files, BUTTON, current.replace('sm: 36,', 'sm: 34,'));
  const report = updateJson(files, [], 0);
  assert.deepEqual(Object.keys(report), ['from', 'to', 'dryRun', 'written', 'merged', 'deleted', 'unchanged', 'drift', 'conflicts', 'staleForks', 'keptLocal', 'warnings']);
  assert.deepEqual(report.from, { version: CATALOG_VERSION, commit: COMMIT });
  assert.deepEqual(report.to, { version: CATALOG_VERSION, commit: COMMIT });
  assert.deepEqual(report.written, [BUTTON]);
  assert.deepEqual([report.drift, report.conflicts, report.deleted], [[], [], []]);
  assert.equal(read(files, BUTTON), current);
  assert.equal(manifestOf(files).files[BUTTON], sha256(current));
  const before = snapshot(files);
  const again = updateJson(files, [], 0);
  assert.deepEqual([again.written, again.deleted, again.drift, again.conflicts], [[], [], [], []]);
  assert.deepEqual(snapshot(files), before, 'the second run writes nothing, the manifest included');
});

test('update --dry-run reports the plan and writes nothing', (t) => {
  const files = emitTemplate(tempDir(t), ['--only', 'Button']);
  rewind(files, BUTTON, read(files, BUTTON).replace('sm: 36,', 'sm: 34,'));
  const before = snapshot(files);
  const report = updateJson(files, ['--dry-run'], 0);
  assert.equal(report.dryRun, true);
  assert.deepEqual(report.written, [BUTTON]);
  assert.deepEqual(snapshot(files), before);
});

test('update leaves a hand edit alone and reports it with a diff (exit 2)', (t) => {
  const files = emitTemplate(tempDir(t), ['--only', 'Button']);
  const emitted = manifestOf(files).files[BUTTON];
  write(files, BUTTON, `${read(files, BUTTON)}// house tweak\n`);
  const report = updateJson(files, [], 2);
  assert.equal(report.drift.length, 1);
  assert.equal(report.drift[0].path, BUTTON);
  assert.equal(report.drift[0].reason, 'edited');
  assert.match(report.drift[0].diff, /^--- a\/components\/Button\.tsx\n\+\+\+ b\/components\/Button\.tsx\n@@ /);
  assert.match(report.drift[0].diff, /\n-\/\/ house tweak\n/);
  assert.match(read(files, BUTTON), /\/\/ house tweak\n$/);
  assert.equal(manifestOf(files).files[BUTTON], emitted, 'still recorded as the emitted copy, so it stays drift');
  const human = cli(['update', '--to', files]);
  assert.equal(human.status, 2);
  assert.match(human.stderr, /drift: .*components\/Button\.tsx \(edited by hand; not written\)/);
});

/** A template whose Button was emitted as `base` (sm: 34) and then edited to `local`; the catalog now has sm: 36. */
function mergeCase(t: TestContext, edit: (base: string) => string) {
  const dir = tempDir(t);
  const files = emitTemplate(dir, ['--only', 'Button']);
  const current = read(files, BUTTON);
  const base = current.replace('sm: 36,', 'sm: 34,');
  rewind(files, BUTTON, base);
  write(files, BUTTON, edit(base));
  const baseDir = join(dir, 'base');
  write(baseDir, BUTTON, base);
  return { files, baseDir, current };
}

test('update --merge merges a hand edit with the new catalog copy against --base-dir (exit 0)', (t) => {
  const { files, baseDir, current } = mergeCase(t, (base) => base.replace("/** Default 'primary'. */", "/** Default 'primary' (house style). */"));
  const report = updateJson(files, ['--merge', '--base-dir', baseDir], 0);
  assert.deepEqual(report.written, [BUTTON]);
  assert.deepEqual(report.merged, [BUTTON]);
  const merged = read(files, BUTTON);
  assert.match(merged, /sm: 36,/);
  assert.match(merged, /house style/);
  assert.equal(manifestOf(files).files[BUTTON], sha256(current), 'recorded as the catalog copy it was merged with');
  // The merged file still carries a hand edit: check flags it until it becomes a fork.
  assert.equal(cli(['check', '--to', files]).status, 1);
});

test('update --merge writes conflict markers and exits 2 when both sides changed the same line', (t) => {
  const { files, baseDir } = mergeCase(t, (base) => base.replace('sm: 34,', 'sm: 30,'));
  const report = updateJson(files, ['--merge', '--base-dir', baseDir], 2);
  assert.deepEqual(report.conflicts, [BUTTON]);
  assert.deepEqual(report.written, []);
  const text = read(files, BUTTON);
  for (const marker of ['<<<<<<< components/Button.tsx (template)', '||||||| components/Button.tsx (base)', '=======', '>>>>>>> components/Button.tsx (@fluxnative/catalog']) {
    assert.ok(text.includes(marker), marker);
  }
  assert.match(text, /sm: 30,[\s\S]*sm: 34,[\s\S]*sm: 36,/);
});

test('update --merge reports drift when the base is missing or is not the recorded copy', (t) => {
  const { files, baseDir } = mergeCase(t, (base) => `${base}// tweak\n`);
  const empty = join(baseDir, '..', 'empty');
  mkdirSync(empty);
  assert.equal(updateJson(files, ['--merge', '--base-dir', empty], 2).drift[0].reason, 'no-base');
  write(baseDir, BUTTON, '// some other copy\n');
  assert.equal(updateJson(files, ['--merge', '--base-dir', baseDir], 2).drift[0].reason, 'base-mismatch');
  const noBase = cli(['update', '--to', files, '--merge']);
  assert.equal(noBase.status, 1);
  assert.match(noBase.stderr, /--merge needs --base-dir/);
});

test('a declared fork is never written; update reports it once the catalog copy moves on', (t) => {
  const files = emitTemplate(tempDir(t), ['--only', 'Sheet']);
  const sheet = 'components/Sheet.tsx';
  const forked = `${read(files, sheet)}// our drag handle\n`;
  write(files, sheet, forked);
  editManifest(files, (manifest) => {
    const upstream = manifest.files[sheet];
    assert.ok(upstream);
    delete manifest.files[sheet];
    manifest.forks[sheet] = { reason: 'own drag handle', since: CATALOG_VERSION, upstream };
  });
  const quiet = updateJson(files, [], 0);
  assert.deepEqual(quiet.staleForks, []);
  assert.equal(cli(['check', '--to', files]).status, 0, 'check ignores forks');
  const catalogCopy = sha256(render().files[sheet] ?? '');
  editManifest(files, (manifest) => {
    const fork = manifest.forks[sheet];
    assert.ok(fork);
    fork.upstream = 'b'.repeat(64);
  });
  const stale = updateJson(files, [], 2);
  assert.deepEqual(stale.staleForks, [{ path: sheet, upstream: 'b'.repeat(64), current: catalogCopy }]);
  assert.equal(read(files, sheet), forked);
  // emit keeps the fork too.
  assert.equal(cli(['emit', '--to', files]).status, 0);
  assert.equal(read(files, sheet), forked);
  assert.equal(manifestOf(files).forks[sheet]?.reason, 'own drag handle');
  assert.equal(manifestOf(files).files[sheet], undefined);
});

test('a declared composition is left untouched by update, check and emit', (t) => {
  const files = emitTemplate(tempDir(t), ['--only', 'Button']);
  const path = 'components/CtaButton.tsx';
  const wrapper = "import React from 'react';\nimport Button, { type ButtonProps } from './Button';\n\nexport default function CtaButton(props: ButtonProps) {\n  return <Button {...props} size=\"lg\" />;\n}\n";
  write(files, path, wrapper);
  editManifest(files, (manifest) => {
    manifest.compositions[path] = { wraps: 'Button', reason: '60 px checkout CTA' };
  });
  const report = updateJson(files, [], 0);
  const listed = [...report.written, ...report.deleted, ...report.unchanged, ...report.keptLocal, ...report.drift.map((d: { path: string }) => d.path)];
  assert.ok(!listed.includes(path));
  assert.equal(cli(['check', '--to', files]).status, 0);
  assert.equal(cli(['emit', '--to', files]).status, 0);
  assert.equal(read(files, path), wrapper);
  assert.deepEqual(manifestOf(files).compositions, { [path]: { wraps: 'Button', reason: '60 px checkout CTA' } });
});

test('update --only +X adds X and what it imports; -X deletes what nothing needs any more', (t) => {
  const files = emitTemplate(tempDir(t), ['--only', 'Press']);
  const added = updateJson(files, ['--only', '+StateView'], 0);
  assert.deepEqual(added.written, [BUTTON, 'components/StateView.tsx']);
  assert.deepEqual(manifestOf(files).inputs.only, ['Press', 'StateView']);
  const stays = updateJson(files, ['--only', '-Press', '--dry-run'], 0);
  assert.deepEqual(stays.warnings, ['--only: Press stays, StateView imports it']);
  const removed = updateJson(files, ['--only', '-StateView'], 0);
  assert.deepEqual(removed.deleted, [BUTTON, 'components/StateView.tsx']);
  assert.ok(!existsSync(join(files, BUTTON)));
  assert.deepEqual(manifestOf(files).inputs.only, ['Press']);
  assert.equal(cli(['update', '--to', files, '--only', 'Modal']).status, 1);
});

test('a file the catalog no longer ships is deleted when pristine and kept when edited', (t) => {
  const files = emitTemplate(tempDir(t), ['--only', 'Press']);
  write(files, 'components/Legacy.tsx', 'export {};\n');
  write(files, 'components/Old.tsx', 'export const edited = true;\n');
  editManifest(files, (manifest) => {
    manifest.files['components/Legacy.tsx'] = sha256('export {};\n');
    manifest.files['components/Old.tsx'] = sha256('export {};\n');
  });
  const report = updateJson(files, [], 0);
  assert.deepEqual(report.deleted, ['components/Legacy.tsx']);
  assert.deepEqual(report.keptLocal, ['components/Old.tsx']);
  assert.ok(!existsSync(join(files, 'components/Legacy.tsx')));
  assert.ok(existsSync(join(files, 'components/Old.tsx')));
  const manifest = manifestOf(files);
  assert.equal(manifest.files['components/Legacy.tsx'], undefined);
  assert.equal(manifest.files['components/Old.tsx'], undefined);
});

test('update migrates a schema 1 template: pristine files gain the header, the manifest becomes schema 2', (t) => {
  const dir = tempDir(t);
  const files = join(dir, 'files');
  const colorsFile = join(dir, 'colors.json');
  const colors: ColorOverrides = { scheme: 'light', light: { primary: '#123456' } };
  writeFileSync(colorsFile, JSON.stringify(colors));
  // What the schema 1 CLI wrote: the same layer without headers.
  const { files: now } = render({ overrides: colors, overridesLabel: '../colors.json', only: ['Press', 'Icon'] });
  const v1: Record<string, string> = {};
  for (const [path, content] of Object.entries(now)) {
    if (path === MANIFEST_FILE) continue;
    const old = (GENERATED as readonly string[]).includes(path) ? content.slice(content.indexOf('\n') + 1) : readFileSync(join(FILES_DIR, path), 'utf8');
    write(files, path, old);
    v1[path] = sha256(old);
  }
  const colorsHash = sha256(JSON.stringify(validateOverrides(colors)));
  writeFileSync(join(files, MANIFEST_FILE), `${JSON.stringify({ version: '0.0.0', colors: colorsHash, only: ['Press', 'Icon'], files: v1 }, null, 2)}\n`);
  const noColors = cli(['update', '--to', files]);
  assert.equal(noColors.status, 1);
  assert.match(noColors.stderr, /records colour overrides but not their file .*: pass --colors/);
  const report = updateJson(files, ['--colors', colorsFile], 0);
  assert.deepEqual(report.from, { version: '0.0.0', commit: null });
  assert.deepEqual(report.written, Object.keys(v1).sort());
  for (const path of Object.keys(v1)) assert.equal(read(files, path), now[path], path);
  const loaded = loadManifest(join(files, MANIFEST_FILE));
  assert.equal(loaded?.schema, 2);
  assert.deepEqual(loaded?.manifest.catalog, { version: CATALOG_VERSION, commit: COMMIT, repo: 'inspireui/fluxnative-ui' });
  assert.deepEqual(loaded?.manifest.inputs, { colors: colorsHash, colorsPath: '../colors.json', brand: null, brandPath: null, brandFiles: null, only: ['Press', 'Icon'] });
  // From now on the manifest knows where the colours live.
  const again = updateJson(files, [], 0);
  assert.deepEqual(again.written, []);
  assert.equal(cli(['check', '--to', files]).status, 0);
});

test('check verifies the template against its manifest; --upstream lists what update would change', (t) => {
  const dir = tempDir(t);
  const colorsFile = join(dir, 'colors.json');
  writeFileSync(colorsFile, JSON.stringify({ dark: { primary: '#ff0000' } }));
  const files = emitTemplate(dir, ['--only', 'Button', '--colors', colorsFile]);
  rewind(files, BUTTON, read(files, BUTTON).replace('sm: 36,', 'sm: 34,'));
  const ok = cli(['check', '--to', files]);
  assert.equal(ok.status, 0, ok.stderr);
  assert.match(ok.stdout, /up to date with its manifest/);
  const upstream = cli(['check', '--to', files, '--upstream']);
  assert.equal(upstream.status, 0);
  assert.match(upstream.stdout, /update available: .*components\/Button\.tsx \(changed\)/);
  assert.equal(cli(['check', '--to', files, '--upstream', '--strict']).status, 1);
  assert.equal(cli(['check', '--to', files, '--strict']).status, 2);
  writeFileSync(colorsFile, JSON.stringify({ dark: { primary: '#00ff00' } }));
  const inputs = cli(['check', '--to', files]);
  assert.equal(inputs.status, 1);
  assert.match(inputs.stderr, /inputs: colour overrides \.\.\/colors\.json changed since the files were emitted/);
  rmSync(colorsFile);
  assert.match(cli(['check', '--to', files]).stderr, /records colour overrides from \.\.\/colors\.json, which is gone/);
});

test('emit --check still compares bytes; update and check refuse unknown arguments and this package', (t) => {
  const files = emitTemplate(tempDir(t), ['--only', 'Press']);
  assert.equal(cli(['emit', '--to', files, '--check']).status, 0);
  write(files, 'components/Press.tsx', `${read(files, 'components/Press.tsx')}// edited\n`);
  const stale = cli(['emit', '--to', files, '--check']);
  assert.equal(stale.status, 1);
  assert.match(stale.stderr, /stale: .*components\/Press\.tsx/);
  assert.equal(cli(['update', '--to', files, '--dryrun']).status, 1);
  assert.equal(cli(['check', '--to', files, '--strct']).status, 2);
  const own = cli(['update', '--to', FILES_DIR]);
  assert.equal(own.status, 1);
  assert.match(own.stderr, /own files\/; regenerate it with `fluxnative-catalog build`/);
  assert.equal(cli(['emit', '--to', FILES_DIR]).status, 1);
  const missing = cli(['update', '--to', join(files, '..', 'nowhere')]);
  assert.equal(missing.status, 1);
  assert.match(missing.stderr, /has no \.fluxnative-ui\.json: run `fluxnative-catalog emit/);
});
