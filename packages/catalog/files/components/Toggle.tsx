// An on/off switch drawn with Views: the track fills with `primary` and the
// knob springs across. Built on Press, so it takes the interaction profile's
// haptic and press scale, and its hit area grows to 44 px. Corners follow
// `shape.control` (a pill in the kit). Reduce motion snaps.

import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { elevation, interaction, shape } from '../theme/tokens';
import { usePalette } from '../theme/usePalette';
import Press, { type PressHaptic } from './Press';
import useReducedMotion from './useReducedMotion';

export type ToggleSize = 'sm' | 'md';

export interface ToggleProps {
  value: boolean;
  onValueChange: (next: boolean) => void;
  /** Screen-reader name. Required: the switch has no text of its own. */
  accessibilityLabel: string;
  accessibilityHint?: string;
  /** 48 × 28 or 50 × 30 px. Default 'md'. */
  size?: ToggleSize;
  disabled?: boolean;
  /** Default `interaction.press.haptic`, like every Press. */
  haptic?: PressHaptic;
}

/** Track and knob per size, in px. */
const TRACK: Record<ToggleSize, { width: number; height: number; knob: number }> = {
  sm: { width: 48, height: 28, knob: 22 },
  md: { width: 50, height: 30, knob: 24 },
};
/** The smallest comfortable touch target: the switch grows its hit area to it. */
const MIN_TARGET = 44;
/** The knob's slide: a little overshoot, settled in about 300 ms. */
const SLIDE = { speed: 20, bounciness: 6 };

export default function Toggle({
  value,
  onValueChange,
  accessibilityLabel,
  accessibilityHint,
  size = 'md',
  disabled = false,
  haptic = interaction.press.haptic,
}: ToggleProps) {
  const palette = usePalette();
  const reduced = useReducedMotion();
  const on = useRef(new Animated.Value(value ? 1 : 0)).current;
  const { width, height, knob } = TRACK[size];
  const inset = (height - knob) / 2;
  const radius = Math.min(shape.control, height / 2);

  useEffect(() => {
    if (reduced) {
      on.setValue(value ? 1 : 0);
      return;
    }
    const slide = Animated.spring(on, { toValue: value ? 1 : 0, useNativeDriver: true, ...SLIDE });
    slide.start();
    return () => slide.stop();
  }, [on, value, reduced]);

  const fill = on.interpolate({ inputRange: [0, 1], outputRange: [0, 1], extrapolate: 'clamp' });
  const translateX = on.interpolate({ inputRange: [0, 1], outputRange: [0, width - knob - inset * 2] });
  return (
    <Press
      onPress={() => onValueChange(!value)}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      disabled={disabled}
      haptic={haptic}
      hitSlop={Math.max(interaction.press.hitSlop, Math.ceil((MIN_TARGET - height) / 2))}
    >
      <View style={[styles.track, { width, height, padding: inset, borderRadius: radius, backgroundColor: palette.border }]}>
        <Animated.View style={[StyleSheet.absoluteFill, { borderRadius: radius, backgroundColor: palette.primary, opacity: fill }]} />
        <Animated.View
          style={[
            elevation[1],
            {
              width: knob,
              height: knob,
              // Concentric with the track: a circle in a pill.
              borderRadius: Math.max(0, radius - inset),
              backgroundColor: palette['primary-foreground'],
              transform: [{ translateX }],
            },
          ]}
        />
      </View>
    </Press>
  );
}

const styles = StyleSheet.create({
  track: { justifyContent: 'center' },
});
