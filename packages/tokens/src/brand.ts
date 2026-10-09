// A template's design DNA (token contract v0.1): DTCG brand files that
// override the kit's sys tokens and colour roles. `validateBrand` merges a
// brand over the kit, resolves it and checks fixed, deterministic rules,
// collecting every problem as an error or a warning; `resolveBrand` throws
// when there is an error. Pure: files are read through the caller's
// `BrandIO`, so the module also loads in React Native bundles.
//
// Merge rules: the kit comes first. A brand token replaces the kit token at
// the same path (`$value`, `$type`, `$description`); its
// `$extensions["dev.fluxnative"]` keys override the kit's one by one.
// Scheme-independent groups and light colours come from the brand file (a
// resolver's sets, in order); dark colours only from the dark file (the
// resolver's `theme` modifier, context `dark`).

import {
  aliasTarget,
  colorParts,
  flatten,
  resolveAliases,
  toFontFamily,
  toMs,
  toPx,
  toShadow,
  toTypography,
  TOKEN_TYPES,
  type Token,
  type TokenType,
} from './dtcg.ts';
import {
  buildModel,
  buildModelFromTokens,
  camel,
  DENSITIES,
  ELEVATION_LEVELS,
  EXTENSION,
  extensionOf,
  FONT_ROLES,
  FONT_VARIANTS,
  HAPTICS,
  INTERACTION_DEFAULTS,
  INTERACTION_TOKENS,
  LAYOUT_TOKENS,
  SHAPE_ROLES,
  SKELETON_MODES,
  TYPE_ROLES,
  type Density,
  type Haptic,
  type SkeletonMode,
  type TokenModel,
  type TokenSources,
} from './model.ts';
import { sysTokens, type SysTokens } from './sys.ts';

export type { TokenSources } from './model.ts';

/** Root `$extensions` namespace of a brand file. */
export const BRAND_EXTENSION = 'dev.fluxnative.brand';
/** Groups a brand may override. */
export const BRAND_GROUPS = ['color', 'font', 'type', 'shape', 'elevation', 'duration', 'easing', 'interaction', 'layout'] as const;
/** Kit groups a brand may not touch: the reference scales stay one scale for every template. */
export const KIT_ONLY_GROUPS = ['spacing', 'radius', 'text', 'font-weight', 'glass', 'chrome'] as const;
/** Generic families: a font stack must end with one. */
export const GENERIC_FONT_FAMILIES = ['System', 'serif', 'sans-serif', 'monospace'] as const;
/** Families v0.1 allows: hosts load no web fonts yet, so only what the platforms ship. */
export const SYSTEM_FONT_FAMILIES = [...GENERIC_FONT_FAMILIES, 'Georgia', 'Menlo', 'Courier'] as const;

export type BrandScheme = 'light' | 'dark' | 'system';

/** `$extensions["dev.fluxnative.brand"]`, with defaults filled in. */
export interface BrandMeta {
  schemaVersion: 1;
  /** `light` / `dark` lock the template to one scheme; `system` follows the OS. */
  scheme: BrandScheme;
  density: Density;
  /** Free words for reviewers and models ("quiet", "editorial"); not emitted. */
  personality: string[];
  /** Default haptic of a press. */
  haptic: Haptic;
  skeleton: { mode: SkeletonMode; base: string; highlight: string };
}

export interface BrandProblem {
  level: 'error' | 'warning';
  /** The token path (`type.body`), scheme (`light`) or file the problem is about. */
  at: string;
  message: string;
}

/** One parsed brand document and the file it came from. */
export interface BrandSource {
  file: string;
  doc: unknown;
}

/** Brand documents in resolution order. */
export interface BrandLayers {
  /** Scheme-independent sources: the groups, the light colours and the brand metadata. */
  sets: BrandSource[];
  /** Colour-only sources for one scheme (a resolver's `theme` contexts). */
  light: BrandSource[];
  dark: BrandSource[];
}

export interface ResolvedBrand {
  meta: BrandMeta;
  /** Every colour role per scheme, in the kit's order. */
  colors: { light: Record<string, string>; dark: Record<string, string> };
  /** ms */
  duration: Record<string, number>;
  easing: Record<string, [number, number, number, number]>;
  /** font, type, shape, elevation, interaction, layout as React Native style data. */
  sys: SysTokens;
  model: TokenModel;
  warnings: BrandProblem[];
  /** The brand documents as read, in order (hash them to fingerprint a brand). */
  sources: BrandSource[];
}

export interface BrandReport {
  errors: BrandProblem[];
  warnings: BrandProblem[];
  /** Present when there are no errors. */
  brand?: ResolvedBrand;
}

/** Thrown with every problem found, errors first. */
export class BrandError extends Error {
  readonly problems: BrandProblem[];
  constructor(problems: BrandProblem[]) {
    const errors = problems.filter((p) => p.level === 'error').length;
    super(`brand: ${errors} error${errors === 1 ? '' : 's'}\n${formatProblems(problems)}`);
    this.name = 'BrandError';
    this.problems = problems;
  }
}

/** One line per problem, errors first: `error    type.body: …`. */
export function formatProblems(problems: BrandProblem[]): string {
  return [...problems]
    .sort((a, b) => (a.level === b.level ? 0 : a.level === 'error' ? -1 : 1))
    .map((p) => `  ${p.level.padEnd(7)} ${p.at}: ${p.message}`)
    .join('\n');
}

/** Reads files for `readBrandFiles`. */
export interface BrandIO {
  /** The file's text, or undefined when there is no such file. */
  readText(path: string): string | undefined;
}

