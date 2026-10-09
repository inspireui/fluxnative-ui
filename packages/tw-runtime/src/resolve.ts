// Resolves a Tailwind class string to a React Native style object at runtime,
// for hosts with no build step (the Flux WebView, Snack). On Expo, Uniwind
// compiles the same classes; this file accepts the same contract: Tailwind v4
// names for layout, spacing, radius and type, the sys roles (`rounded-card`,
// `text-body`), and FluxNative UI semantic colors only (no `bg-blue-500`, no
// arbitrary `[...]` values).
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
// The sys roles by namespace: one of them is called `type`.
import * as sys from '@fluxnative/tokens';

export type Platform = 'ios' | 'android' | 'web';

export interface ResolveOptions {
  scheme: ColorScheme;
  platform: Platform;
  /** Window size for `w-screen` / `h-screen`. `useClassStyle` passes `useWindowDimensions()`. */
  window?: { width: number; height: number };
}

/** One entry of a React Native `transform` array, e.g. `{ rotate: '45deg' }`. */
export type Transform = Record<string, string | number>;
export type StyleValue = string | number | string[] | { width: number; height: number } | Transform[];
export type Style = Record<string, StyleValue>;

export interface Resolved {
  style: Style;
  unknown: Array<{ className: string; hint: string }>;
}

/** What one class contributes. `undefined` unsets a property (`max-w-none`). */
type Read = Record<string, StyleValue | undefined>;

const BLACK = '#000000';
const COLOR_NAMES = new Set(Object.keys(colors.light));
const STATIC_COLORS: Record<string, string> = {
  white: '#ffffff',
  black: BLACK,
  transparent: 'transparent',
};

const VARIANTS = new Set(['dark', 'light', 'ios', 'android', 'web']);

const kebab = (key: string) => key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
/** `rounded-card`, `rounded-card-inner`: the `shape` roles, from the theme's `--radius-<role>`. */
const SHAPE_RADII: Record<string, number> = Object.fromEntries(Object.entries(sys.shape).map(([role, px]) => [kebab(role), px]));
/**
 * `text-body`, `text-body-sm`: the `type` roles, from the theme's `--text-<role>` and its
 * line-height, letter-spacing and font-weight. The family and font variant aren't part of a
 * Tailwind text utility, so they stay in JS (`type.<role>`).
 */
const TYPE_ROLES: Record<string, { fontSize: number; lineHeight: number; letterSpacing: number; fontWeight: string }> = Object.fromEntries(
  Object.entries(sys.type).map(([role, t]) => [kebab(role), { fontSize: t.fontSize, lineHeight: t.lineHeight, letterSpacing: t.letterSpacing, fontWeight: t.fontWeight }]),
);

const BORDER_SIDES: Record<string, string[]> = {
  '': ['borderWidth'],
  x: ['borderLeftWidth', 'borderRightWidth'],
  y: ['borderTopWidth', 'borderBottomWidth'],
  t: ['borderTopWidth'],
  b: ['borderBottomWidth'],
  l: ['borderLeftWidth'],
  r: ['borderRightWidth'],
};

/** `border`, `border-x`, `border-y-2`, `border-t-0` … for the Tailwind widths 0, 1 (bare), 2, 4, 8. */
function borderWidths(): Record<string, Style> {
  const out: Record<string, Style> = {};
  for (const [side, props] of Object.entries(BORDER_SIDES)) {
    for (const width of [0, 1, 2, 4, 8]) {
      const name = ['border', side, width === 1 ? '' : String(width)].filter(Boolean).join('-');
      out[name] = Object.fromEntries(props.map((p) => [p, width]));
    }
  }
  return out;
}

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
  ...borderWidths(),
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

/** Tailwind v4 `--container-*` widths, in px. `max-w-none` and `max-w-full` are handled separately. */
const NAMED_MAX_WIDTHS: Record<string, number> = {
  xs: 320,
  sm: 384,
  md: 448,
  lg: 512,
  xl: 576,
  '2xl': 672,
  '3xl': 768,
  '4xl': 896,
  '5xl': 1024,
  '6xl': 1152,
  '7xl': 1280,
};

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

