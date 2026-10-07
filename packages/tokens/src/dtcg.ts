// A small reader for the W3C Design Tokens Format (DTCG 2025.10): walks
// groups, inherits `$type` from the nearest group, resolves `{a.b}` aliases
// and normalises each value to the plain number or string a React Native
// style can take. It reads only the types FluxNative UI uses and throws on any
// other, so a token file can't silently produce nothing.

export type TokenType =
  | 'color'
  | 'dimension'
  | 'duration'
  | 'number'
  | 'fontWeight'
  | 'cubicBezier';

export interface Token {
  path: string[];
  type: TokenType;
  value: unknown;
  description?: string;
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

const TYPES: readonly TokenType[] = ['color', 'dimension', 'duration', 'number', 'fontWeight', 'cubicBezier'];
const ALIAS = /^\{([^{}]+)\}$/;

function isObject(node: unknown): node is Record<string, unknown> {
  return typeof node === 'object' && node !== null && !Array.isArray(node);
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
    if (!TYPES.includes(type)) {
      throw new Error(`"${here.join('.')}" uses $type "${type}". Supported: ${TYPES.join(', ')}`);
    }
    const token: Token = { path: here, type, value: node.$value };
    if (typeof node.$description === 'string') token.description = node.$description;
    tokens.push(token);
  }
  return tokens;
}

/** Replaces every `{a.b}` alias with the referenced token's value. */
export function resolveAliases(tokens: Token[]): Token[] {
  const byPath = new Map(tokens.map((t) => [t.path.join('.'), t]));
  const resolve = (token: Token, seen: string[]): unknown => {
    const match = typeof token.value === 'string' ? ALIAS.exec(token.value) : null;
    if (!match) return token.value;
    const target = match[1] ?? '';
    if (seen.includes(target)) throw new Error(`Alias cycle: ${[...seen, target].join(' → ')}`);
    const next = byPath.get(target);
    if (!next) throw new Error(`"${token.path.join('.')}" points at missing token {${target}}`);
    return resolve(next, [...seen, target]);
  };
  return tokens.map((t) => ({ ...t, value: resolve(t, [t.path.join('.')]) }));
}

function round(n: number, digits = 4): number {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}

/** A DTCG sRGB color as `#rrggbb`, or `rgba()` when it has alpha. */
export function toCssColor(value: unknown, where: string): string {
  if (!isObject(value)) throw new Error(`${where}: color must be a DTCG color object`);
  const color = value as unknown as ColorValue;
  if (color.colorSpace !== 'srgb') {
    throw new Error(`${where}: colorSpace "${color.colorSpace}" is not supported yet (use srgb)`);
  }
  const [r, g, b] = color.components.map((c) => Math.round(c * 255)) as [number, number, number];
  const alpha = color.alpha ?? 1;
  if (alpha >= 1) {
    return `#${[r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('')}`;
  }
  return `rgba(${r}, ${g}, ${b}, ${round(alpha, 3)})`;
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
