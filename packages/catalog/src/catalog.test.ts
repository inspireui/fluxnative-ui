import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { DOCS_URL, FILES_DIR, GENERATED, componentDeps, importGraph, listFiles, render, selectFiles } from './emit.ts';
import { emitIcon } from './icon.ts';
import { MANIFEST_FILE, loadManifest, parseManifest, readManifest, renderManifest, sha256 } from './manifest.ts';
import { COLOR_NAMES, emitTokens, resolveColors, validateOverrides } from './tokens.ts';

const CLI = join(import.meta.dirname, 'cli.ts');

test('validateOverrides accepts the documented shape and rejects the rest', () => {
  assert.deepEqual(validateOverrides({ scheme: 'dark', dark: { primary: '#fff', scrim: 'rgba(0,0,0,0.45)' } }), {
    scheme: 'dark',
    dark: { primary: '#fff', scrim: 'rgba(0,0,0,0.45)' },
  });
  assert.throws(() => validateOverrides({ light: { brand: '#000' } }), /light\.brand: not a token color/);
  assert.throws(() => validateOverrides({ light: { primary: 'red' } }), /light\.primary: expected #rgb/);
  assert.throws(() => validateOverrides({ scheme: 'auto' }), /scheme must be/);
  assert.throws(() => validateOverrides({ colors: {} }), /unknown key "colors"/);
  assert.throws(() => validateOverrides([]), /expected an object/);
});

test('resolveColors applies overrides per scheme and keeps every token name', () => {
  const out = resolveColors({ light: { primary: '#123456' } });
  assert.equal(out.light.primary, '#123456');
  assert.notEqual(out.dark.primary, '#123456');
  for (const scheme of ['light', 'dark'] as const) assert.deepEqual(Object.keys(out[scheme]), COLOR_NAMES);
});

test('emitTokens writes a dependency-free module with the locked scheme', () => {
  const src = emitTokens({ overrides: { scheme: 'light' }, overridesLabel: 'colors.json' });
  assert.doesNotMatch(src, /^import /m);
  assert.match(src, /export const lockedScheme: ColorScheme \| null = 'light';/);
  assert.match(src, /Colour overrides: colors\.json/);
  assert.match(src, /export const space = \{\n  "0": 0,\n  "1": 4,/);
  assert.match(src, /"0.5": 2/);
  assert.match(src, /export const fontWeight = \{\n  "thin": "100"/);
  assert.match(emitTokens(), /lockedScheme: ColorScheme \| null = null;/);
});

test('emitIcon carries the whole icon table and only template-dialect imports', () => {
  const src = emitIcon();
  assert.match(src, /"chevron-left": \{ path: "M/);
  assert.match(src, /export default function Icon\(/);
  const imports = [...src.matchAll(/^import .* from '([^']+)';$/gm)].map((m) => m[1]);
  assert.deepEqual(imports, ['react', 'react-native', 'react-native-svg', '../theme/usePalette']);
});

test('selectFiles keeps theme files and the dependencies of a selected primitive', () => {
  const all = listFiles();
  const picked = selectFiles(all, ['Button']);
  assert.ok(picked.includes('theme/usePalette.ts'));
  assert.ok(picked.includes('components/Button.tsx'));
  assert.ok(picked.includes('components/Press.tsx'));
  assert.ok(picked.includes('components/bridge.ts'));
  assert.ok(!picked.includes('components/Sheet.tsx'));
  assert.throws(() => selectFiles(all, ['Modal']), /unknown component\(s\) Modal/);
});

test('render produces a manifest whose hashes match the content', () => {
  const { files, manifest } = render({ overrides: { dark: { background: '#000' } } });
  for (const [path, hash] of Object.entries(manifest.files)) assert.equal(sha256(files[path] ?? ''), hash, path);
  assert.equal(manifest.inputs.only, null);
  assert.ok(manifest.inputs.colors);
  assert.match(files['theme/tokens.ts'] ?? '', /"background": "#000"/);
});

test('cli emit writes the layer, check passes, a hand edit fails check', () => {
  const dir = mkdtempSync(join(tmpdir(), 'fluxnative-catalog-'));
  try {
    const colors = join(dir, 'colors.json');
    writeFileSync(colors, JSON.stringify({ scheme: 'dark', dark: { primary: '#ff0000' } }));
    const files = join(dir, 'files');
    execFileSync('node', [CLI, 'emit', '--to', files, '--colors', colors, '--only', 'Button,Icon'], { stdio: 'pipe' });
    const manifest = readManifest(join(files, '.fluxnative-ui.json'));
    assert.ok(manifest);
    assert.deepEqual(manifest.inputs.only, ['Button', 'Icon']);
    assert.match(readFileSync(join(files, 'theme/tokens.ts'), 'utf8'), /"primary": "#ff0000"/);
    assert.match(readFileSync(join(files, 'theme/tokens.ts'), 'utf8'), /Colour overrides: \.\.\/colors\.json/);
    // check reuses the manifest's --only
    const ok = execFileSync('node', [CLI, 'check', '--to', files, '--colors', colors], { encoding: 'utf8' });
    assert.match(ok, /up to date/);
    writeFileSync(join(files, 'components/Button.tsx'), '// edited\n', { flag: 'a' });
    assert.throws(
      () => execFileSync('node', [CLI, 'check', '--to', files, '--colors', colors], { stdio: 'pipe' }),
      (e: { stderr: Buffer }) => /stale: .*components\/Button\.tsx/.test(e.stderr.toString()),
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// The table `selectFiles` used before dependencies were inferred from imports.
const OLD_DEPS: Record<string, string[]> = {
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

function oldSelectFiles(all: string[], only: string[]): string[] {
  const wanted = new Set(only);
  for (const name of only) for (const dep of OLD_DEPS[name] ?? []) wanted.add(dep);
  return all.filter((f) => !f.startsWith('components/') || wanted.has(f.replace(/^components\//, '').replace(/\.tsx?$/, '')));
}

test('inferred dependencies equal the old table, plus the bridge edge it missed', () => {
  const inferred = componentDeps();
  // useReducedMotion imports ./bridge, which the table left out: `--only Reveal`
  // used to emit a useReducedMotion.ts whose import did not resolve.
  const expected: Record<string, string[]> = {
    ...OLD_DEPS,
    Reveal: ['bridge', 'useReducedMotion'],
    Skeleton: ['bridge', 'useReducedMotion'],
    Sheet: ['Scrim', 'bridge', 'useReducedMotion'],
    useReducedMotion: ['bridge'],
  };
  for (const [name, deps] of Object.entries(inferred)) assert.deepEqual(deps, [...(expected[name] ?? [])].sort(), name);
  for (const [name, deps] of Object.entries(OLD_DEPS)) for (const dep of deps) assert.ok(inferred[name]?.includes(dep), `${name} → ${dep}`);
  // The three templates on the layer select the same files as before.
  const pilots = [
    ['Press', 'Reveal', 'Skeleton', 'Sheet', 'Chip', 'Button', 'IconButton', 'StateView', 'Icon'],
    ['Press', 'Reveal', 'Skeleton', 'Scrim', 'IconButton', 'StateView', 'Icon'],
    ['Press', 'Reveal', 'Skeleton', 'Icon'],
  ];
  for (const only of pilots) assert.deepEqual(selectFiles(listFiles(), only), oldSelectFiles(listFiles(), only));
  assert.ok(selectFiles(listFiles(), ['Reveal']).includes('components/bridge.ts'));
});

test('importGraph follows multi-line, type-only and re-export imports and rejects one that leaves the layer', () => {
  const graph = importGraph({
    'components/A.tsx': "import React from 'react';\nimport {\n  b,\n} from './B';\nimport type { T } from '../theme/T';\nexport { c } from './C';\nconst s = './D';\n",
    'components/B.ts': '',
    'components/C.ts': '',
    'theme/T.ts': '',
  });
  assert.deepEqual(graph['components/A.tsx'], ['components/B.ts', 'components/C.ts', 'theme/T.ts']);
  assert.throws(() => importGraph({ 'components/A.tsx': "import X from './Missing';\n" }), /imports '\.\/Missing', which is not a file of the catalog layer/);
});

test('every emitted source carries the header; the static sources in files/ do not', () => {
  const { files } = render();
  for (const [path, content] of Object.entries(files)) {
    if (path === MANIFEST_FILE) continue;
    const [first, second] = content.split('\n');
    assert.equal(first, `// FluxNative UI catalog · ${path} · ${DOCS_URL}`, path);
    assert.doesNotMatch(`${first}\n${second}`, /\d+\.\d+\.\d+/, `${path}: no version in the header`);
    if ((GENERATED as readonly string[]).includes(path)) {
      assert.match(second ?? '', /^\/\/ Generated by @fluxnative\/catalog .* do not edit by hand\.$/, path);
      assert.equal(readFileSync(join(FILES_DIR, path), 'utf8'), content, `${path}: build writes the generated file as emitted`);
    } else {
      assert.equal(second, `// Emitted by fluxnative-catalog — declare a fork in ${MANIFEST_FILE} instead of editing.`, path);
      const source = readFileSync(join(FILES_DIR, path), 'utf8');
      assert.ok(!source.startsWith('// FluxNative UI catalog'), `${path}: the source stays header-less`);
      assert.ok(content.endsWith(`\n\n${source}`), path);
    }
  }
});

test("this package's own manifest is schema 2 with commit null, whatever the environment says", () => {
  const loaded = loadManifest(join(FILES_DIR, MANIFEST_FILE));
  assert.equal(loaded?.schema, 2);
  assert.equal(loaded?.manifest.catalog.commit, null);
  assert.equal(readFileSync(join(FILES_DIR, MANIFEST_FILE), 'utf8'), render().files[MANIFEST_FILE]);
  const env = { ...process.env, FLUXNATIVE_CATALOG_COMMIT: '0123456789abcdef0123456789abcdef01234567' };
  assert.match(execFileSync(process.execPath, [CLI, 'build', '--check'], { encoding: 'utf8', env }), /catalog files up to date/);
});

test('parseManifest upgrades schema 1, round-trips schema 2 and names what it rejects', () => {
  const hash = 'a'.repeat(64);
  const { manifest, schema } = parseManifest(JSON.stringify({ version: '0.0.0', colors: null, only: ['Press'], files: { 'components/Press.tsx': hash } }));
  assert.equal(schema, 1);
  assert.deepEqual(manifest, {
    schema: 2,
    catalog: { version: '0.0.0', commit: null, repo: 'inspireui/fluxnative-ui' },
    inputs: { colors: null, colorsPath: null, brand: null, brandPath: null, only: ['Press'] },
    files: { 'components/Press.tsx': hash },
    forks: {},
    compositions: {},
    applied: { codemods: [] },
  });
  const text = renderManifest(manifest);
  assert.equal(renderManifest(parseManifest(text).manifest), text);
  assert.deepEqual(Object.keys(JSON.parse(text)), ['schema', 'catalog', 'inputs', 'files', 'forks', 'compositions', 'applied']);
  const doc = JSON.parse(text);
  const reject = (patch: object, pattern: RegExp) => assert.throws(() => parseManifest(JSON.stringify({ ...doc, ...patch })), pattern);
  reject({ extra: 1 }, /unknown key\(s\) extra/);
  reject({ schema: 3 }, /schema 3 is not supported/);
  reject({ files: { '../escape.ts': hash } }, /not a relative path inside the files dir/);
  reject({ files: { 'components/Press.tsx': 'nope' } }, /expected a sha256 hex digest/);
  reject({ forks: { 'components/Sheet.tsx': { reason: 'own handle', since: '0.0.0' } } }, /upstream: expected a sha256/);
  reject({ compositions: { 'components/Cta.tsx': { wraps: 'Button', reason: '' } } }, /reason: expected a non-empty string/);
  assert.throws(() => parseManifest('{'), /not valid JSON/);
});
