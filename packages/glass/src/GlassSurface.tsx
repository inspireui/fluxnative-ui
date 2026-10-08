// One glass surface, drawn with the best tier the device allows.
//
// Rules the components rely on:
// - Never animate `opacity` on a GlassSurface or any ancestor: UIGlassEffect
//   stops rendering under a faded parent. Animate transforms instead.
// - Never nest glass in glass. Put neighbouring glass in one <GlassGroup>.
// - Never give glass a `backgroundColor`; use `tint` with a palette color.

import React, { createContext, useContext, type ReactNode } from 'react';
import { StyleSheet, View, useColorScheme, type StyleProp, type ViewStyle } from 'react-native';
import { colors, glass as glassTokens } from '@fluxnative/tokens';
import { getGlassAdapter, type GlassVariant } from './adapter.ts';
import { useGlassEnvironment } from './environment.ts';
import { resolveGlassTier, type GlassRole, type GlassTier } from './tiers.ts';
import { withAlpha } from './color.ts';
import { GLASS_LOOK } from './contract.ts';

export interface GlassSurfaceProps {
  children?: ReactNode;
  /** `bar` lets a navigator host it natively; everything else is `surface`. */
  role?: GlassRole;
  /** `clear` only over photos or video, with legible content on top. */
  variant?: GlassVariant;
  /**
   * A color that tints the glass — pass a palette value (`palette.primary`),
   * never a literal. Keep it rare: tint is for emphasis. This takes a value,
   * not a token name, so the same contract works in hosts that ship their
   * own palette (the Flux runtime's `flux/glass`).
   */
  tint?: string;
  /** Touch response on native glass; only for glass that is itself pressable. */
  interactive?: boolean;
  /** Corner radius in px. Bars and pills usually pass a capsule radius. */
  radius?: number;
  style?: StyleProp<ViewStyle>;
  /** Force a tier. For tests and screenshots only. */
  tier?: GlassTier;
  pointerEvents?: 'auto' | 'none' | 'box-none' | 'box-only';
}

/** The tier a surface with this role would get here. */
export function useGlassTier(role: GlassRole = 'surface', forced?: GlassTier): GlassTier {
  const env = useGlassEnvironment();
  return resolveGlassTier({ ...env, role, forced });
}

/** Nested GlassGroups collapse into the outermost one. */
const InGroup = createContext(false);

export function GlassSurface({
  children,
  role = 'surface',
  variant = 'regular',
  tint,
  interactive,
  radius = 0,
  style,
  tier: forced,
  pointerEvents,
}: GlassSurfaceProps) {
  const tier = useGlassTier(role, forced);
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const palette = colors[scheme];
  const adapter = getGlassAdapter();
  const tintColor = tint;
  const shape: ViewStyle = { borderRadius: radius };

  if (tier === 'native-bar') {
    // The system bar draws the material; this is only a layout box.
    return (
      <View style={[shape, style]} pointerEvents={pointerEvents}>
        {children}
      </View>
    );
  }

  // A forced tier the device can't draw (native glass on the web) falls
  // through to translucent instead of rendering an empty box.
  if (tier === 'native-glass' && adapter.GlassView && adapter.liquidGlassAvailable()) {
    const Glass = adapter.GlassView;
    return (
      <View style={[shape, style]} pointerEvents={pointerEvents}>
        <Glass
          variant={variant}
          tintColor={tintColor}
          interactive={interactive}
          colorScheme={scheme}
          style={[StyleSheet.absoluteFill, shape]}
        />
        {children}
      </View>
    );
  }

  if (tier === 'blur' && adapter.BlurView && adapter.blurAvailable()) {
    const Blur = adapter.BlurView;
    return (
      <View style={[styles.clip, shape, style]} pointerEvents={pointerEvents}>
        <Blur
          colorScheme={scheme}
          radius={glassTokens.blurRadius}
          saturate={glassTokens.saturate}
          // backdrop-filter ignores the parent's rounded clip on the web.
          style={[StyleSheet.absoluteFill, shape]}
        />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: tintColor ? withAlpha(tintColor, GLASS_LOOK.tintAlpha.blur) : undefined }]} />
        <View style={[StyleSheet.absoluteFill, shape, styles.rim, { borderColor: palette['glass-border'] }]} />
        {children}
      </View>
    );
  }

  if (tier === 'opaque') {
    return (
      <View
        style={[shape, styles.rim, { backgroundColor: palette['glass-opaque'], borderColor: palette.border }, style]}
        pointerEvents={pointerEvents}
      >
        {children}
      </View>
    );
  }

  // translucent: also the landing spot when a tier's adapter piece is missing.
  const dark = scheme === 'dark';
  return (
    <View style={[styles.clip, shape, style]} pointerEvents={pointerEvents}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: palette['glass-fill'] }]} />
      {tintColor ? <View style={[StyleSheet.absoluteFill, { backgroundColor: withAlpha(tintColor, GLASS_LOOK.tintAlpha.translucent) }]} /> : null}
      <View style={[styles.sheen, { backgroundColor: palette['glass-highlight'], opacity: dark ? GLASS_LOOK.sheenOpacity.dark : GLASS_LOOK.sheenOpacity.light }]} pointerEvents="none" />
      <View
        style={[styles.topLine, { marginHorizontal: radius * 0.6, backgroundColor: palette['glass-highlight'] }]}
        pointerEvents="none"
      />
      <View style={[StyleSheet.absoluteFill, shape, styles.rim, { borderColor: palette['glass-border'] }]} pointerEvents="none" />
      {children}
    </View>
  );
}

export interface GlassGroupProps {
  children?: ReactNode;
  /** Distance at which neighbouring native glass starts to merge. */
  spacing?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * Groups neighbouring glass surfaces (e.g. floating glass buttons) so native
 * Liquid Glass renders them together and can morph between them. Children
 * should be <GlassSurface>s: on iOS 26+ this is a native GlassContainer,
 * which is not a general-purpose layout view.
 */
export function GlassGroup({ children, spacing = 8, style }: GlassGroupProps) {
  const tier = useGlassTier('surface');
  const adapter = getGlassAdapter();
  const nested = useContext(InGroup);
  if (tier === 'native-glass' && adapter.GlassGroup && !nested) {
    const Group = adapter.GlassGroup;
    return (
      <InGroup.Provider value>
        <Group spacing={spacing} style={style}>
          {children}
        </Group>
      </InGroup.Provider>
    );
  }
  return <View style={style}>{children}</View>;
}


const styles = StyleSheet.create({
  clip: { overflow: 'hidden' },
  rim: { borderWidth: StyleSheet.hairlineWidth },
  // The upper half catches light: a flat sheen reads as glass at any size,
  // where a specular disc only works on cards.
  sheen: { position: 'absolute', top: 0, left: 0, right: 0, height: '50%' },
  topLine: { position: 'absolute', top: 0.5, left: 0, right: 0, height: StyleSheet.hairlineWidth },
});