// Tailwind v4 `--shadow-*`: the first (largest) layer of each, as iOS shadow
// props, plus an Android elevation of similar depth.
const SHADOWS: Record<string, { height: number; radius: number; opacity: number; elevation: number }> = {
  '2xs': { height: 1, radius: 0, opacity: 0.05, elevation: 1 },
  xs: { height: 1, radius: 2, opacity: 0.05, elevation: 1 },
  sm: { height: 1, radius: 3, opacity: 0.1, elevation: 2 },
  DEFAULT: { height: 1, radius: 3, opacity: 0.1, elevation: 3 },
  md: { height: 4, radius: 6, opacity: 0.1, elevation: 4 },
  lg: { height: 10, radius: 15, opacity: 0.1, elevation: 8 },
  xl: { height: 20, radius: 25, opacity: 0.1, elevation: 12 },
  '2xl': { height: 25, radius: 50, opacity: 0.25, elevation: 16 },
  none: { height: 0, radius: 0, opacity: 0, elevation: 0 },
};

/** Unitless line heights; multiplied by the font size. */
const LEADING: Record<string, number> = {
  none: 1,
  tight: 1.25,
  snug: 1.375,
  normal: 1.5,
  relaxed: 1.625,
  loose: 2,
};

/** Letter spacing in em; multiplied by the font size. */
const TRACKING: Record<string, number> = {
  tighter: -0.05,
  tight: -0.025,
  normal: 0,
  wide: 0.025,
  wider: 0.05,
  widest: 0.1,
};

/** CSS applies `translate`, then `rotate`, then `scale`; the merged array keeps that order. */
const TRANSFORM_ORDER = ['translateX', 'translateY', 'rotate', 'scale', 'scaleX', 'scaleY'];
const TRANSFORM_PROPS: Record<string, string> = {
  'translate-x': 'translateX',
  'translate-y': 'translateY',
  rotate: 'rotate',
  scale: 'scale',
  'scale-x': 'scaleX',
  'scale-y': 'scaleY',
};

/** Font size when the class string has no `text-*` size, as in CSS. */
const BASE_FONT_SIZE = 16;

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

/** Trims float noise such as `0.1 * 15 = 1.5000000000000002`. */
function round(n: number): number {
  return Math.round(n * 1000) / 1000;
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
  if (cls.includes('[')) return 'Arbitrary values are not allowed. Use a token class, or pass the one-off value through `style`.';
  if (/^(bg|text|border)-[a-z]+-\d{2,3}$/.test(cls)) {
    return `Palette colors don't exist in FluxNative UI. Use a semantic color: ${[...COLOR_NAMES].filter((c) => !c.startsWith('glass')).join(', ')}.`;
  }
  const clamp = /^line-clamp-(.+)$/.exec(cls)?.[1];
  if (clamp !== undefined) return `\`line-clamp-*\` is a Text prop: use \`numberOfLines={${/^\d+$/.test(clamp) ? clamp : 'n'}}\`.`;
  if (cls === 'w-screen' || cls === 'h-screen') {
    return '`w-screen` / `h-screen` need the window size: pass `window` to `resolve()` (`useClassStyle` passes `useWindowDimensions()`).';
  }
  return 'Not a FluxNative UI class. See AGENTS.md for the supported set.';
}

function variantHint(variant: string): string {
  if (variant === 'active') return "`active:` has no runtime equivalent: use Pressable's `style={({pressed}) => …}`.";
  return `Variant "${variant}:" is not supported. Use: ${[...VARIANTS].join(', ')}.`;
}

/** `translate-x-2` → `{ translateX: 8 }`, `-rotate-90` → `{ rotate: '-90deg' }`, `scale-110` → `{ scale: 1.1 }`. */
function transform(body: string, negative: boolean): Transform | undefined {
  const match = /^(translate-x|translate-y|rotate|scale-x|scale-y|scale)-(.+)$/.exec(body);
  const kind = match?.[1];
  const raw = match?.[2];
  const prop = kind === undefined ? undefined : TRANSFORM_PROPS[kind];
  if (kind === undefined || raw === undefined || prop === undefined) return undefined;
  if (kind === 'rotate') return /^\d+$/.test(raw) ? { [prop]: `${negative ? '-' : ''}${raw}deg` } : undefined;
  if (kind.startsWith('scale')) return !negative && /^\d+$/.test(raw) ? { [prop]: Number(raw) / 100 } : undefined;
  const value = spacing(raw);
  if (value === undefined || value === 'auto') return undefined;
  if (!negative) return { [prop]: value };
  return { [prop]: typeof value === 'number' ? -value : `-${value}` };
}

