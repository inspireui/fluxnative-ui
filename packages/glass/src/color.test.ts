import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withAlpha } from './color.ts';

test('withAlpha reads every hex form', () => {
  assert.equal(withAlpha('#007aff', 0.18), 'rgba(0, 122, 255, 0.18)');
  assert.equal(withAlpha('#007AFF', 0.5), 'rgba(0, 122, 255, 0.5)');
  assert.equal(withAlpha('#fff', 0.2), 'rgba(255, 255, 255, 0.2)');
  assert.equal(withAlpha('#f00a', 0.2), 'rgba(255, 0, 0, 0.2)');
  assert.equal(withAlpha('#007aff80', 0.3), 'rgba(0, 122, 255, 0.3)');
});

test('withAlpha replaces the alpha of rgb() and rgba()', () => {
  assert.equal(withAlpha('rgb(1, 2, 3)', 0.4), 'rgba(1, 2, 3, 0.4)');
  assert.equal(withAlpha('rgba(60, 60, 67, 0.18)', 0.4), 'rgba(60, 60, 67, 0.4)');
});

test('withAlpha leaves other forms alone', () => {
  assert.equal(withAlpha('transparent', 0.4), 'transparent');
  assert.equal(withAlpha('hsl(0 0% 0%)', 0.4), 'hsl(0 0% 0%)');
});
