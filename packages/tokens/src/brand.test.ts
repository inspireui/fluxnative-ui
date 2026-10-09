import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  BrandError,
  brandLayers,
  readBrandFiles,
  resolveBrand,
  resolverLayers,
  validateBrand,
  type BrandProblem,
  type BrandSource,
  type TokenSources,
} from './brand.ts';

const tokensDir = join(import.meta.dirname, '..', 'tokens');
const fixtures = join(import.meta.dirname, 'fixtures', 'brand');
const readJson = (file: string): unknown => JSON.parse(readFileSync(file, 'utf8'));
const kit: TokenSources = {
  base: readJson(join(tokensDir, 'base.tokens.json')),
  schemes: { light: readJson(join(tokensDir, 'color.light.tokens.json')), dark: readJson(join(tokensDir, 'color.dark.tokens.json')) },
};
const disk = { readText: (path: string) => (existsSync(path) ? readFileSync(path, 'utf8') : undefined) };

// --- builders -------------------------------------------------------------

const px = (value: number) => ({ value, unit: 'px' });
const ms = (value: number) => ({ value, unit: 'ms' });
const color = (hex: string, alpha?: number) => {
  const n = parseInt(hex.slice(1), 16);
  const components = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => Math.round((c / 255) * 10000) / 10000);
  return { colorSpace: 'srgb', components, hex, ...(alpha === undefined ? {} : { alpha }) };
};
const typo = (size: number, lineHeight = 1.4, letterSpacing: unknown = px(0), fontFamily: unknown = '{font.text}') => ({
  fontFamily,
  fontSize: px(size),
  fontWeight: 400,
  lineHeight,
  letterSpacing,
});
const shadow = (alpha: number, offsetY = 1, blur = 3, spread = 0) => ({ color: color('#000000', alpha), offsetX: px(0), offsetY: px(offsetY), blur: px(blur), spread: px(spread) });

type Doc = Record<string, unknown>;
/** A brand file: the metadata (scheme light unless given) plus groups. */
const brand = (groups: Doc = {}, meta: Doc = {}): Doc => ({
  $extensions: { 'dev.fluxnative.brand': { schemaVersion: 1, scheme: 'light', ...meta } },
  ...groups,
});
const colors = (roles: Doc) => ({ color: { $type: 'color', ...Object.fromEntries(Object.entries(roles).map(([k, v]) => [k, { $value: v }])) } });
const group = (name: string, type: string, tokens: Doc) => ({ [name]: { $type: type, ...Object.fromEntries(Object.entries(tokens).map(([k, v]) => [k, { $value: v }])) } });

const check = (doc: Doc, dark?: Doc) =>
  validateBrand(brandLayers({ file: 'brand.tokens.json', doc }, dark ? { file: 'brand.dark.tokens.json', doc: dark } : undefined), kit);

const describe = (problems: BrandProblem[]) => problems.map((p) => `${p.level} ${p.at}: ${p.message}`).join('\n');

// --- the passing fixture -----------------------------------------------------

