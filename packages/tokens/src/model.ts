// Turns the flat DTCG token list into the one shape every emitter reads.
// The shape is closed: a group this file doesn't know is an error, so a new
// token family has to be added here (and to every emitter) on purpose.

import {
  aliasTarget,
  flatten,
  resolveAliases,
  toCssColor,
  toNumber,
  toFontFamily,
  toShadow,
  toTypography,
  type ShadowLayer,
  type Token,
  type TypographyValue,
} from './dtcg.ts';

export interface TextStyle {
  fontSize: number;
  lineHeight: number;
}

/** One `font.*` role: the stack, and the OpenType features it turns on. */
export interface FontStack {
  family: string[];
  fontVariant?: string[];
}

/** One `type.*` role: px sizes, a unitless line height. */
export interface TypeRole extends TypographyValue {
  fontVariant?: string[];
}

export interface Elevation {
  /** React Native draws the first layer only. */
  layers: ShadowLayer[];
  /** Android `elevation`. */
  android: number;
}

export interface InteractionProfile {
  press: { haptic: Haptic; activeScale: number; hitSlop: number; spring: { speed: number; bounciness: number } };
  reveal: { offset: number; duration: number; stagger: number };
  skeleton: { mode: SkeletonMode; base: string; highlight: string; pulse: number; minOpacity: number; reducedOpacity: number };
}

export interface TokenModel {
  colors: Record<string, Record<string, string>>;
  colorDescriptions: Record<string, string>;
  spacingUnit: number;
  radius: Record<string, number>;
  text: Record<string, TextStyle>;
  fontWeight: Record<string, number>;
  duration: Record<string, number>;
  easing: Record<string, [number, number, number, number]>;
  glass: { blurRadius: number; saturate: number };
  chrome: { appBarHeight: number; tabBarHeight: number; tabBarInset: number };
  /** Keys are camelCase (`bodySm`, `cardInner`), as the emitted constants spell them. */
  font: Record<string, FontStack>;
  type: Record<string, TypeRole>;
  shape: Record<string, number>;
  elevation: Record<string, Elevation>;
  interaction: InteractionProfile;
  layout: { gutter: number; safeTop: number; tabBarHeight: number };
}

export interface TokenSources {
  base: unknown;
  /** One document per color scheme, keyed by scheme name (`light`, `dark`). */
  schemes: Record<string, unknown>;
}

/** Flattened, unresolved tokens: `TokenSources` after `flatten`, or several sources merged by path. */
export interface TokenLayers {
  base: Token[];
  schemes: Record<string, Token[]>;
}

// The closed vocabulary of the sys groups. Token paths are kebab-case; the
// model and the emitted constants use camelCase.
export const FONT_ROLES = ['display', 'text', 'numeric'] as const;
export const TYPE_ROLES = ['display', 'headline', 'title', 'body', 'body-sm', 'label', 'caps', 'numeric'] as const;
export const SHAPE_ROLES = ['control', 'card', 'card-inner', 'sheet', 'chip', 'avatar', 'field', 'well'] as const;
export const ELEVATION_LEVELS = ['0', '1', '2', '3', '4'] as const;
export const INTERACTION_TOKENS = [
  'press.active-scale',
  'press.hit-slop',
  'press.spring-speed',
  'press.spring-bounciness',
  'reveal.offset',
  'reveal.duration',
  'reveal.stagger',
  'skeleton.pulse',
  'skeleton.min-opacity',
  'skeleton.reduced-opacity',
] as const;
export const LAYOUT_TOKENS = ['gutter', 'safe-top', 'tab-bar-height'] as const;

// Enum-like choices are not tokens (DTCG has no string type): their values
// are closed here, and a brand picks one in `$extensions`.
export const HAPTICS = ['none', 'light', 'selection', 'medium'] as const;
export type Haptic = (typeof HAPTICS)[number];
export const SKELETON_MODES = ['opacity', 'color'] as const;
export type SkeletonMode = (typeof SKELETON_MODES)[number];
export const DENSITIES = ['compact', 'regular', 'comfy'] as const;
export type Density = (typeof DENSITIES)[number];
/** OpenType features a role may turn on through `$extensions["dev.fluxnative"].fontVariant`. */
export const FONT_VARIANTS = ['tabular-nums', 'proportional-nums', 'lining-nums', 'oldstyle-nums', 'small-caps'] as const;

/** What the catalog primitives do today when a brand says nothing. */
export const INTERACTION_DEFAULTS = {
  haptic: 'none',
  skeleton: { mode: 'opacity', base: 'muted', highlight: 'accent' },
} as const satisfies { haptic: Haptic; skeleton: { mode: SkeletonMode; base: string; highlight: string } };

/** The `$extensions` namespace FluxNative UI reads on a token. */
export const EXTENSION = 'dev.fluxnative';

export const camel = (s: string) => s.replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase());

function leaf(tokens: Token[], path: string): Token {
  const token = tokens.find((t) => t.path.join('.') === path);
  if (!token) throw new Error(`Missing required token "${path}"`);
  return token;
}

