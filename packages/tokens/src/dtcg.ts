// A small reader for the W3C Design Tokens Format (DTCG 2025.10): walks
// groups, inherits `$type` from the nearest group, resolves `{a.b}` aliases
// (whole values, and the fields of composite values) and normalises each
// value to the plain number or string a React Native style can take. It
// reads only the types FluxNative UI uses and throws on any other, so a token
// file can't silently produce nothing.

export type TokenType =
  | 'color'
  | 'dimension'
  | 'duration'
  | 'number'
  | 'fontWeight'
  | 'cubicBezier'
  | 'fontFamily'
  | 'typography'
  | 'shadow';

export interface Token {
  path: string[];
  type: TokenType;
  value: unknown;
  description?: string;
  /** `$extensions` as written: vendor namespace → data. */
  extensions?: Record<string, unknown>;
}

export interface ColorValue {
  colorSpace: string;
  components: [number, number, number];
  alpha?: number;
  hex?: string;
}

export interface DimensionValue {
  value: number;
  unit: 'px' | 'rem' | 'ms' | 's';
}

/** A `typography` value with its units settled: px sizes, a unitless line height. */
export interface TypographyValue {
  /** First choice first; the last entry should be a generic family. */
  fontFamily: string[];
  /** px */
  fontSize: number;
  /** 100–900 in steps of 100, as React Native renders it. */
  fontWeight: number;
  /** Unitless multiple of the font size, as DTCG and Tailwind write it. */
  lineHeight: number;
  /** px (an `em` value is multiplied by the font size). */
  letterSpacing: number;
}

/** One `shadow` layer: an opaque `#rrggbb` plus its alpha, sizes in px. */
export interface ShadowLayer {
  color: string;
  alpha: number;
  offsetX: number;
  offsetY: number;
  blur: number;
  spread: number;
}

/** An alias that can't be followed. `path` is the token holding it; `cycle` lists a loop's tokens. */
export class AliasError extends Error {
  path: string;
  cycle: string[] | undefined;
  constructor(message: string, path: string, cycle?: string[]) {
    super(message);
    this.name = 'AliasError';
    this.path = path;
    this.cycle = cycle;
  }
}

export const TOKEN_TYPES: readonly TokenType[] = [
  'color',
  'dimension',
  'duration',
  'number',
  'fontWeight',
  'cubicBezier',
  'fontFamily',
  'typography',
  'shadow',
];
/** Types whose `$value` is an object (or a list of them) with aliasable fields. */
const COMPOSITE: ReadonlySet<TokenType> = new Set(['typography', 'shadow']);
const ALIAS = /^\{([^{}]+)\}$/;

function isObject(node: unknown): node is Record<string, unknown> {
  return typeof node === 'object' && node !== null && !Array.isArray(node);
}

/** `"{radius.lg}"` → `radius.lg`; anything else → undefined. */
export function aliasTarget(value: unknown): string | undefined {
  return typeof value === 'string' ? ALIAS.exec(value)?.[1] : undefined;
}

/** Flattens one token document into a list of tokens, aliases unresolved. */
export function flatten(doc: unknown, inheritedType?: TokenType, path: string[] = []): Token[] {
  if (!isObject(doc)) throw new Error(`Token group at "${path.join('.')}" is not an object`);
  const groupType = (doc.$type as TokenType | undefined) ?? inheritedType;
  const tokens: Token[] = [];
  for (const [key, node] of Object.entries(doc)) {
    if (key.startsWith('$')) continue;
    const here = [...path, key];
    if (!isObject(node)) throw new Error(`"${here.join('.')}" must be a token or a group`);
    if (!('$value' in node)) {
      tokens.push(...flatten(node, groupType, here));
      continue;
    }
    const type = (node.$type as TokenType | undefined) ?? groupType;
    if (!type) throw new Error(`"${here.join('.')}" has no $type and no group sets one`);
    if (!TOKEN_TYPES.includes(type)) {
      throw new Error(`"${here.join('.')}" uses $type "${type}". Supported: ${TOKEN_TYPES.join(', ')}`);
    }
    const token: Token = { path: here, type, value: node.$value };
    if (typeof node.$description === 'string') token.description = node.$description;
    if (isObject(node.$extensions)) token.extensions = node.$extensions;
    tokens.push(token);
  }
  return tokens;
}

