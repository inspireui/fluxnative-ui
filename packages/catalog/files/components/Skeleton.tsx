// Loading placeholder: a block that breathes. Size it like the content it
// stands in for. The interaction profile (`interaction.skeleton`) picks the
// breath: `opacity` fades the `base` colour, `color` moves between the
// `base` and `highlight` palette roles. Reduce motion holds it still.

import React, { useEffect, useRef } from 'react';
import { Animated, type DimensionValue, type StyleProp, type ViewStyle } from 'react-native';
import { interaction, shape } from '../theme/tokens';
import { usePalette } from '../theme/usePalette';
import useReducedMotion from './useReducedMotion';

export interface SkeletonProps {
  width?: DimensionValue;
  /** Default 16. */
  height?: number;
  /** Corner radius. Default `shape.well`; `circle` ignores it. */
  radius?: number;
  circle?: boolean;
  style?: StyleProp<ViewStyle>;
}

export default function Skeleton({ width = '100%', height = 16, radius = shape.well, circle = false, style }: SkeletonProps) {
  const palette = usePalette();
  const { mode, base, highlight, pulse, minOpacity, reducedOpacity } = interaction.skeleton;
  const color = mode === 'color';
  // Opacity breathes 1 → minOpacity → 1; colour breathes base (0) → highlight (1) → base.
  const breath = useRef(new Animated.Value(color ? 0 : 1)).current;
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced) {
      breath.setValue(color ? 0 : reducedOpacity);
      return;
    }
    // A background colour can't run on the native driver on every host; opacity can.
    const native = !color;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breath, { toValue: color ? 1 : minOpacity, duration: pulse, useNativeDriver: native }),
        Animated.timing(breath, { toValue: color ? 0 : 1, duration: pulse, useNativeDriver: native }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [breath, reduced, color, minOpacity, pulse, reducedOpacity]);

  const size = circle ? { width: height, height, borderRadius: height / 2 } : { width, height, borderRadius: radius };
  const paint = color
    ? { backgroundColor: breath.interpolate({ inputRange: [0, 1], outputRange: [palette[base], palette[highlight]] }) }
    : { backgroundColor: palette[base], opacity: breath };
  return <Animated.View accessibilityElementsHidden style={[size, paint, style]} />;
}
