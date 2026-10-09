import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { DOCS_URL, FILES_DIR, GENERATED, componentDeps, importGraph, listFiles, render, selectFiles } from './emit.ts';
import { emitIcon } from './icon.ts';
import { MANIFEST_FILE, loadManifest, parseManifest, readManifest, renderManifest, sha256 } from './manifest.ts';
import { COLOR_NAMES, emitTokens, kitSources, resolveColors, validateOverrides } from './tokens.ts';
import { brandLayers, resolveBrand } from '@fluxnative/tokens/brand';

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
    inputs: { colors: null, colorsPath: null, brand: null, brandPath: null, brandFiles: null, only: ['Press'] },
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

const px = (value: number) => ({ value, unit: 'px' });
const srgb = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return { colorSpace: 'srgb', components: [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => Math.round((c / 255) * 10000) / 10000), hex };
};
/** A small brand: locked light, a serif display, rounder cards, a light haptic. */
const BRAND = {
  $extensions: { 'dev.fluxnative.brand': { schemaVersion: 1, scheme: 'light', density: 'compact', haptic: 'light' } },
  color: { $type: 'color', primary: { $value: srgb('#1b5e20') } },
  font: { $type: 'fontFamily', display: { $value: ['Georgia', 'serif'] } },
  type: {
    $type: 'typography',
    display: { $value: { fontFamily: '{font.display}', fontSize: px(28), fontWeight: 700, lineHeight: 1.15, letterSpacing: px(-0.4) } },
  },
  shape: { $type: 'dimension', card: { $value: '{radius.3xl}' } },
  duration: { $type: 'duration', normal: { $value: { value: 220, unit: 'ms' } } },
  layout: { $type: 'dimension', 'tab-bar-height': { $value: px(84) } },
};