/**
 * Replaces every `{a.b}` alias with the referenced token's value: a whole
 * `$value`, a field of a composite value (`"fontFamily": "{font.display}"`)
 * or a layer of a shadow list. A whole-value alias must point at a token of
 * the same `$type`. Without `onError` the first broken alias throws an
 * `AliasError`; with it, each token that can't be resolved is reported and
 * left out of the result.
 */
export function resolveAliases(tokens: Token[], onError?: (token: Token, error: AliasError) => void): Token[] {
  const byPath = new Map(tokens.map((t) => [t.path.join('.'), t]));
  const done = new Map<string, unknown>();

  const follow = (from: Token, target: string, seen: string[]): Token => {
    const key = from.path.join('.');
    if (seen.includes(target)) {
      throw new AliasError(`Alias cycle: ${[...seen, target].join(' → ')}`, key, seen.slice(seen.indexOf(target)));
    }
    const next = byPath.get(target);
    if (!next) throw new AliasError(`"${key}" points at missing token {${target}}`, key);
    return next;
  };

  const valueOf = (token: Token, seen: string[]): unknown => {
    const key = token.path.join('.');
    if (done.has(key)) return done.get(key);
    const target = aliasTarget(token.value);
    let value: unknown;
    if (target !== undefined) {
      const next = follow(token, target, seen);
      if (next.type !== token.type) {
        throw new AliasError(`"${key}" is a ${token.type} token but points at {${target}}, a ${next.type} token`, key);
      }
      value = valueOf(next, [...seen, target]);
    } else if (COMPOSITE.has(token.type)) {
      value = fields(token.value, token, seen);
    } else {
      value = token.value;
    }
    done.set(key, value);
    return value;
  };

  const fields = (value: unknown, token: Token, seen: string[]): unknown => {
    if (Array.isArray(value)) {
      return value.flatMap((item) => {
        const target = aliasTarget(item);
        if (target === undefined) return [fields(item, token, seen)];
        const layer = valueOf(follow(token, target, seen), [...seen, target]);
        return Array.isArray(layer) ? layer : [layer];
      });
    }
    if (!isObject(value)) return value;
    return Object.fromEntries(
      Object.entries(value).map(([name, field]) => {
        const target = aliasTarget(field);
        return [name, target === undefined ? field : valueOf(follow(token, target, seen), [...seen, target])];
      }),
    );
  };

  if (!onError) return tokens.map((t) => ({ ...t, value: valueOf(t, [t.path.join('.')]) }));
  const resolved: Token[] = [];
  for (const t of tokens) {
    try {
      resolved.push({ ...t, value: valueOf(t, [t.path.join('.')]) });
    } catch (e) {
      if (!(e instanceof AliasError)) throw e;
      onError(t, e);
    }
  }
  return resolved;
}

function round(n: number, digits = 4): number {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}

/** A DTCG sRGB color as an opaque `#rrggbb` plus its alpha. */
export function colorParts(value: unknown, where: string): { hex: string; alpha: number } {
  if (!isObject(value)) throw new Error(`${where}: color must be a DTCG color object { colorSpace, components, alpha?, hex? }`);
  const color = value as unknown as ColorValue;
  if (color.colorSpace !== 'srgb') {
    throw new Error(`${where}: colorSpace "${color.colorSpace}" is not supported yet (use srgb)`);
  }
  const { components } = color;
  if (!Array.isArray(components) || components.length !== 3 || !components.every((c) => typeof c === 'number' && c >= 0 && c <= 1)) {
    throw new Error(`${where}: components must be three numbers from 0 to 1`);
  }
  const alpha = color.alpha ?? 1;
  if (typeof alpha !== 'number' || alpha < 0 || alpha > 1) throw new Error(`${where}: alpha must be a number from 0 to 1`);
  const rgb = components.map((c) => Math.round(c * 255));
  const hex = `#${rgb.map((c) => c.toString(16).padStart(2, '0')).join('')}`;
  if (color.hex !== undefined) {
    const written = /^#([0-9a-f]{6})$/i.exec(color.hex)?.[1];
    const agrees = written !== undefined && rgb.every((c, i) => Math.abs(c - parseInt(written.slice(i * 2, i * 2 + 2), 16)) <= 1);
    if (!agrees) throw new Error(`${where}: hex "${color.hex}" doesn't match components (${hex}); components win, so fix one of them`);
  }
  return { hex, alpha };
}

