import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildModel } from './model.ts';
import { flatten, resolveAliases, toCssColor } from './dtcg.ts';
import { sysTokens } from './sys.ts';

const read = (name: string): unknown =>
  JSON.parse(readFileSync(new URL(`../tokens/${name}`, import.meta.url), 'utf8'));

const model = buildModel({
  base: read('base.tokens.json'),
  schemes: { light: read('color.light.tokens.json'), dark: read('color.dark.tokens.json') },
});

test('type scale converts Tailwind ratios to pixel line heights', () => {
  assert.deepEqual(model.text.xs, { fontSize: 12, lineHeight: 16 });
  assert.deepEqual(model.text.lg, { fontSize: 18, lineHeight: 28 });
  assert.deepEqual(model.text['3xl'], { fontSize: 30, lineHeight: 36 });
});

test('light and dark share one set of semantic names', () => {
  assert.deepEqual(Object.keys(model.colors.light ?? {}).sort(), Object.keys(model.colors.dark ?? {}).sort());
  assert.equal(model.colors.light?.primary, '#007aff');
  assert.equal(model.colors.dark?.border, 'rgba(84, 84, 88, 0.6)');
});

test('chrome and glass parameters are numbers in px', () => {
  assert.deepEqual(model.chrome, { appBarHeight: 44, tabBarHeight: 56, tabBarInset: 16 });
  assert.deepEqual(model.glass, { blurRadius: 24, saturate: 1.8 });
});

test('aliases resolve, and cycles fail loudly', () => {
  const doc = {
    color: {
      $type: 'color',
      brand: { $value: { colorSpace: 'srgb', components: [1, 0, 0] } },
      primary: { $value: '{color.brand}' },
    },
  };
  const [, primary] = resolveAliases(flatten(doc));
  assert.equal(toCssColor(primary?.value, 'primary'), '#ff0000');

  const cyclic = { a: { $type: 'number', $value: '{b}' }, b: { $type: 'number', $value: '{a}' } };
  assert.throws(() => resolveAliases(flatten(cyclic)), /Alias cycle/);
});

test('a scheme missing a color is rejected with the name', () => {
  const dark = read('color.dark.tokens.json') as { color: Record<string, unknown> };
  const { ring: _ring, ...rest } = dark.color;
  assert.throws(
    () => buildModel({ base: read('base.tokens.json'), schemes: { light: read('color.light.tokens.json'), dark: { color: rest } } }),
    /Missing: \[ring\]/,
  );
});

test('unknown token types are rejected, not skipped', () => {
  assert.throws(() => flatten({ x: { $type: 'gradient', $value: [] } }), /Supported:/);
});

const base = () => read('base.tokens.json') as Record<string, Record<string, unknown>>;
const schemes = () => ({ light: read('color.light.tokens.json'), dark: read('color.dark.tokens.json') });

test('sys defaults reproduce the catalog primitives', () => {
  const sys = sysTokens(model);
  // Sheet and SectionHeader titles, Chip labels, the SectionHeader eyebrow, StateView body.
  assert.deepEqual(sys.type.title, { fontSize: 20, lineHeight: 28, fontWeight: '700', letterSpacing: -0.2 });
  assert.deepEqual(sys.type.label, { fontSize: 14, lineHeight: 20, fontWeight: '500', letterSpacing: 0 });
  assert.deepEqual(sys.type.caps, { fontSize: 11, lineHeight: 14, fontWeight: '600', letterSpacing: 1.2 });
  assert.deepEqual(sys.type.bodySm, { fontSize: 14, lineHeight: 20, fontWeight: '400', letterSpacing: 0 });
  // Button and Chip pills, the Sheet top corners, StateView's inline card, Skeleton's default radius.
  assert.equal(sys.shape.control, model.radius.full);
  assert.equal(sys.shape.chip, model.radius.full);
  assert.equal(sys.shape.sheet, model.radius['3xl']);
  assert.equal(sys.shape.card, model.radius['2xl']);
  assert.equal(sys.shape.well, model.radius.lg);
  // Press, Reveal (duration.slow + 200) and Skeleton as they behave today.
  assert.deepEqual(sys.interaction, {
    press: { haptic: 'none', activeScale: 0.96, hitSlop: 0, spring: { speed: 40, bounciness: 0 } },
    reveal: { offset: 16, duration: model.duration.slow! + 200, stagger: 55 },
    skeleton: { mode: 'opacity', base: 'muted', highlight: 'accent', pulse: 900, minOpacity: 0.5, reducedOpacity: 0.8 },
  });
  assert.deepEqual(sys.layout, { gutter: 16, safeTop: 8, tabBarHeight: model.chrome.tabBarHeight });
});

test('type roles take their font through an alias, tabular figures included', () => {
  assert.deepEqual(model.font.numeric, { family: ['System'], fontVariant: ['tabular-nums'] });
  assert.deepEqual(model.type.numeric?.fontVariant, ['tabular-nums']);
  assert.equal(model.type.body?.fontVariant, undefined);
  assert.equal(sysTokens(model).type.display?.fontFamily, undefined, 'System is the platform font: no fontFamily');
});

test('elevation levels are shadows whose alpha never drops', () => {
  const alphas = Object.values(model.elevation).map((e) => e.layers[0]?.alpha);
  assert.deepEqual(alphas, [0, 0.08, 0.1, 0.12, 0.16]);
  assert.deepEqual(sysTokens(model).elevation['2'], {
    shadowColor: '#000000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  });
});

test('the new colour roles exist in both schemes and keep the old ones', () => {
  for (const name of ['foreground-soft', 'border-soft', 'success-foreground', 'warning-foreground', 'inverse', 'inverse-foreground', 'tertiary', 'tertiary-foreground']) {
    assert.ok(model.colors.light?.[name] && model.colors.dark?.[name], name);
  }
  // inverse is the selected-chip pairing: foreground fill, background ink.
  assert.equal(model.colors.light?.inverse, model.colors.light?.foreground);
  assert.equal(model.colors.dark?.['inverse-foreground'], model.colors.dark?.background);
  assert.equal(model.colors.light?.border, 'rgba(60, 60, 67, 0.18)');
});

test('sys groups are closed: unknown or missing keys throw', () => {
  const extra = base();
  (extra.type as Record<string, unknown>).subtitle = (extra.type as Record<string, unknown>).title;
  assert.throws(() => buildModel({ base: extra, schemes: schemes() }), /Unknown token "type\.subtitle"\. type has: display, headline/);

  const missing = base();
  delete (missing.layout as Record<string, unknown>).gutter;
  assert.throws(() => buildModel({ base: missing, schemes: schemes() }), /Missing required token\(s\) "layout\.gutter"/);

  const motion = { ...base(), motion: { $type: 'number', speed: { $value: 1 } } };
  assert.throws(() => buildModel({ base: motion, schemes: schemes() }), /Unknown token group "motion"/);

  const noAndroid = base();
  delete ((noAndroid.elevation as Record<string, Record<string, unknown>>)['2'] as Record<string, unknown>).$extensions;
  assert.throws(() => buildModel({ base: noAndroid, schemes: schemes() }), /elevation\.2: needs \$extensions\["dev\.fluxnative"\]\.android/);
});