interface Context {
  scheme: ColorScheme;
  /** Font size of the `text-*` class in the same string, for `leading-*` and `tracking-*`. */
  fontSize: number;
  window: ResolveOptions['window'];
}

/** Reads one class (variant already stripped). Returns undefined when unknown. */
function readClass(cls: string, ctx: Context): Read | undefined {
  const fixed = STATIC[cls];
  if (fixed) return fixed;

  const negative = cls.startsWith('-');
  const body = negative ? cls.slice(1) : cls;

  if (/^(translate|rotate|scale)/.test(body)) {
    const part = transform(body, negative);
    return part && { transform: [part] };
  }

  if (cls === 'w-screen') return ctx.window && { width: ctx.window.width };
  if (cls === 'h-screen') return ctx.window && { height: ctx.window.height };
  if (cls === 'max-w-none') return { maxWidth: undefined };
  const maxWidth = /^max-w-(.+)$/.exec(cls)?.[1];
  if (maxWidth !== undefined && maxWidth in NAMED_MAX_WIDTHS) return { maxWidth: NAMED_MAX_WIDTHS[maxWidth] };

  for (const prefix of SPACING_PREFIXES) {
    if (!body.startsWith(`${prefix}-`)) continue;
    const raw = spacing(body.slice(prefix.length + 1));
    if (raw === undefined) return undefined;
    const value = negative && typeof raw === 'number' ? -raw : raw;
    return Object.fromEntries((SPACING_PROPS[prefix] ?? []).map((p) => [p, value]));
  }
  if (negative) return undefined;

  const rounded = /^rounded(?:-(t|b|l|r|tl|tr|bl|br))?(?:-(.+))?$/.exec(cls);
  if (rounded) {
    const side = rounded[1] ?? '';
    const size = rounded[2] ?? 'DEFAULT';
    const value = size === 'none' ? 0 : (radii[size as keyof typeof radii] ?? SHAPE_RADII[size]);
    if (value === undefined) return undefined;
    return Object.fromEntries((RADIUS_SIDES[side] ?? []).map((p) => [p, value]));
  }

  const textSize = /^text-(.+)$/.exec(cls)?.[1];
  if (textSize && textSize in textSizes) {
    const { fontSize, lineHeight } = textSizes[textSize as keyof typeof textSizes];
    return { fontSize, lineHeight };
  }
  const role = textSize === undefined ? undefined : TYPE_ROLES[textSize];
  if (role) return { ...role };

  const weight = /^font-(.+)$/.exec(cls)?.[1];
  // React Native wants `fontWeight` as a string ('600'), never a number.
  if (weight && weight in fontWeights) return { fontWeight: String(fontWeights[weight as keyof typeof fontWeights]) };

  const shadow = /^shadow(?:-(.+))?$/.exec(cls);
  if (shadow) {
    const level = SHADOWS[shadow[1] ?? 'DEFAULT'];
    if (level === undefined) return undefined;
    return {
      shadowColor: BLACK,
      shadowOffset: { width: 0, height: level.height },
      shadowOpacity: level.opacity,
      shadowRadius: level.radius,
      elevation: level.elevation,
    };
  }

  const leading = /^leading-(.+)$/.exec(cls)?.[1];
  if (leading !== undefined) {
    const multiplier = LEADING[leading];
    if (multiplier !== undefined) return { lineHeight: round(ctx.fontSize * multiplier) };
    // `leading-3` … `leading-10` are spacing steps.
    const step = /^\d+$/.test(leading) ? Number(leading) : NaN;
    return step >= 3 && step <= 10 ? { lineHeight: step * spacingUnit } : undefined;
  }

  const tracking = /^tracking-(.+)$/.exec(cls)?.[1];
  if (tracking !== undefined) {
    const em = TRACKING[tracking];
    return em === undefined ? undefined : { letterSpacing: round(ctx.fontSize * em) };
  }

  const opacity = /^opacity-(\d+)$/.exec(cls)?.[1];
  if (opacity !== undefined) {
    const n = Number(opacity);
    return n <= 100 ? { opacity: n / 100 } : undefined;
  }

  const z = /^z-(\d+)$/.exec(cls)?.[1];
  if (z !== undefined) return { zIndex: Number(z) };

  const colorClass = /^(bg|text|border)-(.+)$/.exec(cls);
  if (colorClass?.[1] && colorClass[2]) {
    const value = color(colorClass[2], ctx.scheme);
    if (value === undefined) return undefined;
    return { [COLOR_PROPS[colorClass[1]] ?? '']: value };
  }

  return undefined;
}