const error = (at: string, message: string): BrandProblem => ({ level: 'error', at, message });
const warning = (at: string, message: string): BrandProblem => ({ level: 'warning', at, message });
const message = (e: unknown) => (e instanceof Error ? e.message : String(e));
const quote = (values: readonly string[]) => values.map((v) => `"${v}"`).join(', ');

function isObject(node: unknown): node is Record<string, unknown> {
  return typeof node === 'object' && node !== null && !Array.isArray(node);
}

// ---------------------------------------------------------------------------
// Reading: brand.tokens.json (+ .dark sibling), a resolver, or a folder.

/** Layers for a brand file and its optional dark sibling. */
export function brandLayers(brand: BrandSource, dark?: BrandSource): BrandLayers {
  return { sets: [brand], light: [], dark: dark ? [dark] : [] };
}

const RESOLVER_KEYS = ['$schema', '$extensions', 'name', 'version', 'description', 'sets', 'modifiers', 'resolutionOrder'];

/**
 * Layers from a DTCG Resolver 2025.10 document, in the subset FluxNative UI
 * reads: `sets` whose `sources` are `{ "$ref": "<relative path>" }`, one
 * `theme` modifier with `light` / `dark` contexts, and a `resolutionOrder`
 * that lists every set and puts the theme modifier last. `load(ref)` returns
 * the parsed source a `$ref` names. Anything else throws a BrandError.
 */
