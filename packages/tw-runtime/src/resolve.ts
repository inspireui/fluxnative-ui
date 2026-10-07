// Resolves a Tailwind class string to a React Native style object at runtime,
// for hosts with no build step (the Flux WebView, Snack). On Expo, Uniwind
// compiles the same classes; this file accepts the same contract: Tailwind v4
// names for layout, spacing, radius and type, and FluxNative UI semantic colors
// only (no `bg-blue-500`, no arbitrary `[...]` values).
//
// Every class it can't read lands in `unknown` with a hint, so a dev warning
// or the autofixer can name the valid alternative instead of failing quietly.

import {
  colors,
  fontWeight as fontWeights,
  radius as radii,
  spacingUnit,
  text as textSizes,
  type ColorScheme,
} from '@fluxnative/tokens';

export type Platform = 'ios' | 'android' | 'web';

export interface ResolveOptions {
  scheme: ColorScheme;
  platform: Platform;
}

export type Style = Record<string, string | number | string[]>;

export interface Resolved {
  style: Style;
  unknown: Array<{ className: string; hint: string }>;
}

const COLOR_NAMES = new Set(Object.keys(colors.light));
const STATIC_COLORS: Record<string, string> = {
  white: '#ffffff',
  black: '#000000',
  transparent: 'transparent',
};

const VARIANTS = new Set(['dark', 'light', 'ios', 'android', 'web']);

const STATIC: Record<string, Style> = {
  flex: { display: 'flex' },
  hidden: { display: 'none' },
  'flex-row': { flexDirection: 'row' },
  'flex-col': { flexDirection: 'column' },
  'flex-row-reverse': { flexDirection: 'row-reverse' },
  'flex-col-reverse': { flexDirection: 'column-reverse' },
  'flex-wrap': { flexWrap: 'wrap' },
  'flex-nowrap': { flexWrap: 'nowrap' },
  'flex-1': { flex: 1 },
  'flex-auto': { flexGrow: 1, flexShrink: 1, flexBasis: 'auto' },
  'flex-none': { flexGrow: 0, flexShrink: 0 },
  grow: { flexGrow: 1 },
  'grow-0': { flexGrow: 0 },
  shrink: { flexShrink: 1 },
  'shrink-0': { flexShrink: 0 },
  'items-start': { alignItems: 'flex-start' },
  'items-end': { alignItems: 'flex-end' },
  'items-center': { alignItems: 'center' },
  'items-baseline': { alignItems: 'baseline' },
  'items-stretch': { alignItems: 'stretch' },
  'justify-start': { justifyContent: 'flex-start' },
  'justify-end': { justifyContent: 'flex-end' },
  'justify-center': { justifyContent: 'center' },
  'justify-between': { justifyContent: 'space-between' },
  'justify-around': { justifyContent: 'space-around' },
  'justify-evenly': { justifyContent: 'space-evenly' },
  'self-auto': { alignSelf: 'auto' },
  'self-start': { alignSelf: 'flex-start' },
  'self-end': { alignSelf: 'flex-end' },
  'self-center': { alignSelf: 'center' },
  'self-stretch': { alignSelf: 'stretch' },
  'content-start': { alignContent: 'flex-start' },
  'content-center': { alignContent: 'center' },
  'content-between': { alignContent: 'space-between' },
  absolute: { position: 'absolute' },
  relative: { position: 'relative' },
  'overflow-hidden': { overflow: 'hidden' },
  'overflow-visible': { overflow: 'visible' },
  'overflow-scroll': { overflow: 'scroll' },
  'w-full': { width: '100%' },
  'h-full': { height: '100%' },
  'size-full': { width: '100%', height: '100%' },
  'min-w-0': { minWidth: 0 },
  'min-h-0': { minHeight: 0 },
  'aspect-square': { aspectRatio: 1 },
  'aspect-video': { aspectRatio: 16 / 9 },
  'text-left': { textAlign: 'left' },
  'text-center': { textAlign: 'center' },
  'text-right': { textAlign: 'right' },
  'text-justify': { textAlign: 'justify' },
  uppercase: { textTransform: 'uppercase' },
  lowercase: { textTransform: 'lowercase' },
  capitalize: { textTransform: 'capitalize' },
  'normal-case': { textTransform: 'none' },
  italic: { fontStyle: 'italic' },
  'not-italic': { fontStyle: 'normal' },
  underline: { textDecorationLine: 'underline' },
  'line-through': { textDecorationLine: 'line-through' },
  'no-underline': { textDecorationLine: 'none' },
  'tabular-nums': { fontVariant: ['tabular-nums'] },
  border: { borderWidth: 1 },
  'border-0': { borderWidth: 0 },
  'border-2': { borderWidth: 2 },
  'border-4': { borderWidth: 4 },
  'border-t': { borderTopWidth: 1 },
  'border-b': { borderBottomWidth: 1 },
  'border-l': { borderLeftWidth: 1 },
  'border-r': { borderRightWidth: 1 },
  'border-solid': { borderStyle: 'solid' },
  'border-dashed': { borderStyle: 'dashed' },
  'border-dotted': { borderStyle: 'dotted' },
  'inset-0': { top: 0, right: 0, bottom: 0, left: 0 },
  'pointer-events-none': { pointerEvents: 'none' },
  'pointer-events-auto': { pointerEvents: 'auto' },
};

