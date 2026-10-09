import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AliasError, flatten, resolveAliases, toFontFamily, toShadow, toTypography, type Token } from './dtcg.ts';

const px = (value: number) => ({ value, unit: 'px' });
const black = (alpha: number) => ({ colorSpace: 'srgb', components: [0, 0, 0], alpha });

const resolved = (doc: unknown): Record<string, unknown> =>
  Object.fromEntries(resolveAliases(flatten(doc)).map((t) => [t.path.join('.'), t.value]));

test('fontFamily takes one name or a stack', () => {
  assert.deepEqual(toFontFamily('Georgia', 'f'), ['Georgia']);
  assert.deepEqual(toFontFamily(['Georgia', ' serif '], 'f'), ['Georgia', 'serif']);
  assert.throws(() => toFontFamily([], 'font.display'), /font\.display: expected a font family name or a non-empty list/);
  assert.throws(() => toFontFamily(['Georgia', 3], 'f'), /expected a font family/);
});

test('typography needs all five fields and settles its units', () => {
  const value = { fontFamily: ['System'], fontSize: px(20), fontWeight: 700, lineHeight: 1.4, letterSpacing: px(-0.2) };
  assert.deepEqual(toTypography(value, 't'), { fontFamily: ['System'], fontSize: 20, fontWeight: 700, lineHeight: 1.4, letterSpacing: -0.2 });
  // letterSpacing in em is relative to the font size; rem is 16px; named weights are DTCG's.
  assert.equal(toTypography({ ...value, letterSpacing: { value: 0.1, unit: 'em' } }, 't').letterSpacing, 2);
  assert.equal(toTypography({ ...value, fontSize: { value: 1.5, unit: 'rem' } }, 't').fontSize, 24);
  assert.equal(toTypography({ ...value, fontWeight: 'semi-bold' }, 't').fontWeight, 600);

  const { lineHeight: _lh, ...missing } = value;
  assert.throws(() => toTypography(missing, 'type.body'), /type\.body: typography is missing lineHeight \(all five/);
  assert.throws(() => toTypography({ ...value, color: '#000' }, 't'), /unknown field\(s\) color/);
  assert.throws(() => toTypography({ ...value, lineHeight: px(28) }, 't'), /lineHeight: expected a unitless multiple/);
  assert.throws(() => toTypography({ ...value, fontWeight: 650 }, 't'), /100–900 in steps of 100/);
  assert.throws(() => toTypography({ ...value, letterSpacing: { value: 1, unit: '%' } }, 't'), /unit "%" is not supported \(use px, rem or em\)/);
});

test('shadow takes a layer or a list, and rejects inset', () => {
  const layer = { color: black(0.12), offsetX: px(0), offsetY: px(4), blur: px(8), spread: px(0) };
  assert.deepEqual(toShadow(layer, 's'), [{ color: '#000000', alpha: 0.12, offsetX: 0, offsetY: 4, blur: 8, spread: 0 }]);
  assert.equal(toShadow([layer, { ...layer, offsetY: px(1) }], 's').length, 2);
  assert.throws(() => toShadow({ ...layer, inset: true }, 'elevation.1'), /elevation\.1: inset shadows are not supported/);
  assert.throws(() => toShadow([layer, { ...layer, inset: true }], 'e'), /e\[1\]: inset/);
  const { spread: _s, ...noSpread } = layer;
  assert.throws(() => toShadow(noSpread, 'e'), /shadow is missing spread/);
  assert.throws(() => toShadow({ ...layer, blur: px(-1) }, 'e'), /blur: must not be negative/);
});

test('aliases resolve inside composite values', () => {
  const doc = {
    radius: { $type: 'dimension', '3xl': { $value: px(24) } },
    font: { $type: 'fontFamily', display: { $value: ['Georgia', 'serif'] }, numeric: { $value: '{font.display}' } },
    'font-weight': { $type: 'fontWeight', bold: { $value: 700 } },
    shape: { $type: 'dimension', card: { $value: '{radius.3xl}' } },
    type: {
      $type: 'typography',
      display: {
        $value: { fontFamily: '{font.numeric}', fontSize: px(28), fontWeight: '{font-weight.bold}', lineHeight: 1.15, letterSpacing: px(-0.4) },
      },
      title: { $value: '{type.display}' },
    },
    elevation: {
      $type: 'shadow',
      1: { $value: { color: black(0.1), offsetX: px(0), offsetY: px(1), blur: px(3), spread: px(0) } },
      2: { $value: ['{elevation.1}', { color: black(0.05), offsetX: px(0), offsetY: '{radius.3xl}', blur: px(8), spread: px(0) }] },
    },
  };
  const values = resolved(doc);
  assert.deepEqual(values['shape.card'], px(24));
  assert.deepEqual(values['font.numeric'], ['Georgia', 'serif']);
  const display = values['type.display'] as Record<string, unknown>;
  assert.deepEqual(display.fontFamily, ['Georgia', 'serif']);
  assert.equal(display.fontWeight, 700);
  assert.deepEqual(values['type.title'], display);
  const layers = toShadow(values['elevation.2'], 'elevation.2');
  assert.deepEqual(
    layers.map((l) => [l.alpha, l.offsetY]),
    [
      [0.1, 1],
      [0.05, 24],
    ],
  );
});

test('a whole-value alias must keep its $type; broken aliases name the token', () => {
  const mismatch = { duration: { $type: 'duration', fast: { $value: { value: 150, unit: 'ms' } } }, layout: { $type: 'dimension', gutter: { $value: '{duration.fast}' } } };
  assert.throws(() => resolveAliases(flatten(mismatch)), /"layout\.gutter" is a dimension token but points at \{duration\.fast\}, a duration token/);

  const missing = { type: { $type: 'typography', body: { $value: { fontFamily: '{font.body}', fontSize: px(16), fontWeight: 400, lineHeight: 1.5, letterSpacing: px(0) } } } };
  assert.throws(() => resolveAliases(flatten(missing)), (e: unknown) => e instanceof AliasError && e.path === 'type.body' && /points at missing token \{font\.body\}/.test(e.message));

  const reported: Array<[string, string]> = [];
  const cyclic = { a: { $type: 'number', $value: '{b}' }, b: { $type: 'number', $value: '{a}' }, c: { $type: 'number', $value: 1 } };
  const ok = resolveAliases(flatten(cyclic), (token: Token, e) => reported.push([token.path.join('.'), e.cycle?.join(',') ?? '']));
  assert.deepEqual(ok.map((t) => t.path.join('.')), ['c']);
  assert.deepEqual(reported.map(([path]) => path), ['a', 'b']);
  assert.ok(reported.every(([, cycle]) => cycle.includes('a') && cycle.includes('b')));
});

test('a color hex must agree with its components', () => {
  const doc = (hex: string) => ({ color: { $type: 'color', primary: { $value: { colorSpace: 'srgb', components: [0, 0.4784, 1], hex } } } });
  assert.doesNotThrow(() => resolved(doc('#007aff')));
  assert.doesNotThrow(() => resolved(doc('#007AFE')));
  // flatten/resolve keep values as written; the reader checks them when it reads a color.
  assert.throws(
    () => toShadow({ color: { colorSpace: 'srgb', components: [0, 0, 0], hex: '#ffffff' }, offsetX: px(0), offsetY: px(0), blur: px(0), spread: px(0) }, 'e'),
    /hex "#ffffff" doesn't match components \(#000000\)/,
  );
});
