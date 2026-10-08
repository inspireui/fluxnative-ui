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

test('shadows map to iOS shadow props plus an Android elevation', () => {
  assert.deepEqual(resolve('shadow-md', light).style, {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
  });
  assert.equal(resolve('shadow', light).style.elevation, 3);
  assert.deepEqual(resolve('shadow-none', light).style, {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  });
  assert.equal(resolve('shadow-inner', light).unknown.length, 1);
});

test('leading-* is relative to the text-* size and wins over its line height', () => {
  assert.deepEqual(resolve('text-lg leading-tight', light).style, { fontSize: 18, lineHeight: 22.5 });
  assert.deepEqual(resolve('leading-tight text-lg', light).style, { fontSize: 18, lineHeight: 22.5 });
  assert.deepEqual(resolve('leading-none', light).style, { lineHeight: 16 });
  assert.deepEqual(resolve('leading-6', light).style, { lineHeight: 24 });
  assert.equal(resolve('leading-huge', light).unknown.length, 1);
});

test('tracking-* is an em value of the text-* size, in px', () => {
  assert.deepEqual(resolve('tracking-wide', light).style, { letterSpacing: 0.4 });
  assert.equal(resolve('text-xs tracking-wider', light).style.letterSpacing, 0.6);
  assert.equal(resolve('tracking-tighter', light).style.letterSpacing, -0.8);
  assert.equal(resolve('tracking-huge', light).unknown.length, 1);
});

test('transforms merge into one array in CSS order', () => {
  assert.deepEqual(resolve('translate-x-2 -translate-y-1 rotate-45 scale-110', light).style, {
    transform: [{ translateX: 8 }, { translateY: -4 }, { rotate: '45deg' }, { scale: 1.1 }],
  });
  assert.deepEqual(resolve('scale-x-50 -rotate-90', light).style.transform, [{ rotate: '-90deg' }, { scaleX: 0.5 }]);
  assert.deepEqual(resolve('-translate-x-1/2', light).style.transform, [{ translateX: '-50%' }]);
  assert.deepEqual(resolve('rotate-45 rotate-90', light).style.transform, [{ rotate: '90deg' }]);
  assert.equal(resolve('rotate-abc -scale-50', light).unknown.length, 2);
});

test('border-x and border-y set both sides', () => {
  assert.deepEqual(resolve('border-x border-y-2', light).style, {
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderTopWidth: 2,
    borderBottomWidth: 2,
  });
});

test('w-screen and h-screen read the window passed in', () => {
  const window = { width: 390, height: 844 };
  assert.deepEqual(resolve('w-screen h-screen', { ...light, window }).style, { width: 390, height: 844 });
  assert.equal(resolve('w-screen', { ...light, window: { width: 1024, height: 768 } }).style.width, 1024);
  const { style, unknown } = resolve('w-screen', light);
  assert.deepEqual(style, {});
  assert.match(unknown[0]?.hint ?? '', /window/);
});

test('named max-w uses the Tailwind container widths', () => {
  assert.deepEqual(resolve('max-w-md', light).style, { maxWidth: 448 });
  assert.deepEqual(resolve('max-w-7xl', light).style, { maxWidth: 1280 });
  assert.deepEqual(resolve('max-w-full', light).style, { maxWidth: '100%' });
  assert.deepEqual(resolve('max-w-md max-w-none', light).style, {});
  assert.equal(resolve('max-w-prose', light).unknown.length, 1);
});

test('line-clamp-* and active: name the prop or Pressable API to use instead', () => {
  const { style, unknown } = resolve('line-clamp-2 active:bg-accent', light);
  assert.deepEqual(style, {});
  assert.match(unknown[0]?.hint ?? '', /numberOfLines=\{2\}/);
  assert.match(unknown[1]?.hint ?? '', /Pressable/);
});

test('font weights are strings, as React Native requires', () => {
  const { fontWeight } = resolve('font-bold', light).style;
  assert.equal(typeof fontWeight, 'string');
  assert.equal(fontWeight, '700');
});