const SPACING_PROPS: Record<string, string[]> = {
  p: ['padding'],
  px: ['paddingHorizontal'],
  py: ['paddingVertical'],
  pt: ['paddingTop'],
  pr: ['paddingRight'],
  pb: ['paddingBottom'],
  pl: ['paddingLeft'],
  ps: ['paddingStart'],
  pe: ['paddingEnd'],
  m: ['margin'],
  mx: ['marginHorizontal'],
  my: ['marginVertical'],
  mt: ['marginTop'],
  mr: ['marginRight'],
  mb: ['marginBottom'],
  ml: ['marginLeft'],
  ms: ['marginStart'],
  me: ['marginEnd'],
  gap: ['gap'],
  'gap-x': ['columnGap'],
  'gap-y': ['rowGap'],
  w: ['width'],
  h: ['height'],
  size: ['width', 'height'],
  'min-w': ['minWidth'],
  'min-h': ['minHeight'],
  'max-w': ['maxWidth'],
  'max-h': ['maxHeight'],
  top: ['top'],
  right: ['right'],
  bottom: ['bottom'],
  left: ['left'],
  inset: ['top', 'right', 'bottom', 'left'],
  'inset-x': ['left', 'right'],
  'inset-y': ['top', 'bottom'],
};
// Longest prefix first, so `gap-x-2` isn't read as `gap` + `x-2`.
const SPACING_PREFIXES = Object.keys(SPACING_PROPS).sort((a, b) => b.length - a.length);

const RADIUS_SIDES: Record<string, string[]> = {
  '': ['borderRadius'],
  t: ['borderTopLeftRadius', 'borderTopRightRadius'],
  b: ['borderBottomLeftRadius', 'borderBottomRightRadius'],
  l: ['borderTopLeftRadius', 'borderBottomLeftRadius'],
  r: ['borderTopRightRadius', 'borderBottomRightRadius'],
  tl: ['borderTopLeftRadius'],
  tr: ['borderTopRightRadius'],
  bl: ['borderBottomLeftRadius'],
  br: ['borderBottomRightRadius'],
};

const COLOR_PROPS: Record<string, string> = {
  bg: 'backgroundColor',
  text: 'color',
  border: 'borderColor',
};

/** `4` → 16, `0.5` → 2, `px` → 1. Undefined when not a Tailwind spacing step. */
function spacing(value: string): number | string | undefined {
  if (value === 'px') return 1;
  if (value === 'auto') return 'auto';
  if (value === 'full') return '100%';
  const fraction = /^(\d+)\/(\d+)$/.exec(value);
  if (fraction) return `${(Number(fraction[1]) / Number(fraction[2])) * 100}%`;
  if (!/^\d+(\.\d+)?$/.test(value)) return undefined;
  const n = Number(value);
  // Tailwind v4 only accepts multiples of 0.25.
  if (!Number.isInteger(n * 4)) return undefined;
  return n * spacingUnit;
}