export function resolverLayers(doc: unknown, file: string, load: (ref: string) => BrandSource): BrandLayers {
  const problems: BrandProblem[] = [];
  const fail = (text: string) => problems.push(error(file, text));
  if (!isObject(doc)) throw new BrandError([error(file, 'a resolver must be a JSON object')]);
  for (const key of Object.keys(doc)) {
    if (!RESOLVER_KEYS.includes(key)) fail(`"${key}" is not part of the resolver subset FluxNative UI reads (${RESOLVER_KEYS.join(', ')})`);
  }
  if (doc.version !== undefined && doc.version !== '2025.10') fail(`version must be "2025.10" (got ${JSON.stringify(doc.version)})`);

  const sources = (list: unknown, where: string): BrandSource[] => {
    if (!Array.isArray(list)) {
      fail(`${where} must be a list of { "$ref": "<relative path>" }`);
      return [];
    }
    return list.flatMap((item: unknown, i) => {
      const ref = isObject(item) ? item.$ref : undefined;
      if (typeof ref !== 'string' || !isObject(item) || Object.keys(item).length !== 1) {
        fail(`${where}[${i}]: only { "$ref": "<relative path>" } sources are supported (no inline tokens)`);
        return [];
      }
      if (/^([a-z][a-z0-9+.-]*:|[\\/]|#)/i.test(ref)) {
        fail(`${where}[${i}]: "${ref}" must be a file path relative to the resolver`);
        return [];
      }
      try {
        return [load(ref)];
      } catch (e) {
        if (e instanceof BrandError) problems.push(...e.problems);
        else fail(`${where}[${i}]: ${message(e)}`);
        return [];
      }
    });
  };

  const sets = new Map<string, BrandSource[]>();
  if (doc.sets !== undefined && !isObject(doc.sets)) fail('sets must be an object of name → { "sources": [...] }');
  for (const [name, set] of Object.entries(isObject(doc.sets) ? doc.sets : {})) {
    if (!isObject(set)) {
      fail(`sets.${name} must be { "sources": [...] }`);
      continue;
    }
    for (const key of Object.keys(set)) {
      if (!['sources', 'description', '$extensions'].includes(key)) fail(`sets.${name}.${key} is not supported`);
    }
    sets.set(name, sources(set.sources, `sets.${name}.sources`));
  }

  let theme: { light: BrandSource[]; dark: BrandSource[] } | undefined;
  if (doc.modifiers !== undefined && !isObject(doc.modifiers)) fail('modifiers must be an object');
  for (const [name, modifier] of Object.entries(isObject(doc.modifiers) ? doc.modifiers : {})) {
    if (name !== 'theme') {
      fail(`modifiers.${name}: only the "theme" modifier (contexts light and dark) is supported`);
      continue;
    }
    if (!isObject(modifier) || !isObject(modifier.contexts)) {
      fail('modifiers.theme needs "contexts": { "light": [...], "dark": [...] }');
      continue;
    }
    for (const key of Object.keys(modifier)) {
      if (!['contexts', 'default', 'description', '$extensions'].includes(key)) fail(`modifiers.theme.${key} is not supported`);
    }
    if (modifier.default !== undefined && modifier.default !== 'light' && modifier.default !== 'dark') {
      fail('modifiers.theme.default must be "light" or "dark"');
    }
    const contexts = { light: [] as BrandSource[], dark: [] as BrandSource[] };
    for (const [context, list] of Object.entries(modifier.contexts)) {
      if (context !== 'light' && context !== 'dark') {
        fail(`modifiers.theme.contexts.${context}: only "light" and "dark" are supported`);
        continue;
      }
      contexts[context] = sources(list, `modifiers.theme.contexts.${context}`);
    }
    theme = contexts;
  }

  const ordered: BrandSource[] = [];
  const listed = new Set<string>();
  if (!Array.isArray(doc.resolutionOrder)) {
    fail('resolutionOrder must list every set, then the theme modifier: [{ "$ref": "#/sets/brand" }, { "$ref": "#/modifiers/theme" }]');
  } else {
    const order: unknown[] = doc.resolutionOrder;
    order.forEach((item, i) => {
      const ref = typeof item === 'string' ? item : isObject(item) && typeof item.$ref === 'string' ? item.$ref : undefined;
      const match = ref === undefined ? null : /^(?:#\/(sets|modifiers)\/)?([^/]+)$/.exec(ref);
      const kind = match?.[1];
      const name = match?.[2];
      if (name === undefined) {
        fail(`resolutionOrder[${i}]: expected { "$ref": "#/sets/<name>" } or { "$ref": "#/modifiers/theme" }`);
        return;
      }
      if (listed.has(name)) fail(`resolutionOrder lists "${name}" twice`);
      listed.add(name);
      if (kind !== 'modifiers' && sets.has(name)) {
        ordered.push(...(sets.get(name) ?? []));
      } else if (kind !== 'sets' && name === 'theme' && theme) {
        if (i !== order.length - 1) fail('the theme modifier must come last in resolutionOrder');
      } else {
        fail(`resolutionOrder[${i}]: "${ref}" names no set or modifier in this file`);
      }
    });
  }
  for (const name of sets.keys()) if (!listed.has(name)) fail(`sets.${name} is not in resolutionOrder`);
  if (theme && !listed.has('theme')) fail('modifiers.theme is not in resolutionOrder');
  if (problems.length) throw new BrandError(problems);
  return { sets: ordered, light: theme?.light ?? [], dark: theme?.dark ?? [] };
}

const dirOf = (path: string) => path.slice(0, Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\')) + 1);

/**
 * Reads a brand through `io`: a `*.resolver.json`; a `*.tokens.json` with
 * its optional `*.dark.tokens.json` sibling; or a folder holding
 * `brand.resolver.json` or `brand.tokens.json`. Throws a BrandError when a
 * file is missing, isn't JSON, or the resolver asks for more than the subset.
 */
export function readBrandFiles(entry: string, io: BrandIO): BrandLayers {
  const parse = (path: string): BrandSource => {
    const text = io.readText(path);
    if (text === undefined) throw new BrandError([error(path, 'file not found')]);
    try {
      return { file: path, doc: JSON.parse(text) as unknown };
    } catch (e) {
      throw new BrandError([error(path, `not valid JSON: ${message(e)}`)]);
    }
  };
  let file = entry;
  if (!/\.json$/i.test(entry)) {
    const dir = `${entry.replace(/[\\/]+$/, '')}/`;
    file = io.readText(`${dir}brand.resolver.json`) !== undefined ? `${dir}brand.resolver.json` : `${dir}brand.tokens.json`;
  }
  if (/\.dark\.tokens\.json$/i.test(file)) {
    throw new BrandError([error(file, 'pass the brand file itself; its .dark.tokens.json sibling is read with it')]);
  }
  if (/\.resolver\.json$/i.test(file)) {
    return resolverLayers(parse(file).doc, file, (ref) => parse(`${dirOf(file)}${ref}`));
  }
  const darkFile = file.replace(/\.tokens\.json$/i, '.dark.tokens.json');
  const dark = darkFile !== file && io.readText(darkFile) !== undefined ? parse(darkFile) : undefined;
  return brandLayers(parse(file), dark);
}

// ---------------------------------------------------------------------------
// Validation.

type Scope = 'base' | 'light' | 'dark';

interface Entry {
  token: Token;
  file: string;
}

const INTERACTION_TYPES: Record<string, readonly TokenType[]> = {
  'press.active-scale': ['number'],
  'press.hit-slop': ['dimension', 'number'],
  'press.spring-speed': ['number'],
  'press.spring-bounciness': ['number'],
  'reveal.offset': ['dimension', 'number'],
  'reveal.duration': ['duration', 'number'],
  'reveal.stagger': ['duration', 'number'],
  'skeleton.pulse': ['duration', 'number'],
  'skeleton.min-opacity': ['number'],
  'skeleton.reduced-opacity': ['number'],
};

const GROUP_TYPES: Record<string, readonly TokenType[]> = {
  color: ['color'],
  font: ['fontFamily'],
  type: ['typography'],
  shape: ['dimension'],
  elevation: ['shadow'],
  duration: ['duration', 'number'],
  easing: ['cubicBezier'],
  layout: ['dimension', 'number'],
};

/** Keys each group's `$extensions["dev.fluxnative"]` may carry. */
const EXTENSION_KEYS: Record<string, readonly string[]> = { font: ['fontVariant'], type: ['fontVariant'], elevation: ['android'] };

const META_KEYS = ['schemaVersion', 'scheme', 'density', 'personality', 'haptic', 'skeleton'];
const ROOT_PROPERTIES = ['$schema', '$description', '$extensions', '$type'];

/** The kit's closed key list for a brand group (token path below the group). */
function keysOf(group: string, kit: TokenModel): readonly string[] {
  switch (group) {
    case 'color':
      return Object.keys(kit.colors.light ?? {});
    case 'font':
      return FONT_ROLES;
    case 'type':
      return TYPE_ROLES;
    case 'shape':
      return SHAPE_ROLES;
    case 'elevation':
      return ELEVATION_LEVELS;
    case 'duration':
      return Object.keys(kit.duration);
    case 'easing':
      return Object.keys(kit.easing);
    case 'interaction':
      return INTERACTION_TOKENS;
    case 'layout':
      return LAYOUT_TOKENS;
    default:
      return [];
  }
}

const TOKEN_PROPERTIES = ['$value', '$type', '$description', '$extensions', '$deprecated'];

/** Like `flatten`, but records each problem and keeps going. */
function walk(node: Record<string, unknown>, file: string, problems: BrandProblem[], inherited?: string, path: string[] = []): Token[] {
  const groupType = typeof node.$type === 'string' ? node.$type : inherited;
  const tokens: Token[] = [];
  for (const [key, child] of Object.entries(node)) {
    if (key.startsWith('$')) continue;
    const here = [...path, key];
    const at = here.join('.');
    if (!isObject(child)) {
      problems.push(error(at, `must be a token (with $value) or a group (${file})`));
      continue;
    }
    if (!('$value' in child)) {
      if (!Object.keys(child).some((k) => !k.startsWith('$'))) {
        problems.push(error(at, `has no $value and no tokens; a token needs "$value" (${file})`));
        continue;
      }
      tokens.push(...walk(child, file, problems, groupType, here));
      continue;
    }
    const stray = Object.keys(child).filter((k) => !TOKEN_PROPERTIES.includes(k));
    if (stray.length) {
      problems.push(error(at, `a token holds only ${TOKEN_PROPERTIES.join(', ')}; found ${stray.join(', ')} (${file})`));
      continue;
    }
    const type = typeof child.$type === 'string' ? child.$type : groupType;
    if (type === undefined) {
      problems.push(error(at, `has no $type and no group sets one (${file})`));
      continue;
    }
    if (!(TOKEN_TYPES as readonly string[]).includes(type)) {
      problems.push(error(at, `$type "${type}" is not supported; use one of ${TOKEN_TYPES.join(', ')} (${file})`));
      continue;
    }
    const token: Token = { path: here, type: type as TokenType, value: child.$value };
    if (typeof child.$description === 'string') token.description = child.$description;
    if (isObject(child.$extensions)) token.extensions = child.$extensions;
    tokens.push(token);
  }
  return tokens;
}

/** Closed keys, `$type` and extensions of one brand document; returns its valid tokens by scope. */
function readDocument(source: BrandSource, kind: 'set' | 'light' | 'dark', kit: TokenModel, problems: BrandProblem[]): Array<{ scope: Scope; token: Token }> {
  const { file, doc } = source;
  if (!isObject(doc)) {
    problems.push(error(file, 'a brand file must be a JSON object'));
    return [];
  }
  const out: Array<{ scope: Scope; token: Token }> = [];
  for (const key of Object.keys(doc)) {
    if (key.startsWith('$')) {
      if (!ROOT_PROPERTIES.includes(key)) problems.push(error(file, `root property "${key}" is not read (${ROOT_PROPERTIES.join(', ')})`));
      continue;
    }
    if (kind !== 'set' && key !== 'color') {
      problems.push(error(key, `a ${kind} scheme file holds color.* only (${file})`));
      continue;
    }
    if ((KIT_ONLY_GROUPS as readonly string[]).includes(key)) {
      const hint = key === 'chrome' ? '; set layout.tab-bar-height for the tab bar' : key === 'text' ? '; set type.* roles instead' : key === 'radius' ? '; alias it from shape.* roles instead' : '';
      problems.push(error(key, `is kit-only: spacing, radius, text, font-weight, glass and chrome stay one scale for every template${hint} (${file})`));
      continue;
    }
    if (!(BRAND_GROUPS as readonly string[]).includes(key)) {
      const hint = key === 'motion' ? '; motion lives in the kit groups duration and easing, at the root' : '';
      problems.push(error(key, `unknown group${hint}; a brand overrides ${BRAND_GROUPS.join(', ')} (${file})`));
      continue;
    }
    const group = doc[key];
    if (!isObject(group)) {
      problems.push(error(key, `must be a group (${file})`));
      continue;
    }
    const inherited = typeof doc.$type === 'string' ? doc.$type : undefined;
    for (const token of walk(group, file, problems, inherited, [key])) {
      const at = token.path.join('.');
      const sub = key === 'color' ? token.path.slice(1).join('-') : token.path.slice(1).join('.');
      const keys = keysOf(key, kit);
      if (!keys.includes(sub)) {
        const kebab = sub.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
        const hint = kebab !== sub && keys.includes(kebab) ? `; did you mean "${key}.${kebab}"? token names are kebab-case` : '';
        problems.push(error(at, `unknown token${hint}; ${key} has ${keys.join(', ')} (${file})`));
        continue;
      }
      const types = key === 'interaction' ? (INTERACTION_TYPES[sub] ?? []) : (GROUP_TYPES[key] ?? []);
      if (!types.includes(token.type)) {
        problems.push(error(at, `$type ${token.type} doesn't fit; use ${types.join(' or ')} (${file})`));
        continue;
      }
      if (!extensionsOk(token, key, at, file, problems)) continue;
      out.push({ scope: key === 'color' ? (kind === 'dark' ? 'dark' : 'light') : 'base', token });
    }
  }
  return out;
}

function extensionsOk(token: Token, group: string, at: string, file: string, problems: BrandProblem[]): boolean {
  const ext = token.extensions;
  if (!ext) return true;
  let ok = true;
  if (BRAND_EXTENSION in ext) {
    problems.push(error(at, `$extensions["${BRAND_EXTENSION}"] belongs at the root of the brand file; a token's extensions use "${EXTENSION}" (${file})`));
    ok = false;
  }
  const data = ext[EXTENSION];
  if (data === undefined) return ok;
  if (!isObject(data)) {
    problems.push(error(at, `$extensions["${EXTENSION}"] must be an object (${file})`));
    return false;
  }
  const allowed = EXTENSION_KEYS[group] ?? [];
  for (const [k, v] of Object.entries(data)) {
    if (!allowed.includes(k)) {
      problems.push(error(at, `$extensions["${EXTENSION}"].${k} is not read on ${group} tokens${allowed.length ? ` (only ${allowed.join(', ')})` : ''} (${file})`));
      ok = false;
    } else if (k === 'fontVariant' && (!Array.isArray(v) || !v.every((x) => (FONT_VARIANTS as readonly unknown[]).includes(x)))) {
      problems.push(error(at, `fontVariant must be a list of ${quote(FONT_VARIANTS)} (${file})`));
      ok = false;
    } else if (k === 'android' && (typeof v !== 'number' || v < 0)) {
      problems.push(error(at, `android must be the Android elevation, a number ≥ 0 (${file})`));
      ok = false;
    }
  }
  return ok;
}

function readMeta(layers: BrandLayers, colorNames: readonly string[], problems: BrandProblem[]): BrandMeta {
  const meta: BrandMeta = {
    schemaVersion: 1,
    scheme: 'system',
    density: 'regular',
    personality: [],
    haptic: INTERACTION_DEFAULTS.haptic,
    skeleton: { ...INTERACTION_DEFAULTS.skeleton },
  };
  const rootMeta = (s: BrandSource) => (isObject(s.doc) && isObject(s.doc.$extensions) ? s.doc.$extensions[BRAND_EXTENSION] : undefined);
  for (const s of [...layers.light, ...layers.dark]) {
    if (rootMeta(s) !== undefined) problems.push(error(s.file, `$extensions["${BRAND_EXTENSION}"] belongs in the brand file, not a scheme file`));
  }
  const found = layers.sets.filter((s) => rootMeta(s) !== undefined);
  const at = BRAND_EXTENSION;
  if (found.length === 0) {
    problems.push(error(layers.sets[0]?.file ?? 'brand', `missing root $extensions["${BRAND_EXTENSION}"]: { "schemaVersion": 1 }`));
    return meta;
  }
  if (found.length > 1) problems.push(error(at, `declare it once (found in ${found.map((s) => s.file).join(', ')})`));
  const raw = rootMeta(found[found.length - 1]!);
  if (!isObject(raw)) {
    problems.push(error(at, 'must be an object'));
    return meta;
  }
  for (const key of Object.keys(raw)) {
    if (!META_KEYS.includes(key)) problems.push(error(`${at}.${key}`, `unknown key; known: ${META_KEYS.join(', ')}`));
  }
  if (raw.schemaVersion !== 1) problems.push(error(`${at}.schemaVersion`, `must be 1 (got ${JSON.stringify(raw.schemaVersion)})`));
  const pick = <T extends string>(from: Record<string, unknown>, key: string, where: string, allowed: readonly T[], fallback: T): T => {
    const value = from[key];
    if (value === undefined) return fallback;
    if ((allowed as readonly unknown[]).includes(value)) return value as T;
    problems.push(error(where, `must be ${quote(allowed)} (got ${JSON.stringify(value)})`));
    return fallback;
  };
  meta.scheme = pick(raw, 'scheme', `${at}.scheme`, ['light', 'dark', 'system'] as const, 'system');
  meta.density = pick(raw, 'density', `${at}.density`, DENSITIES, 'regular');
  meta.haptic = pick(raw, 'haptic', `${at}.haptic`, HAPTICS, INTERACTION_DEFAULTS.haptic);
  if (raw.personality !== undefined) {
    if (Array.isArray(raw.personality) && raw.personality.every((w) => typeof w === 'string' && w.trim() !== '')) meta.personality = [...raw.personality];
    else problems.push(error(`${at}.personality`, 'must be a list of words'));
  }
  if (raw.skeleton !== undefined) {
    if (!isObject(raw.skeleton)) {
      problems.push(error(`${at}.skeleton`, 'must be { mode?, base?, highlight? }'));
    } else {
      const s = raw.skeleton;
      for (const key of Object.keys(s)) {
        if (!['mode', 'base', 'highlight'].includes(key)) problems.push(error(`${at}.skeleton.${key}`, 'unknown key; known: mode, base, highlight'));
      }
      meta.skeleton.mode = pick(s, 'mode', `${at}.skeleton.mode`, SKELETON_MODES, meta.skeleton.mode);
      for (const key of ['base', 'highlight'] as const) {
        const role = s[key];
        if (role === undefined) continue;
        if (typeof role === 'string' && colorNames.includes(role)) meta.skeleton[key] = role;
        else problems.push(error(`${at}.skeleton.${key}`, `must be a colour role such as "muted" (got ${JSON.stringify(role)})`));
      }
    }
  }
  return meta;
}

/** Kit tokens with brand entries laid over them, kit order kept. */
function merge(kit: Token[], entries: Map<string, Entry>, fromBrand: WeakSet<Token>): Token[] {
  const merged = new Map(kit.map((t) => [t.path.join('.'), t]));
  for (const [key, { token }] of entries) {
    const before = merged.get(key);
    const ext = { ...extensionOf(before), ...extensionOf(token) };
    const next: Token = { ...token };
    if (Object.keys(ext).length) next.extensions = { ...token.extensions, [EXTENSION]: ext };
    if (next.description === undefined && before?.description !== undefined) next.description = before.description;
    fromBrand.add(next);
    merged.set(key, next);
  }
  return [...merged.values()];
}

/** Checks a resolved brand value the way the model will read it. */
function checkValue(token: Token, value: unknown, where: string): void {
  switch (token.type) {
    case 'color':
      colorParts(value, where);
      return;
    case 'fontFamily':
      toFontFamily(value, where);
      return;
    case 'typography':
      toTypography(value, where);
      return;
    case 'shadow':
      toShadow(value, where);
      return;
    case 'dimension':
      toPx(value, where);
      return;
    case 'duration':
      toMs(value, where);
      return;
    case 'number':
      if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`${where}: expected a number`);
      return;
    case 'cubicBezier':
      if (!Array.isArray(value) || value.length !== 4 || !value.every((n) => typeof n === 'number')) throw new Error(`${where}: expected [x1, y1, x2, y2]`);
      if (![value[0], value[2]].every((x) => x !== undefined && x >= 0 && x <= 1)) throw new Error(`${where}: x1 and x2 must be within 0–1`);
      return;
    default:
      throw new Error(`${where}: $type ${token.type} is not read here`);
  }
}

// --- colour contrast (WCAG 2) ---

type Rgba = [number, number, number, number];

function rgba(css: string): Rgba {
  const hex = /^#([0-9a-f]{6})$/i.exec(css)?.[1];
  if (hex !== undefined) {
    const n = parseInt(hex, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 1];
  }
  const m = /^rgba\((\d+), (\d+), (\d+), ([\d.]+)\)$/.exec(css);
  if (m) return [Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4])];
  throw new Error(`can't read colour ${css}`);
}