test('the fixture brand passes with no errors and no warnings', () => {
  const report = validateBrand(readBrandFiles(join(fixtures, 'brand.tokens.json'), disk), kit);
  assert.deepEqual([...report.errors, ...report.warnings], []);
  const b = report.brand;
  assert.ok(b);
  assert.deepEqual(b.meta, {
    schemaVersion: 1,
    scheme: 'system',
    density: 'comfy',
    personality: ['quiet', 'editorial'],
    haptic: 'light',
    skeleton: { mode: 'color', base: 'muted', highlight: 'card' },
  });
  assert.equal(b.colors.light.primary, '#1b5e20');
  assert.equal(b.colors.dark.primary, '#81c784');
  assert.equal(b.colors.light.border, 'rgba(60, 60, 67, 0.29)');
  // A kit alias follows the brand: inverse is still the light foreground.
  assert.equal(b.colors.light.inverse, b.colors.light.foreground);
  // font.display reaches every role that aliases it; numeric keeps tabular figures from font.numeric.
  assert.deepEqual(b.sys.type.display, { fontFamily: 'Georgia', fontSize: 28, lineHeight: 32, fontWeight: '700', letterSpacing: -0.4 });
  assert.equal(b.sys.type.title?.fontFamily, 'Georgia');
  assert.equal(b.sys.type.body?.fontFamily, undefined);
  assert.deepEqual(b.sys.type.numeric, { fontSize: 24, lineHeight: 29, fontWeight: '600', letterSpacing: -0.48, fontVariant: ['tabular-nums'] });
  assert.equal(b.sys.shape.card, 24);
  assert.equal(b.sys.shape.cardInner, 16);
  // elevation.1 is the brand's; android comes from its extension.
  assert.deepEqual(b.sys.elevation['1'], { shadowColor: '#000000', shadowOpacity: 0.1, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 2 });
  assert.equal(b.duration.normal, 220);
  assert.deepEqual(b.easing.standard, [0.25, 0.1, 0.25, 1]);
  assert.deepEqual(b.sys.interaction.press, { haptic: 'light', activeScale: 0.95, hitSlop: 8, spring: { speed: 40, bounciness: 0 } });
  assert.deepEqual(b.sys.interaction.skeleton, { mode: 'color', base: 'muted', highlight: 'card', pulse: 900, minOpacity: 0.5, reducedOpacity: 0.8 });
  assert.equal(b.sys.interaction.reveal.offset, 20);
  assert.deepEqual(b.sys.layout, { gutter: 20, safeTop: 8, tabBarHeight: 64 });
});

test('a brand file, its resolver and its folder read the same', () => {
  const byFile = readBrandFiles(join(fixtures, 'brand.tokens.json'), disk);
  const byResolver = readBrandFiles(join(fixtures, 'brand.resolver.json'), disk);
  const byFolder = readBrandFiles(fixtures, disk);
  const docs = (l: typeof byFile) => [l.sets, l.light, l.dark].map((list) => list.map((s) => s.doc));
  assert.deepEqual(docs(byResolver), docs(byFile));
  assert.deepEqual(docs(byFolder), docs(byFile));
  assert.equal(byFile.dark[0]?.file, join(fixtures, 'brand.dark.tokens.json'));
  assert.equal(byFolder.sets[0]?.file, join(fixtures, 'brand.tokens.json'));
});

test('reading reports missing files, bad JSON and the dark file passed alone', () => {
  const memory = (files: Record<string, string>) => ({ readText: (path: string) => files[path] });
  assert.throws(() => readBrandFiles('design/brand.tokens.json', memory({})), (e: unknown) => e instanceof BrandError && /design\/brand\.tokens\.json: file not found/.test(e.message));
  assert.throws(() => readBrandFiles('b.tokens.json', memory({ 'b.tokens.json': '{ nope' })), /b\.tokens\.json: not valid JSON/);
  assert.throws(() => readBrandFiles('brand.dark.tokens.json', memory({ 'brand.dark.tokens.json': '{}' })), /pass the brand file itself/);
  const folder = readBrandFiles('design', memory({ 'design/brand.tokens.json': '{}' }));
  assert.equal(folder.sets[0]?.file, 'design/brand.tokens.json');
  assert.deepEqual(folder.dark, []);
});

