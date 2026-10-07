// Turns the flat DTCG token list into the one shape every emitter reads.
// The shape is closed: a group this file doesn't know is an error, so a new
// token family has to be added here (and to every emitter) on purpose.

import { flatten, resolveAliases, toCssColor, toNumber, type Token } from './dtcg.ts';

export interface TextStyle {
  fontSize: number;
  lineHeight: number;
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
}

export interface TokenSources {
  base: unknown;
  /** One document per color scheme, keyed by scheme name (`light`, `dark`). */
  schemes: Record<string, unknown>;
}

const camel = (s: string) => s.replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase());

function leaf(tokens: Token[], path: string): Token {
  const token = tokens.find((t) => t.path.join('.') === path);
  if (!token) throw new Error(`Missing required token "${path}"`);
  return token;
}

function group(tokens: Token[], name: string): Token[] {
  return tokens.filter((t) => t.path[0] === name);
}

export function buildModel(sources: TokenSources): TokenModel {
  const base = resolveAliases(flatten(sources.base));
  const known = new Set(['spacing', 'radius', 'text', 'font-weight', 'duration', 'easing', 'glass', 'chrome']);
  for (const t of base) {
    if (!known.has(t.path[0] ?? '')) {
      throw new Error(`Unknown token group "${t.path[0]}" in base tokens. Known: ${[...known].join(', ')}`);
    }
  }

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
  for (const [scheme, doc] of Object.entries(sources.schemes)) {
    const tokens = resolveAliases(flatten(doc));
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
  };
}
