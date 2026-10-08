// `flux/glass` for a web host (the fluxbuilder-template dashboard on
// react-native-web): the web side of the glass host contract in
// `@fluxnative/glass` (src/contract.ts). It mirrors `@fluxnative/glass` so a
// template written against the library compiles here unchanged. The web
// ladder has three reachable tiers: blur (backdrop-filter), translucent (no
// backdrop-filter support) and opaque (prefers-reduced-transparency or
// prefers-contrast: more). Native tiers belong to the Expo host.
//
// This file is vendored into hosts as-is. The palette block below is
// generated from the tokens; everything else is hand-written.

import { createContext, useContext, useSyncExternalStore, type ComponentType, type ReactNode } from 'react';
import * as RN from 'react-native';

// react-native may resolve to react-native-web, which ships no types. Type
// the four members used here, once.
type ViewStyle = Record<string, unknown>;
type StyleProp<T> = T | null | undefined | false | ReadonlyArray<StyleProp<T>>;
const { StyleSheet, View, useColorScheme } = RN as unknown as {
  StyleSheet: { absoluteFill: ViewStyle; hairlineWidth: number; create<T extends Record<string, ViewStyle>>(styles: T): T };
  View: ComponentType<{ style?: StyleProp<ViewStyle>; pointerEvents?: GlassSurfaceProps['pointerEvents']; children?: ReactNode }>;
  useColorScheme: () => 'light' | 'dark' | null | undefined;
};

export type GlassTier = 'native-bar' | 'native-glass' | 'blur' | 'translucent' | 'opaque';
export type GlassRole = 'bar' | 'surface';
export type GlassVariant = 'regular' | 'clear';

export interface GlassSurfaceProps {
  children?: ReactNode;
  role?: GlassRole;
  /** `clear` only over photos or video. */
  variant?: GlassVariant;
  /** A palette color value that tints the glass. */
  tint?: string;
  /** Touch response on native glass; ignored on the web. */
  interactive?: boolean;
  radius?: number;
  style?: StyleProp<ViewStyle>;
  /** Force a tier. For tests and screenshots only. */
  tier?: GlassTier;
  pointerEvents?: 'auto' | 'none' | 'box-none' | 'box-only';
}

export interface GlassGroupProps {
  children?: ReactNode;
  spacing?: number;
  style?: StyleProp<ViewStyle>;
}

// fluxnative-glass-palette:start
// Generated from @fluxnative/tokens by `pnpm tokens` (contract v1) — do not edit by hand.
const PALETTE = {
  light: {
    fill: 'rgba(255, 255, 255, 0.72)',
    blurFill: 'rgba(255, 255, 255, 0.5)',
    border: 'rgba(255, 255, 255, 0.6)',
    highlight: 'rgba(255, 255, 255, 0.55)',
    opaque: '#f9f9f9',
    opaqueBorder: 'rgba(60, 60, 67, 0.18)',
  },
  dark: {
    fill: 'rgba(30, 30, 32, 0.72)',
    blurFill: 'rgba(30, 30, 32, 0.45)',
    border: 'rgba(255, 255, 255, 0.14)',
    highlight: 'rgba(255, 255, 255, 0.16)',
    opaque: '#1c1c1e',
    opaqueBorder: 'rgba(84, 84, 88, 0.6)',
  },
} as const;
const BLUR = { radius: 24, saturate: 1.8 } as const;
const LOOK = { tintAlpha: { blur: 0.18, translucent: 0.14 }, sheenOpacity: { light: 0.16, dark: 0.08 } } as const;
// fluxnative-glass-palette:end
const FILTER = `blur(${BLUR.radius}px) saturate(${Math.round(BLUR.saturate * 100)}%)`;

interface Env {
  blur: boolean;
  reduceTransparency: boolean;
  increaseContrast: boolean;
}

const QUERIES = {
  reduceTransparency: '(prefers-reduced-transparency: reduce)',
  increaseContrast: '(prefers-contrast: more)',
} as const;

