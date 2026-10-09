import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildModel } from './model.ts';
import { emitTs } from './emit-ts.ts';
import { emitSysTs, sysTokens } from './sys.ts';

const read = (name: string): unknown => JSON.parse(readFileSync(new URL(`../tokens/${name}`, import.meta.url), 'utf8'));
const model = buildModel({
  base: read('base.tokens.json'),
  schemes: { light: read('color.light.tokens.json'), dark: read('color.dark.tokens.json') },
});

test('sysTokens turns a type role into Text style props', () => {
  const custom = structuredClone(model);
  custom.type.display = { fontFamily: ['Georgia', 'serif'], fontSize: 28, fontWeight: 700, lineHeight: 1.15, letterSpacing: -0.4 };
  // A named family is set; line height becomes rounded px; the weight a string.
  assert.deepEqual(sysTokens(custom).type.display, { fontFamily: 'Georgia', fontSize: 28, lineHeight: 32, fontWeight: '700', letterSpacing: -0.4 });
});

test('emitSysTs declares the sections with closed types and numeric elevation levels', () => {
  const src = emitSysTs(sysTokens(model));
  assert.match(src, /^\n\/\*\* Font stack per role/);
  assert.match(src, /export type TypeRole = 'display' \| 'headline' \| 'title' \| 'body' \| 'bodySm' \| 'label' \| 'caps' \| 'numeric';/);
  assert.match(src, /export const type: \{ readonly \[R in TypeRole\]: TypeStyle \} = \{/);
  assert.match(src, /readonly fontWeight: \(typeof fontWeight\)\[FontWeightName\];/);
  assert.match(src, /export const elevation = \{\n {2}0: \{\n {4}"shadowColor": "#000000"/);
  assert.match(src, /export type ElevationLevel = keyof typeof elevation;/);
  assert.match(src, /export type Haptic = 'none' \| 'light' \| 'selection' \| 'medium';/);
  assert.match(src, /export const interaction: InteractionProfile = \{/);
  assert.match(src, /export const layout = \{\n {2}"gutter": 16,/);
  assert.doesNotMatch(src, /density/);
  assert.match(emitSysTs(sysTokens(model), { density: 'comfy' }), /export type Density = 'compact' \| 'regular' \| 'comfy';\n\n\/\*\* .*\*\/\nexport const density: Density = 'comfy';\n$/);
  assert.doesNotMatch(src, /^import /m);
});

test('the generated tokens.ts appends the sys sections after chrome', () => {
  const src = emitTs(model);
  const chrome = src.indexOf('export const chrome');
  assert.ok(chrome > 0 && src.indexOf('export const font = ') > chrome && src.trimEnd().endsWith('} as const;'));
  assert.equal(readFileSync(new URL('./generated/tokens.ts', import.meta.url), 'utf8'), src, 'run `pnpm tokens`');
});