test('the resolver subset rejects everything else with a reason', () => {
  const load = (ref: string): BrandSource => ({ file: ref, doc: {} });
  const set = { sources: [{ $ref: 'brand.tokens.json' }] };
  const order = [{ $ref: '#/sets/brand' }, { $ref: '#/modifiers/theme' }];
  const theme = { contexts: { light: [], dark: [{ $ref: 'brand.dark.tokens.json' }] } };
  const ok = resolverLayers({ version: '2025.10', sets: { brand: set }, modifiers: { theme }, resolutionOrder: order }, 'r.json', load);
  assert.deepEqual(ok.sets.map((s) => s.file), ['brand.tokens.json']);
  assert.deepEqual(ok.dark.map((s) => s.file), ['brand.dark.tokens.json']);
  // The plan's shorthand names work too.
  assert.deepEqual(resolverLayers({ sets: { brand: set }, resolutionOrder: ['brand'] }, 'r.json', load).sets.length, 1);

  const cases: Array<[Doc, RegExp]> = [
    [{ sets: { brand: { sources: [{ color: {} }] } }, resolutionOrder: ['brand'] }, /only \{ "\$ref": "<relative path>" \} sources are supported/],
    [{ sets: { brand: { sources: [{ $ref: '/abs/brand.tokens.json' }] } }, resolutionOrder: ['brand'] }, /must be a file path relative to the resolver/],
    [{ sets: { brand: set }, modifiers: { density: { contexts: {} } }, resolutionOrder: ['brand'] }, /only the "theme" modifier/],
    [{ sets: { brand: set }, modifiers: { theme: { contexts: { sepia: [] } } }, resolutionOrder: ['brand', 'theme'] }, /only "light" and "dark" are supported/],
    [{ sets: { brand: set }, modifiers: { theme }, resolutionOrder: [{ $ref: '#/modifiers/theme' }, { $ref: '#/sets/brand' }] }, /theme modifier must come last/],
    [{ sets: { brand: set, extra: set }, resolutionOrder: ['brand'] }, /sets\.extra is not in resolutionOrder/],
    [{ sets: { brand: set }, resolutionOrder: ['brand', 'missing'] }, /"missing" names no set or modifier/],
    [{ sets: { brand: set }, version: '2024.1', resolutionOrder: ['brand'] }, /version must be "2025\.10"/],
    [{ sets: { brand: set }, resolutionOrder: ['brand'], inputs: {} }, /"inputs" is not part of the resolver subset/],
    [{ sets: { brand: set } }, /resolutionOrder must list every set/],
  ];
  for (const [doc, pattern] of cases) assert.throws(() => resolverLayers(doc, 'r.json', load), pattern, pattern.source);
});

test('the kit itself passes; its own low-contrast pairs are warnings, not errors', () => {
  const report = check(brand({}, { scheme: 'system' }));
  assert.deepEqual(report.errors, []);
  assert.deepEqual(
    report.warnings.map((w) => `${w.at}: ${w.message}`),
    [
      'light: primary-foreground on primary is 4.02:1, needs 4.5:1 (kit default; override one of them to fix)',
      'light: destructive-foreground on destructive is 3.55:1, needs 4.5:1 (kit default; override one of them to fix)',
      'light: border on background is 1.37:1, needs 1.5:1 (kit default; override one of them to fix)',
      'dark: primary-foreground on primary is 3.65:1, needs 4.5:1 (kit default; override one of them to fix)',
      'dark: destructive-foreground on destructive is 3.41:1, needs 4.5:1 (kit default; override one of them to fix)',
    ],
  );
  assert.ok(report.brand);
});

// --- one failing brand per rule ---------------------------------------------

type Expect = ['error' | 'warning', string, RegExp];
interface Case {
  rule: string;
  doc: Doc;
  dark?: Doc;
  expect: Expect[];
  /** Problems that must not appear. */
  absent?: RegExp[];
}

