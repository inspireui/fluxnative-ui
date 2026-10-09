// The sys token groups (font, type, shape, elevation, interaction, layout)
// as React Native style data, and the TypeScript that declares them.
// `generated/tokens.ts` and a Flux template's `theme/tokens.ts` append the
// same sections, so code reads them the same way in both places. The text
// imports nothing: it relies only on `fontWeight`, `FontWeightName` and
// `ColorName`, which both files declare above it.

import { DENSITIES, FONT_VARIANTS, HAPTICS, SKELETON_MODES, type Density, type InteractionProfile, type TokenModel } from './model.ts';

/** One text role as React Native text style props. */
export interface TypeStyleValue {
  /** Set only for a named family; the generic `System` is the platform font, so it stays unset. */
  fontFamily?: string;
  fontSize: number;
  /** px, rounded. */
  lineHeight: number;
  /** React Native takes font weights as strings. */
  fontWeight: string;
  /** px */
  letterSpacing: number;
  fontVariant?: readonly string[];
}

/** One elevation level as React Native view style props. */
export interface ElevationStyleValue {
  shadowColor: string;
  shadowOpacity: number;
  shadowRadius: number;
  shadowOffset: { width: number; height: number };
  /** Android draws this instead of the `shadow*` props. */
  elevation: number;
}

export interface SysTokens {
  font: Record<string, readonly string[]>;
  type: Record<string, TypeStyleValue>;
  shape: Record<string, number>;
  elevation: Record<string, ElevationStyleValue>;
  interaction: InteractionProfile;
  layout: { gutter: number; safeTop: number; tabBarHeight: number };
}

/** The generic family React Native resolves to the platform font without a name. */
const PLATFORM_FONT = 'System';

const round = (n: number) => Math.round(n * 1000) / 1000;

/** The sys groups of a model, converted to what a React Native style takes. */
export function sysTokens(model: TokenModel): SysTokens {
  const type = Object.fromEntries(
    Object.entries(model.type).map(([role, t]) => {
      const style: Partial<TypeStyleValue> = {};
      const first = t.fontFamily[0];
      if (first !== undefined && first !== PLATFORM_FONT) style.fontFamily = first;
      style.fontSize = t.fontSize;
      style.lineHeight = Math.round(t.fontSize * t.lineHeight);
      style.fontWeight = String(t.fontWeight);
      style.letterSpacing = round(t.letterSpacing);
      if (t.fontVariant?.length) style.fontVariant = [...t.fontVariant];
      return [role, style as TypeStyleValue];
    }),
  );
  const elevation = Object.fromEntries(
    Object.entries(model.elevation).map(([level, { layers, android }]) => {
      // React Native's shadow props draw one layer: the first.
      const layer = layers[0];
      const style: ElevationStyleValue = {
        shadowColor: layer?.color ?? '#000000',
        shadowOpacity: layer?.alpha ?? 0,
        shadowRadius: layer?.blur ?? 0,
        shadowOffset: { width: layer?.offsetX ?? 0, height: layer?.offsetY ?? 0 },
        elevation: android,
      };
      return [level, style];
    }),
  );
  const { press, reveal, skeleton } = model.interaction;
  return {
    font: Object.fromEntries(Object.entries(model.font).map(([role, stack]) => [role, [...stack.family]])),
    type,
    shape: { ...model.shape },
    elevation,
    interaction: { press: { ...press, spring: { ...press.spring } }, reveal: { ...reveal }, skeleton: { ...skeleton } },
    layout: { ...model.layout },
  };
}

const literal = (value: unknown) => JSON.stringify(value, null, 2);
const union = (values: readonly string[]) => values.map((v) => `'${v}'`).join(' | ');
/** `"2": {` → `2: {` at the top level, so `keyof typeof elevation` is `0 | 1 | …`. */
const numericKeys = (text: string) => text.replace(/^ {2}"(\d+)":/gm, '  $1:');

export interface EmitSysOptions {
  /** Also declare `density` (a template's theme file does; the kit has no density of its own). */
  density?: Density;
}

/** The TypeScript for the sys sections, appended after `chrome`. Starts with a blank line. */
export function emitSysTs(sys: SysTokens, { density }: EmitSysOptions = {}): string {
  const densityBlock =
    density === undefined
      ? ''
      : `
export type Density = ${union(DENSITIES)};

/** The row and control density this template is designed for. */
export const density: Density = '${density}';
`;
  return `
/** Font stack per role, first choice first; the last entry is a generic family. */
export const font = ${literal(sys.font)} as const;
export type FontRole = keyof typeof font;

export type TypeRole = ${union(Object.keys(sys.type))};

/** A text role as Text style props in px. \`fontFamily\` is set only for a named family (\`System\` is the platform font). */
export interface TypeStyle {
  readonly fontFamily?: string;
  readonly fontSize: number;
  readonly lineHeight: number;
  readonly fontWeight: (typeof fontWeight)[FontWeightName];
  readonly letterSpacing: number;
  readonly fontVariant?: Array<${union(FONT_VARIANTS)}>;
}

/** Text roles: \`<Text style={[type.body, { color: palette.foreground }]}>\`. Prefer these to \`text\` sizes. */
export const type: { readonly [R in TypeRole]: TypeStyle } = ${literal(sys.type)};

/** Corner radius per surface role, in px. Prefer these to \`radius\` steps. */
export const shape = ${literal(sys.shape)} as const;
export type ShapeRole = keyof typeof shape;

/** Shadow per level as View style props: iOS and web draw \`shadow*\`, Android draws \`elevation\`. */
export const elevation = ${numericKeys(literal(sys.elevation))} as const;
export type ElevationLevel = keyof typeof elevation;

export type Haptic = ${union(HAPTICS)};
export type SkeletonMode = ${union(SKELETON_MODES)};

/** How the primitives behave by default: press feedback, entrances, loading placeholders (ms and px). */
export interface InteractionProfile {
  readonly press: {
    readonly haptic: Haptic;
    readonly activeScale: number;
    readonly hitSlop: number;
    readonly spring: { readonly speed: number; readonly bounciness: number };
  };
  readonly reveal: { readonly offset: number; readonly duration: number; readonly stagger: number };
  readonly skeleton: {
    readonly mode: SkeletonMode;
    readonly base: ColorName;
    readonly highlight: ColorName;
    readonly pulse: number;
    readonly minOpacity: number;
    readonly reducedOpacity: number;
  };
}

export const interaction: InteractionProfile = ${literal(sys.interaction)};

/** Screen layout metrics in px. */
export const layout = ${literal(sys.layout)} as const;
${densityBlock}`;
}
