// `flux/glass` for the FluxNative host (Expo SDK 57, React Native 0.86): the
// native side of the glass host contract in `@fluxnative/glass`
// (src/contract.ts). The FluxNative importer copies this file to
// `src/template-runtime/glass.tsx` for templates that declare the `glass`
// capability, so a template written against `@fluxnative/glass` runs there
// unchanged. Tiers: native-glass (expo-glass-effect, iOS 26+), blur
// (expo-blur on iOS, backdrop-filter on the web), translucent (Android) and
// opaque (Reduce Transparency / Increase Contrast). There is no navigator
// here that hosts bars natively, so `native-bar` is never resolved.
//
// This file is vendored into hosts as-is. The palette block below is
// generated from the tokens; everything else is hand-written. It must stay
// strict-TypeScript clean (noUncheckedIndexedAccess) with only react,
// react-native, expo-blur and expo-glass-effect as imports.

import { createContext, useContext, useSyncExternalStore, type ReactNode } from 'react';
import { AccessibilityInfo, Platform, StyleSheet, View, useColorScheme, type StyleProp, type ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { GlassContainer, GlassView, isGlassEffectAPIAvailable, isLiquidGlassAvailable } from 'expo-glass-effect';

export type GlassTier = 'native-bar' | 'native-glass' | 'blur' | 'translucent' | 'opaque';
export type GlassRole = 'bar' | 'surface';
export type GlassVariant = 'regular' | 'clear';

export interface GlassSurfaceProps {
  children?: ReactNode;
  /** `bar` lets a navigator host it natively; everything else is `surface`. */
  role?: GlassRole;
  /** `clear` only over photos or video, with legible content on top. */
  variant?: GlassVariant;
  /** A palette color value that tints the glass. */
  tint?: string;
  /** Touch response on native glass; only for glass that is itself pressable. */
  interactive?: boolean;
  /** Corner radius in px. */
  radius?: number;
  style?: StyleProp<ViewStyle>;
  /** Force a tier. For tests and screenshots only. */
  tier?: GlassTier;
  pointerEvents?: 'auto' | 'none' | 'box-none' | 'box-only';
}

export interface GlassGroupProps {
  children?: ReactNode;
  /** Distance at which neighbouring native glass starts to merge. */
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

// --- device environment ------------------------------------------------------

interface Env {
  reduceTransparency: boolean;
  increaseContrast: boolean;
}

let env: Env = { reduceTransparency: false, increaseContrast: false };
const listeners = new Set<() => void>();
let started = false;

function set(patch: Partial<Env>) {
  const next = { ...env, ...patch };
  if (next.reduceTransparency === env.reduceTransparency && next.increaseContrast === env.increaseContrast) return;
  env = next;
  for (const listener of listeners) listener();
}

// AccessibilityInfo grew these methods across React Native releases and
// react-native-web stubs some of them, so each one is feature-checked.
type Info = typeof AccessibilityInfo & {
  isDarkerSystemColorsEnabled?: () => Promise<boolean>;
  isHighTextContrastEnabled?: () => Promise<boolean>;
};

function start() {
  if (started) return;
  started = true;
  const info = AccessibilityInfo as Info;
  const watch = (read: (() => Promise<boolean>) | undefined, event: string, key: keyof Env) => {
    if (typeof read !== 'function') return;
    read.call(info).then(
      (on) => set({ [key]: on }),
      () => {},
    );
    try {
      (info.addEventListener as (e: string, h: (on: boolean) => void) => unknown)(event, (on) => set({ [key]: on }));
    } catch {
      // Older runtimes throw on events they don't know.
    }
  };
  watch(info.isReduceTransparencyEnabled, 'reduceTransparencyChanged', 'reduceTransparency');
  if (Platform.OS === 'ios') {
    watch(info.isDarkerSystemColorsEnabled, 'darkerSystemColorsChanged', 'increaseContrast');
  } else if (Platform.OS === 'android') {
    watch(info.isHighTextContrastEnabled, 'highTextContrastChanged', 'increaseContrast');
  }
}

function subscribe(listener: () => void) {
  start();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const getSnapshot = () => env;

let liquid: boolean | undefined;
function liquidGlassAvailable(): boolean {
  // isGlassEffectAPIAvailable guards early iOS 26 betas that lack the API.
  liquid ??= Platform.OS === 'ios' && isGlassEffectAPIAvailable() && isLiquidGlassAvailable();
  return liquid;
}
// Android stays translucent: expo-blur there needs a BlurTargetView around
// the content behind the blur, which a floating surface can't own.
const blurAvailable = Platform.OS === 'ios' || Platform.OS === 'web';

/** The tier a surface with this role would get on this device. */
export function useGlassTier(_role: GlassRole = 'surface', forced?: GlassTier): GlassTier {
  const current = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  if (forced) return forced;
  if (current.reduceTransparency || current.increaseContrast) return 'opaque';
  if (liquidGlassAvailable()) return 'native-glass';
  if (blurAvailable) return 'blur';
  return 'translucent';
}

// --- drawing -----------------------------------------------------------------

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

function Blur({ dark, style }: { dark: boolean; style: StyleProp<ViewStyle> }) {
  if (Platform.OS === 'web') {
    // expo-blur's web tint turns near-opaque at the intensity a bar needs,
    // so the web draws the backdrop filter itself under a thin fill.
    const filter = `blur(${BLUR.radius}px) saturate(${Math.round(BLUR.saturate * 100)}%)`;
    const web = { backdropFilter: filter, WebkitBackdropFilter: filter } as unknown as ViewStyle;
    return <View style={[style, web, { backgroundColor: PALETTE[dark ? 'dark' : 'light'].blurFill }]} />;
  }
  return (
    <BlurView
      tint={dark ? 'systemChromeMaterialDark' : 'systemChromeMaterialLight'}
      intensity={Math.min(100, Math.round(BLUR.radius * 5))}
      style={style}
    />
  );
}

export function GlassSurface({
  children,
  role = 'surface',
  variant = 'regular',
  tint,
  interactive = false,
  radius = 0,
  style,
  tier: forced,
  pointerEvents,
}: GlassSurfaceProps) {
  const tier = useGlassTier(role, forced);
  const dark = useColorScheme() === 'dark';
  const p = PALETTE[dark ? 'dark' : 'light'];
  const shape: ViewStyle = { borderRadius: radius };

  if (tier === 'native-bar') {
    // Only a navigator draws this tier; here it is a plain layout box.
    return (
      <View style={[shape, style]} pointerEvents={pointerEvents}>
        {children}
      </View>
    );
  }

  // A forced tier the device can't draw falls through to the next one down.
  if (tier === 'native-glass' && liquidGlassAvailable()) {
    return (
      <View style={[shape, style]} pointerEvents={pointerEvents}>
        <GlassView
          // isInteractive is read once at mount; remount when it changes.
          key={interactive ? 'interactive' : 'static'}
          glassEffectStyle={variant}
          tintColor={tint}
          isInteractive={interactive}
          colorScheme={dark ? 'dark' : 'light'}
          style={[StyleSheet.absoluteFill, shape]}
        />
        {children}
      </View>
    );
  }

  if ((tier === 'blur' || tier === 'native-glass') && blurAvailable) {
    return (
      <View style={[styles.clip, shape, style]} pointerEvents={pointerEvents}>
        {/* backdrop-filter ignores the parent's rounded clip on the web. */}
        <Blur dark={dark} style={[StyleSheet.absoluteFill, shape]} />
        {tint ? <View style={[StyleSheet.absoluteFill, { backgroundColor: withAlpha(tint, LOOK.tintAlpha.blur) }]} /> : null}
        <View style={[StyleSheet.absoluteFill, shape, styles.rim, { borderColor: p.border }]} pointerEvents="none" />
        {children}
      </View>
    );
  }

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

  // translucent: also the landing spot when a tier's material is missing.
  return (
    <View style={[styles.clip, shape, style]} pointerEvents={pointerEvents}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: p.fill }]} />
      {tint ? <View style={[StyleSheet.absoluteFill, { backgroundColor: withAlpha(tint, LOOK.tintAlpha.translucent) }]} /> : null}
      <View
        style={[styles.sheen, { backgroundColor: p.highlight, opacity: dark ? LOOK.sheenOpacity.dark : LOOK.sheenOpacity.light }]}
        pointerEvents="none"
      />
      <View
        style={[styles.topLine, { marginHorizontal: radius * 0.6, backgroundColor: p.highlight }]}
        pointerEvents="none"
      />
      <View style={[StyleSheet.absoluteFill, shape, styles.rim, { borderColor: p.border }]} pointerEvents="none" />
      {children}
    </View>
  );
}

/** Nested GlassGroups collapse into the outermost one. */
const InGroup = createContext(false);

/**
 * Groups neighbouring glass surfaces so native Liquid Glass renders them
 * together and can morph between them. Children should be GlassSurfaces.
 */
export function GlassGroup({ children, spacing = 8, style }: GlassGroupProps) {
  const tier = useGlassTier('surface');
  const nested = useContext(InGroup);
  if (tier === 'native-glass' && liquidGlassAvailable() && !nested) {
    return (
      <InGroup.Provider value>
        <GlassContainer spacing={spacing} style={style}>
          {children}
        </GlassContainer>
      </InGroup.Provider>
    );
  }
  return <View style={style}>{children}</View>;
}

const styles = StyleSheet.create({
  clip: { overflow: 'hidden' },
  rim: { borderWidth: StyleSheet.hairlineWidth },
  sheen: { position: 'absolute', top: 0, left: 0, right: 0, height: '50%' },
  topLine: { position: 'absolute', top: 0, left: 0, right: 0, height: StyleSheet.hairlineWidth },
});
