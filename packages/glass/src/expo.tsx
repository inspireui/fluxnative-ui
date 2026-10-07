// `import '@flux-ui/glass/expo'` once, in app/_layout.tsx: registers
// expo-glass-effect (native Liquid Glass, iOS 26+) and expo-blur (iOS < 26,
// web) as the glass adapter.
//
// Android stays on the translucent tier for now: expo-blur there needs a
// BlurTargetView wrapped around the content behind the blur, which a bar
// floating over arbitrary screens can't own. That is a deliberate v0 gap.

import React from 'react';
import { Platform, View, type ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { GlassContainer, GlassView, isGlassEffectAPIAvailable, isLiquidGlassAvailable } from 'expo-glass-effect';
import { colors } from '@flux-ui/tokens';
import { registerGlassAdapter, type BlurProps, type NativeGlassGroupProps, type NativeGlassProps } from './adapter.ts';

function NativeGlass({ variant, tintColor, interactive = false, colorScheme, style }: NativeGlassProps) {
  return (
    <GlassView
      // isInteractive is read once at mount; remount when it changes.
      key={interactive ? 'interactive' : 'static'}
      glassEffectStyle={variant}
      tintColor={tintColor}
      isInteractive={interactive}
      colorScheme={colorScheme}
      style={style}
    />
  );
}

function NativeGlassGroup({ spacing, style, children }: NativeGlassGroupProps) {
  return (
    <GlassContainer spacing={spacing} style={style}>
      {children}
    </GlassContainer>
  );
}

function Blur({ colorScheme, radius, saturate, style }: BlurProps) {
  if (Platform.OS === 'web') {
    // expo-blur's web tint turns near-opaque at the intensity a bar needs,
    // so the web draws the backdrop filter itself under a thin token fill.
    const filter = `blur(${radius}px) saturate(${Math.round(saturate * 100)}%)`;
    const web = { backdropFilter: filter, WebkitBackdropFilter: filter } as unknown as ViewStyle;
    return <View style={[style, web, { backgroundColor: colors[colorScheme]['glass-blur-fill'] }]} />;
  }
  return (
    <BlurView
      tint={colorScheme === 'dark' ? 'systemChromeMaterialDark' : 'systemChromeMaterialLight'}
      intensity={Math.min(100, Math.round(radius * 5))}
      style={style}
    />
  );
}

registerGlassAdapter({
  name: 'expo',
  // isGlassEffectAPIAvailable guards early iOS 26 betas that lack the API.
  liquidGlassAvailable: () => Platform.OS === 'ios' && isGlassEffectAPIAvailable() && isLiquidGlassAvailable(),
  blurAvailable: () => Platform.OS === 'ios' || Platform.OS === 'web',
  GlassView: NativeGlass,
  GlassGroup: NativeGlassGroup,
  BlurView: Blur,
});
