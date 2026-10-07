import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from './resolve.ts';

const light = { scheme: 'light', platform: 'ios' } as const;
const dark = { scheme: 'dark', platform: 'ios' } as const;

test('spacing follows the Tailwind v4 scale', () => {
  assert.deepEqual(resolve('p-4 px-2.5 gap-x-3 -mt-1', light).style, {
    padding: 16,
    paddingHorizontal: 10,
    columnGap: 12,
    marginTop: -4,
  });
  assert.deepEqual(resolve('w-1/2 h-px size-full', light).style, {
    width: '100%',
    height: '100%',
  });
});

test('off-scale spacing is unknown, not guessed', () => {
  const { style, unknown } = resolve('p-4.3', light);
  assert.deepEqual(style, {});
  assert.equal(unknown[0]?.className, 'p-4.3');
});

test('semantic colors follow the color scheme', () => {
  assert.equal(resolve('bg-primary', light).style.backgroundColor, '#007aff');
  assert.equal(resolve('bg-primary', dark).style.backgroundColor, '#0a84ff');
  assert.equal(resolve('text-muted-foreground', light).style.color, '#6e6e73');
  assert.equal(resolve('bg-primary/50', light).style.backgroundColor, 'rgba(0, 122, 255, 0.5)');
});

test('palette colors and arbitrary values are rejected with a hint', () => {
  const { unknown } = resolve('bg-blue-500 p-[13px]', light);
  assert.equal(unknown.length, 2);
  assert.match(unknown[0]?.hint ?? '', /semantic color/);
  assert.match(unknown[1]?.hint ?? '', /Arbitrary values/);
});

test('text-* means size first, color second', () => {
  assert.deepEqual(resolve('text-lg', light).style, { fontSize: 18, lineHeight: 28 });
  assert.deepEqual(resolve('text-foreground font-semibold', light).style, {
    color: '#0a0a0b',
    fontWeight: '600',
  });
});

test('radius uses Tailwind names', () => {
  assert.deepEqual(resolve('rounded-2xl', light).style, { borderRadius: 16 });
  assert.deepEqual(resolve('rounded', light).style, { borderRadius: 4 });
  assert.deepEqual(resolve('rounded-t-xl', light).style, {
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  });
});

test('dark: and platform variants apply only when they match', () => {
  const cls = 'bg-background dark:bg-card ios:pt-2 android:pt-4';
  assert.deepEqual(resolve(cls, light).style, { backgroundColor: '#ffffff', paddingTop: 8 });
  assert.deepEqual(resolve(cls, { scheme: 'dark', platform: 'android' }).style, {
    backgroundColor: '#1c1c1e',
    paddingTop: 16,
  });
});

test('web-only variants are unknown', () => {
  const { unknown } = resolve('hover:bg-accent', light);
  assert.match(unknown[0]?.hint ?? '', /Variant "hover:"/);
});
