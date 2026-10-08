import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ICONS, ICON_NAMES, isIconName } from './table.ts';

test('every icon names an SF Symbol, a Material Symbol and a path', () => {
  for (const [name, spec] of Object.entries(ICONS)) {
    assert.match(name, /^[a-z]+(-[a-z]+)*$/, `${name}: kebab-case names only`);
    assert.match(spec.sf, /^[a-z0-9.]+$/, `${name}.sf`);
    assert.match(spec.material, /^[a-z0-9_]+$/, `${name}.material`);
    assert.match(spec.path, /^M[-\d.]/, `${name}.path starts with a move`);
    assert.doesNotMatch(spec.path, /[^MmLlHhVvCcSsQqTtAaZz\d\s.,-]/, `${name}.path uses path commands only`);
  }
});

test('names are closed and checkable at runtime', () => {
  assert.ok(ICON_NAMES.length >= 60);
  assert.equal(isIconName('heart'), true);
  assert.equal(isIconName('heart-outline'), false);
});