function group(tokens: Token[], name: string): Token[] {
  return tokens.filter((t) => t.path[0] === name);
}

/** The tokens of a closed sys group, by their path below the group; unknown or missing keys throw. */
function closed(tokens: Token[], name: string, keys: readonly string[]): Map<string, Token> {
  const found = new Map<string, Token>();
  for (const t of group(tokens, name)) {
    const key = t.path.slice(1).join('.');
    if (!keys.includes(key)) throw new Error(`Unknown token "${t.path.join('.')}". ${name} has: ${keys.join(', ')}`);
    found.set(key, t);
  }
  const missing = keys.filter((k) => !found.has(k));
  if (missing.length) throw new Error(`Missing required token(s) ${missing.map((k) => `"${name}.${k}"`).join(', ')}`);
  return found;
}

/** A number, dimension (px) or duration (ms) token as a plain number. */
function scalar(token: Token): number {
  if (!['number', 'dimension', 'duration'].includes(token.type)) {
    throw new Error(`${token.path.join('.')}: expected a number, dimension or duration (got ${token.type})`);
  }
  return toNumber(token);
}

/** `$extensions["dev.fluxnative"]` of a token, if any. */
export function extensionOf(token: Token | undefined): Record<string, unknown> | undefined {
  const data = token?.extensions?.[EXTENSION];
  return typeof data === 'object' && data !== null && !Array.isArray(data) ? (data as Record<string, unknown>) : undefined;
}

function fontVariantOf(token: Token | undefined): string[] | undefined {
  const variant = extensionOf(token)?.fontVariant;
  if (variant === undefined) return undefined;
  if (!Array.isArray(variant) || !variant.every((v) => (FONT_VARIANTS as readonly unknown[]).includes(v))) {
    throw new Error(`${token?.path.join('.')}: fontVariant must be a list of ${FONT_VARIANTS.join(', ')}`);
  }
  return variant as string[];
}

export function buildModel(sources: TokenSources): TokenModel {
  return buildModelFromTokens({
    base: flatten(sources.base),
    schemes: Object.fromEntries(Object.entries(sources.schemes).map(([scheme, doc]) => [scheme, flatten(doc)])),
  });
}