/** `#rrggbb` + `/50` → `rgba(…, 0.5)`. */
function withOpacity(color: string, percent: number): string {
  const hex = /^#([0-9a-f]{6})$/i.exec(color);
  if (hex?.[1]) {
    const n = parseInt(hex[1], 16);
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${percent / 100})`;
  }
  const rgba = /^rgba\((\d+), (\d+), (\d+), ([\d.]+)\)$/.exec(color);
  if (rgba) return `rgba(${rgba[1]}, ${rgba[2]}, ${rgba[3]}, ${(Number(rgba[4]) * percent) / 100})`;
  return color;
}

function color(name: string, scheme: ColorScheme): string | undefined {
  const [base, opacity] = name.split('/') as [string, string | undefined];
  const value = COLOR_NAMES.has(base)
    ? colors[scheme][base as keyof (typeof colors)['light']]
    : STATIC_COLORS[base];
  if (value === undefined) return undefined;
  if (opacity === undefined) return value;
  const percent = Number(opacity);
  return Number.isFinite(percent) && percent >= 0 && percent <= 100 ? withOpacity(value, percent) : undefined;
}

function hintFor(cls: string): string {
  if (cls.includes('[')) return 'Arbitrary values are not allowed. Use a token class or `unsafeStyle`.';
  if (/^(bg|text|border)-[a-z]+-\d{2,3}$/.test(cls)) {
    return `Palette colors don't exist in FluxNative UI. Use a semantic color: ${[...COLOR_NAMES].filter((c) => !c.startsWith('glass')).join(', ')}.`;
  }
  return 'Not a FluxNative UI class. See AGENTS.md for the supported set.';
}

/** Reads one class (variant already stripped). Returns undefined when unknown. */
function readClass(cls: string, scheme: ColorScheme): Style | undefined {
  const fixed = STATIC[cls];
  if (fixed) return fixed;

  const negative = cls.startsWith('-');
  const body = negative ? cls.slice(1) : cls;

  for (const prefix of SPACING_PREFIXES) {
    if (!body.startsWith(`${prefix}-`)) continue;
    const raw = spacing(body.slice(prefix.length + 1));
    if (raw === undefined) return undefined;
    const value = negative && typeof raw === 'number' ? -raw : raw;
    return Object.fromEntries((SPACING_PROPS[prefix] ?? []).map((p) => [p, value]));
  }
  if (negative) return undefined;

  const round = /^rounded(?:-(t|b|l|r|tl|tr|bl|br))?(?:-(.+))?$/.exec(cls);
  if (round) {
    const side = round[1] ?? '';
    const size = round[2] ?? 'DEFAULT';
    const value = size === 'none' ? 0 : radii[size as keyof typeof radii];
    if (value === undefined) return undefined;
    return Object.fromEntries((RADIUS_SIDES[side] ?? []).map((p) => [p, value]));
  }

  const textSize = /^text-(.+)$/.exec(cls)?.[1];
  if (textSize && textSize in textSizes) {
    const { fontSize, lineHeight } = textSizes[textSize as keyof typeof textSizes];
    return { fontSize, lineHeight };
  }

  const weight = /^font-(.+)$/.exec(cls)?.[1];
  if (weight && weight in fontWeights) return { fontWeight: fontWeights[weight as keyof typeof fontWeights] };

  const opacity = /^opacity-(\d+)$/.exec(cls)?.[1];
  if (opacity !== undefined) {
    const n = Number(opacity);
    return n <= 100 ? { opacity: n / 100 } : undefined;
  }

  const z = /^z-(\d+)$/.exec(cls)?.[1];
  if (z !== undefined) return { zIndex: Number(z) };

  const colorClass = /^(bg|text|border)-(.+)$/.exec(cls);
  if (colorClass?.[1] && colorClass[2]) {
    const value = color(colorClass[2], scheme);
    if (value === undefined) return undefined;
    return { [COLOR_PROPS[colorClass[1]] ?? '']: value };
  }

  return undefined;
}

const cache = new Map<string, Resolved>();

/**
 * Resolves a class string. Later classes win, as in Tailwind source order.
 * Variants: `dark:` / `light:` (color scheme) and `ios:` / `android:` / `web:`.
 */
export function resolve(className: string | undefined, options: ResolveOptions): Resolved {
  const key = `${options.scheme}|${options.platform}|${className ?? ''}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const style: Style = {};
  const unknown: Resolved['unknown'] = [];
  for (const token of (className ?? '').split(/\s+/)) {
    if (!token) continue;
    const parts = token.split(':');
    const cls = parts.pop() ?? '';
    const variants = parts;
    const badVariant = variants.find((v) => !VARIANTS.has(v));
    if (badVariant) {
      unknown.push({ className: token, hint: `Variant "${badVariant}:" is not supported. Use: ${[...VARIANTS].join(', ')}.` });
      continue;
    }
    const applies = variants.every((v) =>
      v === 'dark' || v === 'light' ? v === options.scheme : v === options.platform,
    );
    const read = readClass(cls, options.scheme);
    if (!read) {
      unknown.push({ className: token, hint: hintFor(cls) });
      continue;
    }
    if (applies) Object.assign(style, read);
  }

  const result = { style, unknown };
  if (cache.size > 2000) cache.clear();
  cache.set(key, result);
  return result;
}
