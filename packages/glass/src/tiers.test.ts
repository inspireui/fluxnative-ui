import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveGlassTier, type ResolveTierInput } from './tiers.ts';

const ios26: ResolveTierInput = {
  role: 'surface',
  nativeBarAvailable: true,
  liquidGlassAvailable: true,
  blurAvailable: true,
  reduceTransparency: false,
  increaseContrast: false,
};

test('bars use the native system bar when the navigator offers one', () => {
  assert.equal(resolveGlassTier({ ...ios26, role: 'bar' }), 'native-bar');
});

test('native bars keep the tier under accessibility settings — the OS adapts them', () => {
  assert.equal(resolveGlassTier({ ...ios26, role: 'bar', reduceTransparency: true }), 'native-bar');
  assert.equal(resolveGlassTier({ ...ios26, role: 'bar', increaseContrast: true }), 'native-bar');
});

test('custom surfaces go opaque under Reduce Transparency or Increase Contrast', () => {
  assert.equal(resolveGlassTier({ ...ios26, reduceTransparency: true }), 'opaque');
  assert.equal(resolveGlassTier({ ...ios26, increaseContrast: true }), 'opaque');
});

test('custom surfaces step down native-glass → blur → translucent', () => {
  assert.equal(resolveGlassTier(ios26), 'native-glass');
  assert.equal(resolveGlassTier({ ...ios26, liquidGlassAvailable: false }), 'blur');
  assert.equal(resolveGlassTier({ ...ios26, liquidGlassAvailable: false, blurAvailable: false }), 'translucent');
});

test('a bar without a native host falls through like a surface', () => {
  assert.equal(resolveGlassTier({ ...ios26, role: 'bar', nativeBarAvailable: false }), 'native-glass');
});

test('forced wins over everything', () => {
  assert.equal(resolveGlassTier({ ...ios26, role: 'bar', forced: 'translucent' }), 'translucent');
});
