// The dimming layer under a sheet or dialog. Driven by the owner's
// progress value so it fades with the surface; tapping it closes.

import React from 'react';
import { Animated, Pressable, StyleSheet } from 'react-native';
import { usePalette } from '../theme/usePalette';

export interface ScrimProps {
  /** 0 = hidden, 1 = fully dimmed. */
  progress: Animated.Value | Animated.AnimatedInterpolation<number>;
  /** When false the layer ignores touches (while hidden or closing). */
  active: boolean;
  onPress?: () => void;
  /** Screen-reader name of the tap target. Default 'Close'. */
  accessibilityLabel?: string;
}

export default function Scrim({ progress, active, onPress, accessibilityLabel = 'Close' }: ScrimProps) {
  const palette = usePalette();
  return (
    <Animated.View
      pointerEvents={active ? 'auto' : 'none'}
      style={[StyleSheet.absoluteFill, { backgroundColor: palette.scrim, opacity: progress }]}
    >
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        disabled={!active}
      />
    </Animated.View>
  );
}
