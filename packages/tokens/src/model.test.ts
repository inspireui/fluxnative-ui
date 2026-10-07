import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildModel } from './model.ts';
import { flatten, resolveAliases, toCssColor } from './dtcg.ts';

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