const cache = new Map<string, Resolved>();

/**
 * Resolves a class string. Later classes win, as in Tailwind source order,
 * except that `leading-*` always wins over the line height of `text-*`
 * (and `tracking-*` / `font-<weight>` over a `text-<role>`'s), and
 * transforms merge into one `transform` array in CSS order.
 * Variants: `dark:` / `light:` (color scheme) and `ios:` / `android:` / `web:`.
 */
export function resolve(className: string | undefined, options: ResolveOptions): Resolved {
  const { window } = options;
  const key = `${options.scheme}|${options.platform}|${window ? `${window.width}x${window.height}` : ''}|${className ?? ''}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const style: Style = {};
  const unknown: Resolved['unknown'] = [];

  // First pass: variants, and the font size `leading-*` / `tracking-*` are relative to.
  const classes: Array<{ token: string; cls: string; applies: boolean; badVariant?: string }> = [];
  let fontSize = BASE_FONT_SIZE;
  for (const token of (className ?? '').split(/\s+/)) {
    if (!token) continue;
    const parts = token.split(':');
    const cls = parts.pop() ?? '';
    const variants = parts;
    const badVariant = variants.find((v) => !VARIANTS.has(v));
    const applies =
      badVariant === undefined &&
      variants.every((v) => (v === 'dark' || v === 'light' ? v === options.scheme : v === options.platform));
    classes.push({ token, cls, applies, badVariant });
    const size = /^text-(.+)$/.exec(cls)?.[1];
    if (applies && size && size in textSizes) fontSize = textSizes[size as keyof typeof textSizes].fontSize;
    else if (applies && size && TYPE_ROLES[size]) fontSize = TYPE_ROLES[size].fontSize;
  }

  // Second pass, in source order so `unknown` reads top to bottom.
  const ctx: Context = { scheme: options.scheme, fontSize, window };
  const transforms = new Map<string, string | number>();
  let leading: StyleValue | undefined;
  let tracking: StyleValue | undefined;
  let weight: StyleValue | undefined;
  for (const { token, cls, applies, badVariant } of classes) {
    if (badVariant !== undefined) {
      unknown.push({ className: token, hint: variantHint(badVariant) });
      continue;
    }
    const read = readClass(cls, ctx);
    if (!read) {
      unknown.push({ className: token, hint: hintFor(cls) });
      continue;
    }
    if (!applies) continue;
    for (const [prop, value] of Object.entries(read)) {
      if (value === undefined) delete style[prop];
      else if (prop === 'transform' && Array.isArray(value)) {
        for (const part of value) if (typeof part === 'object') for (const [k, v] of Object.entries(part)) transforms.set(k, v);
      } else style[prop] = value;
    }
    if (cls.startsWith('leading-')) leading = read.lineHeight;
    if (cls.startsWith('tracking-')) tracking = read.letterSpacing;
    if (cls.startsWith('font-') && read.fontWeight !== undefined) weight = read.fontWeight;
  }
  // Tailwind v4 sets `line-height: var(--tw-leading, …)` on `text-*` (and a
  // role's letter-spacing and font-weight through `--tw-tracking` and
  // `--tw-font-weight`), so `leading-*`, `tracking-*` and `font-*` win
  // whichever comes first.
  if (leading !== undefined) style.lineHeight = leading;
  if (tracking !== undefined) style.letterSpacing = tracking;
  if (weight !== undefined) style.fontWeight = weight;
  if (transforms.size > 0) {
    style.transform = [...transforms]
      .sort(([a], [b]) => TRANSFORM_ORDER.indexOf(a) - TRANSFORM_ORDER.indexOf(b))
      .map(([prop, value]) => ({ [prop]: value }));
  }

  const result = { style, unknown };
  if (cache.size > 2000) cache.clear();
  cache.set(key, result);
  return result;
}
