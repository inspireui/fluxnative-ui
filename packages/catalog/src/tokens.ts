// Emits a template's `theme/tokens.ts`: the @fluxnative/tokens constants in
// a closed shape, with a template's colour overrides or brand applied. The
// file imports nothing, so FluxBuilder's Sucrase runtime and FluxNative's
// strict tsc both take it as-is.

import { existsSync, readFileSync, statSync } from 'node:fs';
import {
  chrome,
  colors,
  duration,
  easing,
  emitSysTs,
  fontWeight,
  glass,
  radius,
  readBrandFiles,
  resolveBrand,
  spacingUnit,
  text,
  type ResolvedBrand,
  type SysTokens,
  type TokenSources,
} from '@fluxnative/tokens';
// The sys constants by namespace: one of them is called `type`.
import * as kit from '@fluxnative/tokens';

/** The kit's own sys sections, as `@fluxnative/tokens` generated them. */
const KIT_SYS: SysTokens = {
  font: kit.font,
  type: kit.type,
  shape: kit.shape,
  elevation: kit.elevation,
  interaction: kit.interaction,
  layout: kit.layout,
};

/** The kit's DTCG sources, which a brand is merged over. */
export function kitSources(): TokenSources {
  const read = (name: string): unknown =>
    JSON.parse(readFileSync(new URL(import.meta.resolve(`@fluxnative/tokens/tokens/${name}`)), 'utf8'));
  return {
    base: read('base.tokens.json'),
    schemes: { light: read('color.light.tokens.json'), dark: read('color.dark.tokens.json') },
  };
}

/**
 * Reads and resolves a brand: a `brand.tokens.json` (with its optional
 * `brand.dark.tokens.json`), a `*.resolver.json`, or a folder holding one.
 * Throws a BrandError listing every error; warnings are on the result.
 */
export function loadBrand(path: string): ResolvedBrand {
  const readText = (file: string) => (existsSync(file) && statSync(file).isFile() ? readFileSync(file, 'utf8') : undefined);
  return resolveBrand(readBrandFiles(path, { readText }), kitSources());
}

export type SchemeName = 'light' | 'dark';

export interface ColorOverrides {
  /** The scheme the template is designed for. `system` (default) follows the OS. */
  scheme?: SchemeName | 'system';
  light?: Record<string, string>;
  dark?: Record<string, string>;
}