function read(): Env {
  const media = (q: string) => typeof window !== 'undefined' && !!window.matchMedia?.(q).matches;
  const supports = (v: string) => typeof CSS !== 'undefined' && CSS.supports?.(v, 'blur(1px)');
  return {
    blur: !!(supports('backdrop-filter') || supports('-webkit-backdrop-filter')),
    reduceTransparency: media(QUERIES.reduceTransparency),
    increaseContrast: media(QUERIES.increaseContrast),
  };
}

let env = read();

function subscribe(listener: () => void) {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {};
  const lists = Object.values(QUERIES).map((q) => window.matchMedia(q));
  const onChange = () => {
    env = read();
    listener();
  };
  lists.forEach((l) => l.addEventListener('change', onChange));
  return () => lists.forEach((l) => l.removeEventListener('change', onChange));
}

export function useGlassTier(_role: GlassRole = 'surface', forced?: GlassTier): GlassTier {
  const current = useSyncExternalStore(subscribe, () => env, () => env);
  if (forced) return forced;
  // No native bars on the web: a `bar` resolves like any surface.
  if (current.increaseContrast || current.reduceTransparency) return 'opaque';
  return current.blur ? 'blur' : 'translucent';
}

const HEX = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const RGB = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*[\d.]+\s*)?\)$/i;

function withAlpha(color: string, alpha: number): string {
  const hex = HEX.exec(color)?.[1];
  if (hex) {
    const digits = hex.length <= 4 ? [...hex].map((c) => c + c).join('') : hex;
    const n = parseInt(digits.slice(0, 6), 16);
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
  }
  const rgb = RGB.exec(color);
  if (rgb) return `rgba(${rgb[1]}, ${rgb[2]}, ${rgb[3]}, ${alpha})`;
  return color;
}

export function GlassSurface({
  children,
  role = 'surface',
  variant = 'regular',
  tint,
  radius = 0,
  style,
  tier: forced,
  pointerEvents,
}: GlassSurfaceProps) {
  const tier = useGlassTier(role, forced);
  const dark = useColorScheme() === 'dark';
  const p = PALETTE[dark ? 'dark' : 'light'];
  const shape: ViewStyle = { borderRadius: radius };

  if (tier === 'opaque') {
    return (
      <View
        style={[shape, styles.rim, { backgroundColor: p.opaque, borderColor: p.opaqueBorder }, style]}
        pointerEvents={pointerEvents}
      >
        {children}
      </View>
    );
  }

  // Web has no native glass; native tiers forced here render as blur.
  const blurred = tier !== 'translucent';
  const fill = blurred ? (variant === 'clear' ? 'transparent' : p.blurFill) : p.fill;
  const backdrop = blurred
    ? ({ backdropFilter: FILTER, WebkitBackdropFilter: FILTER } as unknown as ViewStyle)
    : null;
  const tintAlpha = blurred ? LOOK.tintAlpha.blur : LOOK.tintAlpha.translucent;

  return (
    <View style={[styles.clip, shape, style]} pointerEvents={pointerEvents}>
      <View style={[StyleSheet.absoluteFill, backdrop, { backgroundColor: fill }]} />
      {tint ? <View style={[StyleSheet.absoluteFill, { backgroundColor: withAlpha(tint, tintAlpha) }]} /> : null}
      {blurred ? null : (
        <View
          style={[styles.sheen, { backgroundColor: p.highlight, opacity: dark ? LOOK.sheenOpacity.dark : LOOK.sheenOpacity.light }]}
          pointerEvents="none"
        />
      )}
      <View style={[StyleSheet.absoluteFill, shape, styles.rim, { borderColor: p.border }]} pointerEvents="none" />
      {children}
    </View>
  );
}

const InGroup = createContext(false);

/** Groups neighbouring glass. Native hosts merge it; the web lays it out. */
export function GlassGroup({ children, style }: GlassGroupProps) {
  const nested = useContext(InGroup);
  const body = <View style={style}>{children}</View>;
  return nested ? body : <InGroup.Provider value>{body}</InGroup.Provider>;
}

const styles = StyleSheet.create({
  clip: { overflow: 'hidden' },
  rim: { borderWidth: StyleSheet.hairlineWidth },
  sheen: { position: 'absolute', top: 0, left: 0, right: 0, height: '50%' },
});