/** `top` laid over an opaque `bottom`. */
function over(top: Rgba, bottom: Rgba): Rgba {
  const a = top[3];
  return [top[0] * a + bottom[0] * (1 - a), top[1] * a + bottom[1] * (1 - a), top[2] * a + bottom[2] * (1 - a), 1];
}

function luminance([r, g, b]: Rgba): number {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** WCAG contrast of `fg` on `bg` in one palette; translucent colours are composited on the canvas. */
export function contrastRatio(palette: Record<string, string>, fg: string, bg: string, scheme: 'light' | 'dark'): number {
  const canvas: Rgba = scheme === 'dark' ? [0, 0, 0, 1] : [255, 255, 255, 1];
  const background = over(rgba(palette.background ?? '#ffffff'), canvas);
  const under = bg === 'background' ? background : over(rgba(palette[bg] ?? '#ffffff'), background);
  const top = over(rgba(palette[fg] ?? '#000000'), under);
  const [hi, lo] = [luminance(top), luminance(under)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

/** [foreground, background, minimum ratio] pairs the validator checks per scheme. */
export const CONTRAST_PAIRS: ReadonlyArray<readonly [string, string, number]> = [
  ['foreground', 'background', 4.5],
  ['card-foreground', 'card', 4.5],
  ['primary-foreground', 'primary', 4.5],
  ['secondary-foreground', 'secondary', 4.5],
  ['accent-foreground', 'accent', 4.5],
  ['destructive-foreground', 'destructive', 4.5],
  ['inverse-foreground', 'inverse', 4.5],
  ['muted-foreground', 'background', 3],
  ['muted-foreground', 'card', 3],
  ['foreground-soft', 'background', 3],
  ['primary', 'background', 3],
  ['border', 'background', 1.5],
];

const kebabType = (role: string) => TYPE_ROLES.find((r) => camel(r) === role) ?? role;
const em = (px: number, size: number) => Math.round((px / size) * 1000) / 1000;

/** The semantic rules (plan A2.6) on a resolved model. */
function checkRules(model: TokenModel, kitModel: TokenModel, meta: BrandMeta, raw: Map<string, Token>, problems: BrandProblem[]): void {
  // Colour contrast, on the schemes the template shows.
  const schemes = meta.scheme === 'system' ? (['light', 'dark'] as const) : ([meta.scheme] as const);
  for (const scheme of schemes) {
    const palette = model.colors[scheme] ?? {};
    const kitPalette = kitModel.colors[scheme] ?? {};
    for (const [fg, bg, min] of CONTRAST_PAIRS) {
      const ratio = contrastRatio(palette, fg, bg, scheme);
      if (ratio >= min) continue;
      // The kit's own pair, untouched: same colours and the same ratio (a new
      // background only matters when it shows through a translucent colour).
      const kitOwned =
        palette[fg] === kitPalette[fg] && palette[bg] === kitPalette[bg] && Math.abs(ratio - contrastRatio(kitPalette, fg, bg, scheme)) < 1e-9;
      const text = `${fg} on ${bg} is ${ratio.toFixed(2)}:1, needs ${min}:1`;
      problems.push(kitOwned ? warning(scheme, `${text} (kit default; override one of them to fix)`) : error(scheme, text));
    }
  }

  // Type scale.
  const t = model.type;
  const size = (role: string) => t[role]?.fontSize ?? 0;
  const order: Array<[string, string, boolean]> = [
    ['display', 'headline', true],
    ['headline', 'title', true],
    ['title', 'body', true],
    ['body', 'bodySm', false],
    ['bodySm', 'label', false],
    ['label', 'caps', false],
  ];
  for (const [big, small, strict] of order) {
    const ok = strict ? size(big) > size(small) : size(big) >= size(small);
    if (!ok) {
      problems.push(error('type', `${kebabType(big)} (${size(big)}px) must be ${strict ? 'larger than' : 'at least'} ${kebabType(small)} (${size(small)}px)`));
    }
  }
  if (size('body') < 14 || size('body') > 17) problems.push(error('type.body', `fontSize ${size('body')}px is outside 14–17px`));
  for (const [role, style] of Object.entries(t)) {
    const at = `type.${kebabType(role)}`;
    if (style.lineHeight < 1 || style.lineHeight > 1.6) problems.push(error(at, `lineHeight ${style.lineHeight} is outside 1.0–1.6`));
    const tracking = em(style.letterSpacing, style.fontSize);
    if (tracking < -0.05 || tracking > 0.12) problems.push(error(at, `letterSpacing ${tracking}em is outside -0.05em to 0.12em`));
    if (role === 'caps' && tracking < 0.04) problems.push(error(at, `letterSpacing ${tracking}em must be at least 0.04em: caps need tracking`));
    if (style.fontSize < 11) problems.push(warning(at, `fontSize ${style.fontSize}px is below 11px`));
  }

  // Font stacks: every font.* role, and type roles that spell their own stack.
  const stacks: Array<[string, string[]]> = Object.entries(model.font).map(([role, f]) => [`font.${role}`, f.family]);
  for (const [role, style] of Object.entries(t)) {
    const path = `type.${kebabType(role)}`;
    const value = raw.get(path)?.value;
    if (aliasTarget(value) === undefined && isObject(value) && aliasTarget(value.fontFamily) === undefined) stacks.push([path, style.fontFamily]);
  }
  for (const [at, stack] of stacks) {
    const last = stack[stack.length - 1] ?? '';
    if (!(GENERIC_FONT_FAMILIES as readonly string[]).includes(last)) {
      problems.push(error(at, `the stack must end with a generic family (${GENERIC_FONT_FAMILIES.join(', ')}); it ends with "${last}"`));
    }
    for (const family of stack) {
      if (!(SYSTEM_FONT_FAMILIES as readonly string[]).includes(family)) {
        problems.push(error(at, `"${family}" can't load: hosts load no web fonts yet, so v0.1 allows ${SYSTEM_FONT_FAMILIES.join(', ')}`));
      }
    }
  }

  // Shape: aliases of the radius scale only.
  for (const role of SHAPE_ROLES) {
    const path = `shape.${role}`;
    const target = aliasTarget(raw.get(path)?.value);
    const step = target?.startsWith('radius.') ? target.slice('radius.'.length) : undefined;
    if (step === undefined || !(step in model.radius)) {
      problems.push(error(path, `must alias the radius scale, e.g. "{radius.2xl}" (steps: ${Object.keys(model.radius).join(', ')})`));
    }
  }
  const shape = model.shape;
  if ((shape.cardInner ?? 0) > (shape.card ?? 0)) {
    problems.push(error('shape.card-inner', `${shape.cardInner}px must not be rounder than shape.card (${shape.card}px)`));
  }
  const md = model.radius.md ?? 0;
  if ((shape.chip ?? 0) < md) problems.push(error('shape.chip', `${shape.chip}px must be at least radius.md (${md}px)`));

  // Elevation.
  const alphaLimit = meta.scheme === 'dark' ? 0.6 : 0.3;
  let previous: { level: string; alpha: number } | undefined;
  for (const level of ELEVATION_LEVELS) {
    const e = model.elevation[level];
    if (!e) continue;
    const at = `elevation.${level}`;
    e.layers.forEach((layer, i) => {
      const where = e.layers.length > 1 ? `${at}[${i}]` : at;
      if (layer.alpha > alphaLimit) {
        problems.push(error(where, `shadow alpha ${layer.alpha} is above ${alphaLimit}${meta.scheme === 'dark' ? '' : ' (0.6 when scheme is "dark")'}`));
      }
      if (layer.blur > 32) problems.push(error(where, `blur ${layer.blur}px is above 32px`));
      if (layer.offsetY > 16) problems.push(error(where, `offsetY ${layer.offsetY}px is above 16px`));
      if (layer.spread !== 0) problems.push(warning(where, 'spread is not drawn by React Native'));
    });
    if (e.layers.length > 1) problems.push(warning(at, `React Native draws only the first of ${e.layers.length} layers`));
    const alpha = e.layers[0]?.alpha ?? 0;
    if (previous && alpha < previous.alpha) {
      problems.push(error(at, `alpha ${alpha} is lower than elevation.${previous.level} (${previous.alpha}): shadows must not fade as the level rises`));
    }
    previous = { level, alpha };
  }

  // Motion.
  const d = model.duration;
  const ranges: Array<[string, number, number]> = [
    ['fast', 100, 180],
    ['normal', 180, 300],
    ['slow', 300, 500],
  ];
  for (const [name, lo, hi] of ranges) {
    const ms = d[name];
    if (ms !== undefined && (ms < lo || ms > hi)) problems.push(error(`duration.${name}`, `${ms}ms is outside ${lo}–${hi}ms`));
  }
  if (!((d.fast ?? 0) < (d.normal ?? 0) && (d.normal ?? 0) < (d.slow ?? 0))) {
    problems.push(error('duration', `fast (${d.fast}ms) < normal (${d.normal}ms) < slow (${d.slow}ms) must hold`));
  }

  // Interaction profile.
  const { press, reveal, skeleton } = model.interaction;
  if (press.activeScale < 0.9 || press.activeScale > 1) problems.push(error('interaction.press.active-scale', `${press.activeScale} is outside 0.9–1`));
  if (press.hitSlop < 0 || press.hitSlop > 12) problems.push(error('interaction.press.hit-slop', `${press.hitSlop}px is outside 0–12px`));
  if (reveal.stagger < 0 || reveal.stagger > 80) problems.push(error('interaction.reveal.stagger', `${reveal.stagger}ms is outside 0–80ms`));
  for (const [key, value] of [
    ['min-opacity', skeleton.minOpacity],
    ['reduced-opacity', skeleton.reducedOpacity],
  ] as const) {
    if (value < 0 || value > 1) problems.push(error(`interaction.skeleton.${key}`, `${value} is outside 0–1`));
  }

  // Layout.
  const { gutter, tabBarHeight } = model.layout;
  if (![16, 20, 24].includes(gutter)) problems.push(error('layout.gutter', `${gutter}px must be 16, 20 or 24`));
  if (tabBarHeight < 56 || tabBarHeight > 88 || tabBarHeight % 4 !== 0) {
    problems.push(error('layout.tab-bar-height', `${tabBarHeight}px must be 56–88 and a multiple of 4`));
  }
}

/** Kit sources as flattened tokens. Throws if the kit itself is broken. */
function kitTokens(kit: TokenSources): Record<Scope, Token[]> {
  return { base: flatten(kit.base), light: flatten(kit.schemes.light), dark: flatten(kit.schemes.dark) };
}

/**
 * Merges a brand over the kit, resolves it and checks every rule. Never
 * throws for brand content: problems come back as errors and warnings, and
 * `brand` is set only when there are no errors.
 */
export function validateBrand(layers: BrandLayers, kit: TokenSources): BrandReport {
  const problems: BrandProblem[] = [];
  const kitModel = buildModel(kit);
  const colorNames = Object.keys(kitModel.colors.light ?? {});
  const meta = readMeta(layers, colorNames, problems);

  // 1. Structure: closed keys, $type per group, extensions.
  const entries: Record<Scope, Map<string, Entry>> = { base: new Map(), light: new Map(), dark: new Map() };
  const add = (source: BrandSource, kind: 'set' | 'light' | 'dark') => {
    for (const { scope, token } of readDocument(source, kind, kitModel, problems)) entries[scope].set(token.path.join('.'), { token, file: source.file });
  };
  for (const s of layers.sets) add(s, 'set');
  for (const s of layers.light) add(s, 'light');
  for (const s of layers.dark) add(s, 'dark');

  // A dark file must restate every role the light colours set.
  const lightRoles = [...entries.light.keys()];
  if (layers.dark.length > 0) {
    const missing = lightRoles.filter((key) => !entries.dark.has(key)).map((key) => key.slice('color.'.length));
    if (missing.length) {
      problems.push(error('dark', `${layers.dark.map((s) => s.file).join(', ')} must set every role the light colours set; missing ${missing.join(', ')}`));
    }
  } else if (lightRoles.length > 0 && meta.scheme === 'system') {
    problems.push(warning('dark', 'no dark colours: the dark scheme keeps the kit palette while light uses the brand (add a .dark.tokens.json, or set scheme "light")'));
  } else if (lightRoles.length > 0 && meta.scheme === 'dark') {
    problems.push(warning('light', 'scheme is "dark", so the light colours are never shown; put them in the .dark.tokens.json file'));
  }

  // 2. Aliases, then values, per brand token; a broken one falls back to the kit.
  const kitT = kitTokens(kit);
  const scopes: Scope[] = ['base', 'light', 'dark'];
  // Colour tokens resolve within their scheme; base tokens among base tokens.
  for (const scope of scopes) {
    const fromBrand = new WeakSet<Token>();
    const merged = merge(kitT[scope], entries[scope], fromBrand);
    const broken = new Set<string>();
    resolveAliases(merged, (token, e) => {
      const key = token.path.join('.');
      const own = e.path === key || (e.cycle?.includes(key) ?? false);
      if (!fromBrand.has(token) || !own || broken.has(key)) return;
      broken.add(key);
      problems.push(error(key, `${e.message} (${entries[scope].get(key)?.file ?? 'brand'})`));
    });
    for (const key of broken) entries[scope].delete(key);
    let resolved: Map<string, Token>;
    try {
      resolved = new Map(resolveAliases(merge(kitT[scope], entries[scope], new WeakSet())).map((t) => [t.path.join('.'), t]));
    } catch (e) {
      problems.push(error(scope, message(e)));
      continue;
    }
    for (const [key, entry] of [...entries[scope]]) {
      try {
        checkValue(entry.token, resolved.get(key)?.value, key);
      } catch (e) {
        problems.push(error(key, `${message(e).replace(`${key}: `, '').replace(new RegExp(`^${key.replace(/\./g, '\\.')}\\.`), '')} (${entry.file})`));
        entries[scope].delete(key);
      }
    }
  }

  // 3. The model, then the rules.
  const fromBrand = new WeakSet<Token>();
  const base = merge(kitT.base, entries.base, fromBrand);
  let model: TokenModel | undefined;
  try {
    model = buildModelFromTokens({
      base,
      schemes: { light: merge(kitT.light, entries.light, fromBrand), dark: merge(kitT.dark, entries.dark, fromBrand) },
    });
  } catch (e) {
    problems.push(error('brand', message(e)));
  }
  if (model) {
    model.interaction.press.haptic = meta.haptic;
    model.interaction.skeleton = { ...model.interaction.skeleton, ...meta.skeleton };
    checkRules(model, kitModel, meta, new Map(base.map((t) => [t.path.join('.'), t])), problems);
  }

  const errors = problems.filter((p) => p.level === 'error');
  const warnings = problems.filter((p) => p.level === 'warning');
  if (errors.length || !model) return { errors, warnings };
  return {
    errors,
    warnings,
    brand: {
      meta,
      colors: { light: { ...model.colors.light }, dark: { ...model.colors.dark } },
      duration: { ...model.duration },
      easing: { ...model.easing },
      sys: sysTokens(model),
      model,
      warnings,
      sources: [...layers.sets, ...layers.light, ...layers.dark],
    },
  };
}

/** `validateBrand`, throwing a BrandError that lists every problem when there is an error. */
export function resolveBrand(layers: BrandLayers, kit: TokenSources): ResolvedBrand {
  const report = validateBrand(layers, kit);
  if (!report.brand) throw new BrandError([...report.errors, ...report.warnings]);
  return report.brand;
}

// Tooling entry (`@fluxnative/tokens/brand`): the sys emitters ride along.
export { emitSysTs, sysTokens, type EmitSysOptions, type ElevationStyleValue, type SysTokens, type TypeStyleValue } from './sys.ts';