const COLOR_VALUE = /^(#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})|rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*(,\s*[\d.]+\s*)?\)|transparent)$/i;

/** Tailwind's spacing steps; the value is the step × spacingUnit. */
const SPACE_STEPS = [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 16, 20, 24, 28, 32, 36, 40];

export const COLOR_NAMES = Object.keys(colors.light);

/** Throws with every problem listed when the overrides don't fit the token model. */
export function validateOverrides(overrides: unknown, where = 'colors'): ColorOverrides {
  const problems: string[] = [];
  if (overrides === null || typeof overrides !== 'object' || Array.isArray(overrides)) {
    throw new Error(`${where}: expected an object with optional "scheme", "light" and "dark"`);
  }
  const o = overrides as Record<string, unknown>;
  for (const key of Object.keys(o)) {
    if (!['scheme', 'light', 'dark', '$schema', '$comment'].includes(key)) problems.push(`unknown key "${key}"`);
  }
  if (o.scheme !== undefined && !['light', 'dark', 'system'].includes(String(o.scheme))) {
    problems.push(`scheme must be "light", "dark" or "system" (got ${JSON.stringify(o.scheme)})`);
  }
  for (const scheme of ['light', 'dark'] as const) {
    const map = o[scheme];
    if (map === undefined) continue;
    if (map === null || typeof map !== 'object' || Array.isArray(map)) {
      problems.push(`${scheme}: expected an object of color name → value`);
      continue;
    }
    for (const [name, value] of Object.entries(map as Record<string, unknown>)) {
      if (!COLOR_NAMES.includes(name)) problems.push(`${scheme}.${name}: not a token color (known: ${COLOR_NAMES.join(', ')})`);
      if (typeof value !== 'string' || !COLOR_VALUE.test(value.trim())) {
        problems.push(`${scheme}.${name}: expected #rgb, #rrggbb, #rrggbbaa, rgb(), rgba() or transparent (got ${JSON.stringify(value)})`);
      }
    }
  }
  if (problems.length) throw new Error(`${where}:\n  ${problems.join('\n  ')}`);
  return o as ColorOverrides;
}

export function resolveColors(overrides: ColorOverrides = {}): Record<SchemeName, Record<string, string>> {
  const out: Record<SchemeName, Record<string, string>> = { light: {}, dark: {} };
  for (const scheme of ['light', 'dark'] as const) {
    const base: Record<string, string> = { ...colors[scheme] };
    const over = overrides[scheme] ?? {};
    for (const name of COLOR_NAMES) out[scheme][name] = (over[name] ?? base[name] ?? '').trim();
  }
  return out;
}

const literal = (value: unknown) => JSON.stringify(value, null, 2);

function describeColors(descriptions: Record<string, string>): string {
  return COLOR_NAMES.map((name) => {
    const doc = descriptions[name];
    return doc ? `  /** ${doc} */\n  | '${name}'` : `  | '${name}'`;
  }).join('\n');
}

export interface EmitTokensOptions {
  overrides?: ColorOverrides;
  /** Shown in the header so a reader knows where the colours (or the brand) came from. */
  overridesLabel?: string;
  /** JSDoc per colour name, from the token source. */
  colorDescriptions?: Record<string, string>;
  /** A resolved brand (`loadBrand`): colours, scheme, motion and the sys groups. Not with `overrides`. */
  brand?: ResolvedBrand;
}

/** A brand's palettes in the kit's colour order. */
function brandColors(brand: ResolvedBrand): Record<SchemeName, Record<string, string>> {
  const out: Record<SchemeName, Record<string, string>> = { light: {}, dark: {} };
  for (const scheme of ['light', 'dark'] as const) {
    for (const name of COLOR_NAMES) out[scheme][name] = brand.colors[scheme][name] ?? colors[scheme][name as keyof (typeof colors)['light']];
  }
  return out;
}

export function emitTokens({ overrides = {}, overridesLabel, colorDescriptions = {}, brand }: EmitTokensOptions = {}): string {
  if (brand && Object.keys(overrides).length > 0) throw new Error('emitTokens: pass colour overrides or a brand, not both');
  const resolved = brand ? brandColors(brand) : resolveColors(overrides);
  const scheme = brand ? brand.meta.scheme : (overrides.scheme ?? 'system');
  const space = Object.fromEntries(SPACE_STEPS.map((step) => [step, step * spacingUnit]));
  const weights = Object.fromEntries(Object.entries(fontWeight).map(([k, v]) => [k, String(v)]));
  const source = brand
    ? `Brand: ${overridesLabel ?? 'given'}`
    : `Colour overrides: ${overridesLabel ?? 'none'}`;
  return `// Generated by @fluxnative/catalog from @fluxnative/tokens — do not edit by hand.
// ${source}. Regenerate with \`fluxnative-catalog emit\`.

export type ColorScheme = 'light' | 'dark';

/** Semantic colour names. Screens use these, never a raw hex, so a palette swap is one file. */
export type ColorName =
${describeColors(colorDescriptions)};

export type Palette = { readonly [K in ColorName]: string };

export const colors: { readonly [S in ColorScheme]: Palette } = ${literal(resolved)};

/** The scheme this template is designed for; \`null\` follows the system setting. */
export const lockedScheme: ColorScheme | null = ${scheme === 'system' ? 'null' : `'${scheme}'`};

/** One spacing step in px (\`space[4]\` is four units). */
export const spacingUnit = ${spacingUnit};

/** Tailwind's spacing scale in px: \`space[4]\` = 16, \`space[0.5]\` = 2. */
export const space = ${literal(space)} as const;
export type SpaceStep = keyof typeof space;

export const radius = ${literal(radius)} as const;
export type RadiusName = keyof typeof radius;

/** Font size and line height in px; the system font carries the voice. */
export const text = ${literal(text)} as const;
export type TextSize = keyof typeof text;

/** React Native takes font weights as strings. */
export const fontWeight = ${literal(weights)} as const;
export type FontWeightName = keyof typeof fontWeight;

/** Milliseconds. */
export const duration = ${literal(brand?.duration ?? duration)} as const;

/** Cubic-bezier control points (x1, y1, x2, y2) for \`Easing.bezier\`. */
export const easing = ${literal(brand?.easing ?? easing)} as const;

/** Glass ladder parameters, for templates that declare the \`glass\` capability. */
export const glass = ${literal(glass)} as const;

/** Navigation chrome metrics. */
export const chrome = ${literal(chrome)} as const;
${emitSysTs(brand?.sys ?? KIT_SYS, { density: brand?.meta.density ?? 'regular' })}`;
}
