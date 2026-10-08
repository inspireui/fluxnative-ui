// Loading placeholder: a muted block that breathes. Size it like the
// content it stands in for. Reduce motion holds it still.

import React, { useEffect, useRef } from 'react';
import { Animated, type DimensionValue, type StyleProp, type ViewStyle } from 'react-native';
import { radius as radii } from '../theme/tokens';
import { usePalette } from '../theme/usePalette';
import useReducedMotion from './useReducedMotion';

export interface SkeletonProps {
  width?: DimensionValue;
  /** Default 16. */
  height?: number;
  /** Corner radius. Default `radius.lg`; `circle` ignores it. */
  radius?: number;
  circle?: boolean;
  style?: StyleProp<ViewStyle>;
}

const PULSE_MS = 900;

export default function Skeleton({ width = '100%', height = 16, radius = radii.lg, circle = false, style }: SkeletonProps) {
  const palette = usePalette();
  const opacity = useRef(new Animated.Value(1)).current;
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced) {
      opacity.setValue(0.8);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.5, duration: PULSE_MS, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: PULSE_MS, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity, reduced]);

  const size = circle ? { width: height, height, borderRadius: height / 2 } : { width, height, borderRadius: radius };
  return <Animated.View accessibilityElementsHidden style={[size, { backgroundColor: palette.muted, opacity }, style]} />;
}