const cases: Case[] = [
  // Contrast (plan A2.6), computed per scheme on the resolved palette.
  {
    rule: 'contrast 4.5:1 and primary 3:1',
    doc: brand(colors({ primary: color('#9fd3ff') })),
    expect: [
      ['error', 'light', /^primary-foreground on primary is \d\.\d\d:1, needs 4\.5:1$/],
      ['error', 'light', /^primary on background is \d\.\d\d:1, needs 3:1$/],
    ],
  },
  {
    rule: 'contrast 4.5:1 for every text pair',
    doc: brand(
      colors({
        foreground: color('#cccccc'),
        'card-foreground': color('#cccccc'),
        'secondary-foreground': color('#cccccc'),
        'accent-foreground': color('#cccccc'),
        destructive: color('#ffb3ae'),
      }),
    ),
    expect: [
      ['error', 'light', /^foreground on background is/],
      ['error', 'light', /^card-foreground on card is/],
      ['error', 'light', /^secondary-foreground on secondary is/],
      ['error', 'light', /^accent-foreground on accent is/],
      ['error', 'light', /^destructive-foreground on destructive is/],
    ],
  },
  { rule: 'inverse pair', doc: brand(colors({ inverse: color('#777777') })), expect: [['error', 'light', /^inverse-foreground on inverse is 4\.48:1, needs 4\.5:1$/]] },
  {
    rule: 'muted-foreground 3:1 on background and card',
    doc: brand(colors({ 'muted-foreground': color('#aaaaaa') })),
    expect: [
      ['error', 'light', /^muted-foreground on background is 2\.\d\d:1, needs 3:1$/],
      ['error', 'light', /^muted-foreground on card is 2\.\d\d:1, needs 3:1$/],
    ],
  },
  { rule: 'foreground-soft 3:1', doc: brand(colors({ 'foreground-soft': color('#b0b0b0') })), expect: [['error', 'light', /^foreground-soft on background is .*needs 3:1$/]] },
  { rule: 'border 1.5:1, alpha composited', doc: brand(colors({ border: color('#000000', 0.1) })), expect: [['error', 'light', /^border on background is 1\.2\d:1, needs 1\.5:1$/]] },
  { rule: 'border alpha that passes', doc: brand(colors({ border: color('#000000', 0.35) })), expect: [], absent: [/border on background/] },
  {
    rule: 'dark palette checked when scheme is system',
    doc: brand({}, { scheme: 'system' }),
    dark: colors({ primary: color('#bfe0ff') }),
    expect: [['error', 'dark', /^primary-foreground on primary is/]],
  },
  // Type scale.
  { rule: 'type order (strict)', doc: brand(group('type', 'typography', { headline: typo(32, 1.25) })), expect: [['error', 'type', /^display \(30px\) must be larger than headline \(32px\)$/]] },
  { rule: 'type order (at least)', doc: brand(group('type', 'typography', { label: typo(15) })), expect: [['error', 'type', /^body-sm \(14px\) must be at least label \(15px\)$/]] },
  { rule: 'body 14–17', doc: brand(group('type', 'typography', { body: typo(18, 1.5) })), expect: [['error', 'type.body', /^fontSize 18px is outside 14–17px$/]] },
  { rule: 'lineHeight 1.0–1.6', doc: brand(group('type', 'typography', { label: typo(14, 1.8) })), expect: [['error', 'type.label', /^lineHeight 1\.8 is outside 1\.0–1\.6$/]] },
  {
    rule: 'letterSpacing -0.05em…+0.12em',
    doc: brand(group('type', 'typography', { title: typo(20, 1.4, { value: 0.2, unit: 'em' }) })),
    expect: [['error', 'type.title', /^letterSpacing 0\.2em is outside -0\.05em to 0\.12em$/]],
  },
  { rule: 'caps tracking ≥ 0.04em', doc: brand(group('type', 'typography', { caps: typo(11, 1.3) })), expect: [['error', 'type.caps', /^letterSpacing 0em must be at least 0\.04em/]] },
  { rule: 'size below 11 is a warning', doc: brand(group('type', 'typography', { caps: typo(10, 1.4, px(1)) })), expect: [['warning', 'type.caps', /^fontSize 10px is below 11px$/]] },
  {
    rule: 'typography needs all five fields',
    doc: brand({ type: { $type: 'typography', body: { $value: { fontFamily: ['System'], fontSize: px(16), fontWeight: 400, letterSpacing: px(0) } } } }),
    expect: [['error', 'type.body', /^typography is missing lineHeight .*\(brand\.tokens\.json\)$/]],
  },
  // Fonts (A2.7: system families only until hosts load fonts).
  { rule: 'stack ends with a generic', doc: brand(group('font', 'fontFamily', { display: ['Georgia'] })), expect: [['error', 'font.display', /must end with a generic family .*it ends with "Georgia"$/]] },
  { rule: 'system families only', doc: brand(group('font', 'fontFamily', { display: ['Fraunces', 'Georgia', 'serif'] })), expect: [['error', 'font.display', /^"Fraunces" can't load: hosts load no web fonts yet/]] },
  {
    rule: 'a stack spelled in a type role is checked too',
    doc: brand(group('type', 'typography', { display: typo(30, 1.2, px(0), ['Inter', 'sans-serif']) })),
    expect: [['error', 'type.display', /^"Inter" can't load/]],
  },
  {
    rule: 'fontVariant is closed',
    doc: brand({ font: { $type: 'fontFamily', numeric: { $value: ['System'], $extensions: { 'dev.fluxnative': { fontVariant: ['slashed-zero'] } } } } }),
    expect: [['error', 'font.numeric', /^fontVariant must be a list of "tabular-nums"/]],
  },
  // Shape.
  { rule: 'shape aliases radius only', doc: brand(group('shape', 'dimension', { card: px(20) })), expect: [['error', 'shape.card', /^must alias the radius scale, e\.g\. "\{radius\.2xl\}"/]] },
  { rule: 'card-inner ≤ card', doc: brand(group('shape', 'dimension', { card: '{radius.lg}' })), expect: [['error', 'shape.card-inner', /^12px must not be rounder than shape\.card \(8px\)$/]] },
  { rule: 'chip ≥ radius.md', doc: brand(group('shape', 'dimension', { chip: '{radius.sm}' })), expect: [['error', 'shape.chip', /^4px must be at least radius\.md \(6px\)$/]] },
  // Elevation.
  { rule: 'alpha ≤ 0.30 in light', doc: brand(group('elevation', 'shadow', { 4: shadow(0.4, 12, 24) })), expect: [['error', 'elevation.4', /^shadow alpha 0\.4 is above 0\.3 \(0\.6 when scheme is "dark"\)$/]] },
  { rule: 'alpha ≤ 0.60 when scheme is dark', doc: brand(group('elevation', 'shadow', { 4: shadow(0.5, 12, 24) }), { scheme: 'dark' }), expect: [], absent: [/shadow alpha/] },
  { rule: 'blur ≤ 32', doc: brand(group('elevation', 'shadow', { 4: shadow(0.16, 12, 40) })), expect: [['error', 'elevation.4', /^blur 40px is above 32px$/]] },
  { rule: 'offsetY ≤ 16', doc: brand(group('elevation', 'shadow', { 4: shadow(0.16, 20, 24) })), expect: [['error', 'elevation.4', /^offsetY 20px is above 16px$/]] },
  { rule: 'alpha rises with the level', doc: brand(group('elevation', 'shadow', { 2: shadow(0.05, 4, 8) })), expect: [['error', 'elevation.2', /^alpha 0\.05 is lower than elevation\.1 \(0\.08\)/]] },
  { rule: 'inset is rejected', doc: brand(group('elevation', 'shadow', { 1: { ...shadow(0.08), inset: true } })), expect: [['error', 'elevation.1', /^inset shadows are not supported/]] },
  {
    rule: 'layers and spread React Native drops are warnings',
    doc: brand(group('elevation', 'shadow', { 2: [shadow(0.1, 4, 8), shadow(0.05, 1, 2)], 3: shadow(0.12, 8, 16, 2) })),
    expect: [
      ['warning', 'elevation.2', /^React Native draws only the first of 2 layers$/],
      ['warning', 'elevation.3', /^spread is not drawn by React Native$/],
    ],
  },
  // Motion.
  { rule: 'duration ranges', doc: brand(group('duration', 'duration', { fast: ms(90) })), expect: [['error', 'duration.fast', /^90ms is outside 100–180ms$/]] },
  { rule: 'durations increase', doc: brand(group('duration', 'duration', { normal: ms(300), slow: ms(300) })), expect: [['error', 'duration', /^fast \(150ms\) < normal \(300ms\) < slow \(300ms\) must hold$/]] },
  { rule: 'easing x within 0–1', doc: brand(group('easing', 'cubicBezier', { standard: [1.2, 0, 0, 1] })), expect: [['error', 'easing.standard', /x1 and x2 must be within 0–1/]] },
  // Interaction profile.
  { rule: 'active-scale 0.9–1', doc: brand({ interaction: { press: { 'active-scale': { $type: 'number', $value: 0.8 } } } }), expect: [['error', 'interaction.press.active-scale', /^0\.8 is outside 0\.9–1$/]] },
  { rule: 'hit-slop 0–12', doc: brand({ interaction: { press: { 'hit-slop': { $type: 'dimension', $value: px(16) } } } }), expect: [['error', 'interaction.press.hit-slop', /^16px is outside 0–12px$/]] },
  { rule: 'stagger ≤ 80ms', doc: brand({ interaction: { reveal: { stagger: { $type: 'duration', $value: ms(100) } } } }), expect: [['error', 'interaction.reveal.stagger', /^100ms is outside 0–80ms$/]] },
  { rule: 'skeleton opacity 0–1', doc: brand({ interaction: { skeleton: { 'min-opacity': { $type: 'number', $value: 1.5 } } } }), expect: [['error', 'interaction.skeleton.min-opacity', /^1\.5 is outside 0–1$/]] },
  // Layout.
  { rule: 'gutter 16/20/24', doc: brand(group('layout', 'dimension', { gutter: px(18) })), expect: [['error', 'layout.gutter', /^18px must be 16, 20 or 24$/]] },
  { rule: 'tab bar 56–88', doc: brand(group('layout', 'dimension', { 'tab-bar-height': px(90) })), expect: [['error', 'layout.tab-bar-height', /^90px must be 56–88 and a multiple of 4$/]] },
  { rule: 'tab bar multiple of 4', doc: brand(group('layout', 'dimension', { 'tab-bar-height': px(66) })), expect: [['error', 'layout.tab-bar-height', /^66px must be 56–88/]] },
  // Closed keys and structure.
  { rule: 'unknown group', doc: brand({ motion: { duration: { $type: 'duration', normal: { $value: ms(220) } } } }), expect: [['error', 'motion', /^unknown group; motion lives in the kit groups duration and easing/]] },
  {
    rule: 'kit-only groups',
    doc: brand({ spacing: { $type: 'dimension', unit: { $value: px(5) } }, chrome: { $type: 'dimension', 'tab-bar-height': { $value: px(84) } } }),
    expect: [
      ['error', 'spacing', /^is kit-only/],
      ['error', 'chrome', /^is kit-only.*set layout\.tab-bar-height/],
    ],
  },
  { rule: 'unknown token', doc: brand(group('type', 'typography', { subtitle: typo(18) })), expect: [['error', 'type.subtitle', /^unknown token; type has display, headline, title, body, body-sm, label, caps, numeric/]] },
  { rule: 'unknown colour role', doc: brand(colors({ brand: color('#123456') })), expect: [['error', 'color.brand', /^unknown token; color has background, foreground/]] },
  {
    rule: 'camelCase gets a hint',
    doc: brand({ interaction: { $type: 'number', press: { activeScale: { $value: 0.95 } } } }),
    expect: [['error', 'interaction.press.activeScale', /did you mean "interaction\.press\.active-scale"\? token names are kebab-case/]],
  },
  { rule: '$type must fit the group', doc: brand(group('shape', 'number', { card: 24 })), expect: [['error', 'shape.card', /^\$type number doesn't fit; use dimension/]] },
  { rule: 'missing $type', doc: brand({ layout: { gutter: { $value: px(20) } } }), expect: [['error', 'layout.gutter', /^has no \$type and no group sets one/]] },
  {
    rule: 'dark file sets every light role',
    doc: brand(colors({ primary: color('#1b5e20'), 'foreground-soft': color('#4a4a4a') }), { scheme: 'system' }),
    dark: colors({ primary: color('#81c784'), 'primary-foreground': color('#0b1f0c') }),
    expect: [['error', 'dark', /^brand\.dark\.tokens\.json must set every role the light colours set; missing foreground-soft$/]],
  },
  { rule: 'no dark file under scheme system', doc: brand(colors({ primary: color('#1b5e20') }), { scheme: 'system' }), expect: [['warning', 'dark', /^no dark colours/]] },
  { rule: 'light colours under scheme dark', doc: brand(colors({ primary: color('#1b5e20') }), { scheme: 'dark' }), expect: [['warning', 'light', /never shown/]] },
  {
    rule: 'a dark file holds colours only',
    doc: brand(),
    dark: { ...colors({ primary: color('#81c784') }), layout: { $type: 'dimension', gutter: { $value: px(20) } } },
    expect: [['error', 'layout', /^a dark scheme file holds color\.\* only/]],
  },
  // Brand metadata.
  { rule: 'metadata is required', doc: { ...colors({}) }, expect: [['error', 'brand.tokens.json', /^missing root \$extensions\["dev\.fluxnative\.brand"\]/]] },
  { rule: 'schemaVersion 1', doc: brand({}, { schemaVersion: 2 }), expect: [['error', 'dev.fluxnative.brand.schemaVersion', /^must be 1 \(got 2\)$/]] },
  { rule: 'metadata keys are closed', doc: brand({}, { mood: 'calm' }), expect: [['error', 'dev.fluxnative.brand.mood', /^unknown key; known: schemaVersion, scheme/]] },
  { rule: 'scheme', doc: brand({}, { scheme: 'auto' }), expect: [['error', 'dev.fluxnative.brand.scheme', /^must be "light", "dark", "system"/]] },
  { rule: 'density', doc: brand({}, { density: 'cozy' }), expect: [['error', 'dev.fluxnative.brand.density', /^must be "compact", "regular", "comfy"/]] },
  { rule: 'haptic', doc: brand({}, { haptic: 'heavy' }), expect: [['error', 'dev.fluxnative.brand.haptic', /^must be "none", "light", "selection", "medium"/]] },
  {
    rule: 'skeleton',
    doc: brand({}, { skeleton: { mode: 'shimmer', base: 'well' } }),
    expect: [
      ['error', 'dev.fluxnative.brand.skeleton.mode', /^must be "opacity", "color"/],
      ['error', 'dev.fluxnative.brand.skeleton.base', /^must be a colour role/],
    ],
  },
  { rule: 'personality', doc: brand({}, { personality: 'quiet' }), expect: [['error', 'dev.fluxnative.brand.personality', /^must be a list of words$/]] },
  {
    rule: 'token extensions use dev.fluxnative',
    doc: brand({ type: { $type: 'typography', numeric: { $value: typo(16, 1.5), $extensions: { 'dev.fluxnative.brand': { fontVariant: ['tabular-nums'] } } } } }),
    expect: [['error', 'type.numeric', /belongs at the root of the brand file; a token's extensions use "dev\.fluxnative"/]],
  },
  {
    rule: 'extension keys are closed per group',
    doc: brand({ shape: { $type: 'dimension', card: { $value: '{radius.3xl}', $extensions: { 'dev.fluxnative': { android: 1 } } } } }),
    expect: [['error', 'shape.card', /android is not read on shape tokens/]],
  },
  {
    rule: 'android elevation is a number ≥ 0',
    doc: brand({ elevation: { $type: 'shadow', 1: { $value: shadow(0.08), $extensions: { 'dev.fluxnative': { android: -1 } } } } }),
    expect: [['error', 'elevation.1', /^android must be the Android elevation/]],
  },
  // Aliases.
  { rule: 'missing alias target', doc: brand(group('font', 'fontFamily', { display: '{font.serif}' })), expect: [['error', 'font.display', /points at missing token \{font\.serif\}/]] },
  {
    rule: 'alias cycle',
    doc: brand(colors({ primary: '{color.ring}', ring: '{color.primary}' })),
    expect: [
      ['error', 'color.primary', /^Alias cycle/],
      ['error', 'color.ring', /^Alias cycle/],
    ],
  },
  { rule: 'alias type mismatch', doc: brand(group('layout', 'dimension', { gutter: '{duration.fast}' })), expect: [['error', 'layout.gutter', /is a dimension token but points at \{duration\.fast\}, a duration token/]] },
  // Colour values.
  { rule: 'hex agrees with components', doc: brand(colors({ primary: { colorSpace: 'srgb', components: [0, 0, 0], hex: '#ffffff' } })), expect: [['error', 'color.primary', /hex "#ffffff" doesn't match components/]] },
  { rule: 'colours are DTCG objects', doc: brand(colors({ primary: '#77ef67' })), expect: [['error', 'color.primary', /color must be a DTCG color object/]] },
];

for (const c of cases) {
  test(`rule: ${c.rule}`, () => {
    const report = c.dark ? check(c.doc, c.dark) : check(c.doc);
    const all = [...report.errors, ...report.warnings];
    for (const [level, at, pattern] of c.expect) {
      assert.ok(
        all.some((p) => p.level === level && p.at === at && pattern.test(p.message)),
        `expected ${level} at ${at} matching ${pattern}; got:\n${describe(all)}`,
      );
    }
    for (const pattern of c.absent ?? []) assert.ok(!all.some((p) => pattern.test(p.message)), `unexpected ${pattern}:\n${describe(all)}`);
    const errors = c.expect.some(([level]) => level === 'error');
    assert.equal(report.brand === undefined, errors, errors ? 'an error leaves no brand' : `no error expected:\n${describe(report.errors)}`);
  });
}

test('every problem is reported in one run, and resolveBrand lists them', () => {
  const doc = brand({
    ...group('type', 'typography', { body: typo(18, 1.5) }),
    ...group('layout', 'dimension', { gutter: px(18) }),
    ...group('shape', 'dimension', { chip: '{radius.sm}' }),
    motion: {},
  });
  const report = check(doc);
  assert.deepEqual(report.errors.map((p) => p.at).sort(), ['layout.gutter', 'motion', 'shape.chip', 'type.body']);
  assert.throws(
    () => resolveBrand(brandLayers({ file: 'brand.tokens.json', doc }), kit),
    (e: unknown) => e instanceof BrandError && e.problems.length >= 4 && /^brand: 4 errors\n {2}error {3}/.test(e.message),
  );
});

test('the example in docs/topics/tokens.md is the passing fixture', (t) => {
  const docs = join(import.meta.dirname, '..', '..', '..', 'docs', 'topics', 'tokens.md');
  if (!existsSync(docs)) return t.skip('docs are not shipped with the package');
  const example = /### Example\n\n```json\n([\s\S]*?)\n```/.exec(readFileSync(docs, 'utf8'))?.[1];
  assert.ok(example, 'docs/topics/tokens.md has an ### Example json block');
  const { $description: _d, ...fixture } = readJson(join(fixtures, 'brand.tokens.json')) as Doc;
  assert.deepEqual(JSON.parse(example), fixture);
});