test('emitTokens with a brand: colours, scheme, motion and the sys sections', () => {
  const brand = resolveBrand(brandLayers({ file: 'brand.tokens.json', doc: BRAND }), kitSources());
  const src = emitTokens({ brand, overridesLabel: '../design/brand.tokens.json' });
  assert.doesNotMatch(src, /^import /m);
  assert.match(src, /^\/\/ Brand: \.\.\/design\/brand\.tokens\.json\. Regenerate with/m);
  assert.match(src, /export const lockedScheme: ColorScheme \| null = 'light';/);
  assert.match(src, /"light": \{[^}]*"primary": "#1b5e20"/);
  assert.match(src, /"dark": \{[^}]*"primary": "#0a84ff"/, 'dark keeps the kit palette');
  assert.match(src, /export const duration = \{\n {2}"fast": 150,\n {2}"normal": 220,/);
  assert.match(src, /"display": \{\n {4}"fontFamily": "Georgia",\n {4}"fontSize": 28,\n {4}"lineHeight": 32,/);
  assert.match(src, /"title": \{\n {4}"fontFamily": "Georgia",/, 'roles that alias font.display follow it');
  assert.match(src, /export const shape = \{[^}]*"card": 24,/);
  assert.match(src, /"haptic": "light"/);
  assert.match(src, /"tabBarHeight": 84/);
  assert.match(src, /export const density: Density = 'compact';/);
  // The kit-only scales don't move.
  assert.match(src, /export const radius = \{\n {2}"xs": 2,/);
  assert.match(src, /export const chrome = \{\n {2}"appBarHeight": 44,\n {2}"tabBarHeight": 56,/);
  assert.throws(() => emitTokens({ brand, overrides: { scheme: 'dark' } }), /colour overrides or a brand, not both/);
});

test('with no brand, the emitted tokens are v0 plus the new colour roles and appended sections', () => {
  // `fixtures/theme-tokens.v0.txt` is theme/tokens.ts as emitted before token contract v0.1.
  const before = readFileSync(join(import.meta.dirname, 'fixtures', 'theme-tokens.v0.txt'), 'utf8');
  // The emitted copy starts with the catalog header line; v0 had none.
  const now = (render().files['theme/tokens.ts'] ?? '').split('\n').slice(1).join('\n');
  const roles = ['foreground-soft', 'border-soft', 'success-foreground', 'warning-foreground', 'inverse', 'inverse-foreground', 'tertiary', 'tertiary-foreground'];
  const lines = now.split('\n');
  const kept: string[] = [];
  let removed = 0;
  for (const line of lines) {
    const union = roles.some((r) => line === `  | '${r}'`);
    const value = roles.some((r) => new RegExp(`^ {4}"${r}": "[^"]+",$`).test(line));
    if (union && kept.at(-1)?.startsWith('  /** ')) {
      kept.pop();
      removed += 1;
    }
    if (union || value) {
      removed += 1;
      continue;
    }
    kept.push(line);
  }
  // Eight roles: a union member with its JSDoc, plus a value per scheme. Nothing else moved.
  assert.equal(removed, roles.length * 4);
  const stripped = kept.join('\n');
  assert.ok(stripped.startsWith(before), 'every v0 section is byte-identical');
  assert.match(stripped.slice(before.length), /^\n\/\*\* Font stack per role/);
});

test('cli emit --brand writes the brand, check passes, and --colors is exclusive', () => {
  const dir = mkdtempSync(join(tmpdir(), 'fluxnative-catalog-brand-'));
  try {
    const design = join(dir, 'design');
    mkdirSync(design);
    writeFileSync(join(design, 'brand.tokens.json'), JSON.stringify(BRAND));
    const files = join(dir, 'files');
    const out = execFileSync('node', [CLI, 'emit', '--to', files, '--brand', design, '--only', 'Button'], { encoding: 'utf8', stdio: 'pipe' });
    assert.match(out, /wrote .*theme\/tokens\.ts/);
    const tokens = readFileSync(join(files, 'theme/tokens.ts'), 'utf8');
    assert.match(tokens, /^\/\/ Brand: \.\.\/design\. Regenerate/m);
    assert.match(tokens, /"primary": "#1b5e20"/);
    assert.match(tokens, /export const density: Density = 'compact';/);
    const manifest = readManifest(join(files, '.fluxnative-ui.json'));
    assert.ok(manifest?.inputs.brand, 'the manifest records the brand fingerprint');
    assert.equal(manifest?.inputs.brandPath, '../design');
    assert.deepEqual(Object.keys(manifest?.inputs.brandFiles ?? {}), ['../design/brand.tokens.json']);
    assert.equal(manifest?.inputs.colors, null);
    assert.match(execFileSync('node', [CLI, 'check', '--to', files, '--brand', design], { encoding: 'utf8' }), /up to date/);

    const colors = join(dir, 'colors.json');
    writeFileSync(colors, '{}');
    assert.throws(
      () => execFileSync('node', [CLI, 'emit', '--to', files, '--brand', design, '--colors', colors], { stdio: 'pipe' }),
      (e: { status: number; stderr: Buffer }) => e.status === 2 && /--colors and --brand are exclusive/.test(e.stderr.toString()),
    );

    writeFileSync(join(design, 'brand.tokens.json'), JSON.stringify({ ...BRAND, layout: { $type: 'dimension', gutter: { $value: px(18) } }, spacing: {} }));
    assert.throws(
      () => execFileSync('node', [CLI, 'emit', '--to', files, '--brand', design], { stdio: 'pipe' }),
      (e: { status: number; stderr: Buffer }) =>
        e.status === 1 && /brand: 2 errors/.test(e.stderr.toString()) && /layout\.gutter: 18px must be 16, 20 or 24/.test(e.stderr.toString()) && /spacing: is kit-only/.test(e.stderr.toString()),
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('a brand edit after emit: check names the changed file, update re-renders, check passes again', () => {
  const dir = mkdtempSync(join(tmpdir(), 'fluxnative-catalog-brand-update-'));
  try {
    const design = join(dir, 'design');
    mkdirSync(design);
    const brandFile = join(design, 'brand.tokens.json');
    writeFileSync(brandFile, JSON.stringify(BRAND));
    const files = join(dir, 'files');
    execFileSync('node', [CLI, 'emit', '--to', files, '--brand', design, '--only', 'Press'], { stdio: 'pipe' });
    const before = readManifest(join(files, '.fluxnative-ui.json'));
    assert.equal(before?.inputs.brandFiles?.['../design/brand.tokens.json'], sha256(readFileSync(brandFile, 'utf8')));

    writeFileSync(brandFile, JSON.stringify({ ...BRAND, color: { $type: 'color', primary: { $value: srgb('#14532d') } } }));
    assert.throws(
      () => execFileSync('node', [CLI, 'check', '--to', files], { stdio: 'pipe' }),
      (e: { status: number; stderr: Buffer }) =>
        e.status === 1 && /inputs: brand \.\.\/design changed since the files were emitted \(\.\.\/design\/brand\.tokens\.json\)/.test(e.stderr.toString()),
    );
    // update reuses the manifest's brandPath, re-renders the tokens and records the new fingerprint.
    const out = execFileSync('node', [CLI, 'update', '--to', files], { encoding: 'utf8' });
    assert.match(out, /wrote .*theme\/tokens\.ts/);
    assert.match(readFileSync(join(files, 'theme/tokens.ts'), 'utf8'), /"primary": "#14532d"/);
    assert.notEqual(readManifest(join(files, '.fluxnative-ui.json'))?.inputs.brand, before?.inputs.brand);
    assert.match(execFileSync('node', [CLI, 'check', '--to', files], { encoding: 'utf8' }), /up to date with its manifest/);
    // --colors and --brand stay exclusive for update too.
    writeFileSync(join(dir, 'colors.json'), '{}');
    assert.throws(
      () => execFileSync('node', [CLI, 'update', '--to', files, '--brand', design, '--colors', join(dir, 'colors.json')], { stdio: 'pipe' }),
      (e: { status: number; stderr: Buffer }) => e.status === 1 && /--colors and --brand are exclusive/.test(e.stderr.toString()),
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