/** A DTCG sRGB color as `#rrggbb`, or `rgba()` when it has alpha. */
export function toCssColor(value: unknown, where: string): string {
  const { hex, alpha } = colorParts(value, where);
  if (alpha >= 1) return hex;
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${round(alpha, 3)})`;
}

function dimension(value: unknown, where: string): { value: number; unit: string } {
  if (!isObject(value) || typeof value.value !== 'number' || typeof value.unit !== 'string') {
    throw new Error(`${where}: expected a dimension { value, unit }`);
  }
  return { value: value.value, unit: value.unit };
}

/** A DTCG dimension in px (`rem` × 16). */
export function toPx(value: unknown, where: string): number {
  const d = dimension(value, where);
  if (d.unit === 'px') return d.value;
  if (d.unit === 'rem') return d.value * 16;
  throw new Error(`${where}: unit "${d.unit}" is not supported (use px or rem)`);
}

/** A DTCG duration in ms (`s` × 1000). */
export function toMs(value: unknown, where: string): number {
  if (!isObject(value) || typeof value.value !== 'number' || typeof value.unit !== 'string') {
    throw new Error(`${where}: expected a duration { value, unit }`);
  }
  if (value.unit === 'ms') return value.value;
  if (value.unit === 's') return value.value * 1000;
  throw new Error(`${where}: unit "${value.unit}" is not supported (use ms or s)`);
}

/** A dimension or duration as a plain number: px for sizes, ms for time. */
export function toNumber(token: Token): number {
  const where = token.path.join('.');
  if (token.type === 'number' || token.type === 'fontWeight') {
    if (typeof token.value !== 'number') throw new Error(`${where}: expected a number`);
    return token.value;
  }
  if (!isObject(token.value)) throw new Error(`${where}: expected {value, unit}`);
  const { value, unit } = token.value as unknown as DimensionValue;
  switch (unit) {
    case 'px':
    case 'ms':
      return value;
    case 'rem':
      return value * 16;
    case 's':
      return value * 1000;
    default:
      throw new Error(`${where}: unit "${String(unit)}" is not supported`);
  }
}

/** A `fontFamily` value: one name or a stack, first choice first. */
export function toFontFamily(value: unknown, where: string): string[] {
  const list: unknown = typeof value === 'string' ? [value] : value;
  if (!Array.isArray(list) || list.length === 0 || !list.every((f): f is string => typeof f === 'string' && f.trim() !== '')) {
    throw new Error(`${where}: expected a font family name or a non-empty list of names`);
  }
  return list.map((f: string) => f.trim());
}

/** DTCG's named weights that React Native can render. */
const WEIGHT_NAMES: Record<string, number> = {
  thin: 100,
  hairline: 100,
  'extra-light': 200,
  'ultra-light': 200,
  light: 300,
  normal: 400,
  regular: 400,
  book: 400,
  medium: 500,
  'semi-bold': 600,
  'demi-bold': 600,
  bold: 700,
  'extra-bold': 800,
  'ultra-bold': 800,
  black: 900,
  heavy: 900,
};

/** A `fontWeight` value as React Native renders it: 100–900 in steps of 100. */
export function toFontWeight(value: unknown, where: string): number {
  const weight = typeof value === 'string' ? WEIGHT_NAMES[value] : value;
  if (typeof weight !== 'number' || weight < 100 || weight > 900 || weight % 100 !== 0) {
    throw new Error(`${where}: font weight must be 100–900 in steps of 100, or a DTCG name such as "bold" (got ${JSON.stringify(value)})`);
  }
  return weight;
}

const TYPOGRAPHY_FIELDS = ['fontFamily', 'fontSize', 'fontWeight', 'letterSpacing', 'lineHeight'];

/** A `typography` value. All five DTCG fields are required. */
export function toTypography(value: unknown, where: string): TypographyValue {
  if (!isObject(value)) throw new Error(`${where}: typography must be an object with ${TYPOGRAPHY_FIELDS.join(', ')}`);
  const missing = TYPOGRAPHY_FIELDS.filter((f) => !(f in value));
  if (missing.length) {
    throw new Error(`${where}: typography is missing ${missing.join(', ')} (all five of ${TYPOGRAPHY_FIELDS.join(', ')} are required)`);
  }
  const extra = Object.keys(value).filter((f) => !TYPOGRAPHY_FIELDS.includes(f));
  if (extra.length) throw new Error(`${where}: typography has unknown field(s) ${extra.join(', ')}`);
  const fontSize = toPx(value.fontSize, `${where}.fontSize`);
  if (typeof value.lineHeight !== 'number' || value.lineHeight <= 0) {
    throw new Error(`${where}.lineHeight: expected a unitless multiple of the font size, e.g. 1.4 (got ${JSON.stringify(value.lineHeight)})`);
  }
  const spacing = dimension(value.letterSpacing, `${where}.letterSpacing`);
  if (!['px', 'rem', 'em'].includes(spacing.unit)) {
    throw new Error(`${where}.letterSpacing: unit "${spacing.unit}" is not supported (use px, rem or em)`);
  }
  const letterSpacing = spacing.unit === 'em' ? spacing.value * fontSize : spacing.unit === 'rem' ? spacing.value * 16 : spacing.value;
  return {
    fontFamily: toFontFamily(value.fontFamily, `${where}.fontFamily`),
    fontSize,
    fontWeight: toFontWeight(value.fontWeight, `${where}.fontWeight`),
    lineHeight: value.lineHeight,
    letterSpacing: round(letterSpacing, 3),
  };
}

const SHADOW_FIELDS = ['color', 'offsetX', 'offsetY', 'blur', 'spread'];

/** A `shadow` value: one layer or a list of them. `inset` is rejected: React Native has no inner shadow. */
export function toShadow(value: unknown, where: string): ShadowLayer[] {
  const layers: unknown[] = Array.isArray(value) ? value : [value];
  if (layers.length === 0) throw new Error(`${where}: shadow list is empty`);
  return layers.map((layer, i) => {
    const at = Array.isArray(value) ? `${where}[${i}]` : where;
    if (!isObject(layer)) throw new Error(`${at}: shadow must be an object with ${SHADOW_FIELDS.join(', ')}`);
    if (layer.inset === true) throw new Error(`${at}: inset shadows are not supported (React Native draws outer shadows only)`);
    const missing = SHADOW_FIELDS.filter((f) => !(f in layer));
    if (missing.length) throw new Error(`${at}: shadow is missing ${missing.join(', ')}`);
    const extra = Object.keys(layer).filter((f) => !SHADOW_FIELDS.includes(f) && f !== 'inset');
    if (extra.length) throw new Error(`${at}: shadow has unknown field(s) ${extra.join(', ')}`);
    const { hex, alpha } = colorParts(layer.color, `${at}.color`);
    const blur = toPx(layer.blur, `${at}.blur`);
    if (blur < 0) throw new Error(`${at}.blur: must not be negative`);
    return {
      color: hex,
      alpha,
      offsetX: toPx(layer.offsetX, `${at}.offsetX`),
      offsetY: toPx(layer.offsetY, `${at}.offsetY`),
      blur,
      spread: toPx(layer.spread, `${at}.spread`),
    };
  });
}