export function buildModelFromTokens(layers: TokenLayers): TokenModel {
  const raw = layers.base;
  const known = new Set([
    'spacing',
    'radius',
    'text',
    'font-weight',
    'duration',
    'easing',
    'glass',
    'chrome',
    'font',
    'type',
    'shape',
    'elevation',
    'interaction',
    'layout',
  ]);
  for (const t of raw) {
    if (!known.has(t.path[0] ?? '')) {
      throw new Error(`Unknown token group "${t.path[0]}" in base tokens. Known: ${[...known].join(', ')}`);
    }
  }
  const base = resolveAliases(raw);

  const text: Record<string, TextStyle> = {};
  for (const t of group(base, 'text')) {
    const [, name, part] = t.path;
    if (!name || !part) continue;
    const entry = (text[name] ??= { fontSize: 0, lineHeight: 0 });
    if (part === 'size') entry.fontSize = toNumber(t);
    else if (part === 'line-height') entry.lineHeight = toNumber(t);
    else throw new Error(`text.${name}.${part}: expected "size" or "line-height"`);
  }
  for (const [name, style] of Object.entries(text)) {
    if (!style.fontSize || !style.lineHeight) throw new Error(`text.${name} needs both size and line-height`);
    // Tokens carry Tailwind's unitless ratio; React Native wants pixels.
    style.lineHeight = Math.round(style.fontSize * style.lineHeight);
  }

  const record = (name: string) =>
    Object.fromEntries(group(base, name).map((t) => [t.path.slice(1).join('.'), toNumber(t)]));

  const easing = Object.fromEntries(
    group(base, 'easing').map((t) => {
      const v = t.value;
      if (!Array.isArray(v) || v.length !== 4) throw new Error(`${t.path.join('.')}: expected 4 numbers`);
      return [t.path[1] ?? '', v as [number, number, number, number]];
    }),
  );

  const colors: Record<string, Record<string, string>> = {};
  const colorDescriptions: Record<string, string> = {};
  let reference: string[] | undefined;
  for (const [scheme, schemeTokens] of Object.entries(layers.schemes)) {
    const tokens = resolveAliases(schemeTokens);
    const map: Record<string, string> = {};
    for (const t of tokens) {
      if (t.path[0] !== 'color' || t.type !== 'color') {
        throw new Error(`${scheme}: only color.* tokens belong in a scheme file (found ${t.path.join('.')})`);
      }
      const name = t.path.slice(1).join('-');
      map[name] = toCssColor(t.value, `${scheme}:${t.path.join('.')}`);
      if (t.description) colorDescriptions[name] ??= t.description;
    }
    const names = Object.keys(map).sort();
    if (reference && names.join() !== reference.join()) {
      const missing = reference.filter((n) => !names.includes(n));
      const extra = names.filter((n) => !reference!.includes(n));
      throw new Error(`Scheme "${scheme}" doesn't match the first scheme. Missing: [${missing}] Extra: [${extra}]`);
    }
    reference ??= names;
    colors[scheme] = map;
  }

  const chrome = Object.fromEntries(group(base, 'chrome').map((t) => [camel(t.path[1] ?? ''), toNumber(t)]));
  for (const key of ['appBarHeight', 'tabBarHeight', 'tabBarInset']) {
    if (typeof chrome[key] !== 'number') throw new Error(`Missing required token "chrome.${key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}"`);
  }

  // Sys groups: the roles a template's brand may override.
  const rawByPath = new Map(raw.map((t) => [t.path.join('.'), t]));

  const font: Record<string, FontStack> = {};
  for (const [role, t] of closed(base, 'font', FONT_ROLES)) {
    if (t.type !== 'fontFamily') throw new Error(`${t.path.join('.')}: expected a fontFamily token (got ${t.type})`);
    const stack: FontStack = { family: toFontFamily(t.value, t.path.join('.')) };
    const variant = fontVariantOf(rawByPath.get(t.path.join('.')));
    if (variant) stack.fontVariant = variant;
    font[camel(role)] = stack;
  }

  // A type role turns on its own fontVariant, else the one of the font it aliases.
  const typeVariant = (path: string, seen: string[] = []): string[] | undefined => {
    const token = rawByPath.get(path);
    const own = fontVariantOf(token);
    if (own || !token || seen.includes(path)) return own;
    const whole = aliasTarget(token.value);
    if (whole?.startsWith('type.')) return typeVariant(whole, [...seen, path]);
    const family = typeof token.value === 'object' && token.value !== null ? (token.value as Record<string, unknown>).fontFamily : undefined;
    const fontRef = aliasTarget(family);
    return fontRef?.startsWith('font.') ? font[camel(fontRef.slice('font.'.length))]?.fontVariant : undefined;
  };
  const type: Record<string, TypeRole> = {};
  for (const [role, t] of closed(base, 'type', TYPE_ROLES)) {
    if (t.type !== 'typography') throw new Error(`${t.path.join('.')}: expected a typography token (got ${t.type})`);
    const entry: TypeRole = toTypography(t.value, t.path.join('.'));
    const variant = typeVariant(t.path.join('.'));
    if (variant?.length) entry.fontVariant = variant;
    type[camel(role)] = entry;
  }

  const shape: Record<string, number> = {};
  for (const [role, t] of closed(base, 'shape', SHAPE_ROLES)) shape[camel(role)] = scalar(t);

  const elevation: Record<string, Elevation> = {};
  for (const [level, t] of closed(base, 'elevation', ELEVATION_LEVELS)) {
    const where = t.path.join('.');
    if (t.type !== 'shadow') throw new Error(`${where}: expected a shadow token (got ${t.type})`);
    const android = extensionOf(rawByPath.get(where))?.android;
    if (typeof android !== 'number' || android < 0) {
      throw new Error(`${where}: needs $extensions["${EXTENSION}"].android, the Android elevation (a number ≥ 0)`);
    }
    elevation[level] = { layers: toShadow(t.value, where), android };
  }

  const i = closed(base, 'interaction', INTERACTION_TOKENS);
  const n = (key: (typeof INTERACTION_TOKENS)[number]) => scalar(i.get(key)!);
  const interaction: InteractionProfile = {
    press: {
      haptic: INTERACTION_DEFAULTS.haptic,
      activeScale: n('press.active-scale'),
      hitSlop: n('press.hit-slop'),
      spring: { speed: n('press.spring-speed'), bounciness: n('press.spring-bounciness') },
    },
    reveal: { offset: n('reveal.offset'), duration: n('reveal.duration'), stagger: n('reveal.stagger') },
    skeleton: {
      ...INTERACTION_DEFAULTS.skeleton,
      pulse: n('skeleton.pulse'),
      minOpacity: n('skeleton.min-opacity'),
      reducedOpacity: n('skeleton.reduced-opacity'),
    },
  };

  const l = closed(base, 'layout', LAYOUT_TOKENS);
  const layout = {
    gutter: scalar(l.get('gutter')!),
    safeTop: scalar(l.get('safe-top')!),
    tabBarHeight: scalar(l.get('tab-bar-height')!),
  };

  return {
    colors,
    colorDescriptions,
    spacingUnit: toNumber(leaf(base, 'spacing.unit')),
    radius: record('radius'),
    text,
    fontWeight: record('font-weight'),
    duration: record('duration'),
    easing,
    glass: {
      blurRadius: toNumber(leaf(base, 'glass.blur-radius')),
      saturate: toNumber(leaf(base, 'glass.saturate')),
    },
    chrome: chrome as TokenModel['chrome'],
    font,
    type,
    shape,
    elevation,
    interaction,
    layout,
  };
}
