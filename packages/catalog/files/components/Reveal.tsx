// Entrance: fade and rise once on mount. Stagger lists with `index`
// (capped so a long list doesn't wait on its tail). Reduce motion snaps.

import React, { useEffect, useRef } from 'react';
import { Animated, Easing, type StyleProp, type ViewStyle } from 'react-native';
import { duration } from '../theme/tokens';
import useReducedMotion from './useReducedMotion';

export interface RevealProps {
  children?: React.ReactNode;
  /** Position in a list; each step waits 55 ms more, capped at the 8th item. */
  index?: number;
  /** Extra delay in ms on top of the stagger. */
  delay?: number;
  /** Rise distance in px. Default 16. */
  offset?: number;
  style?: StyleProp<ViewStyle>;
}

const STAGGER_MS = 55;
const STAGGER_CAP = 7;

/** The delay for the `index`-th item of a list. */
export function stagger(index: number): number {
  return Math.min(index, STAGGER_CAP) * STAGGER_MS;
}

export default function Reveal({ children, index = 0, delay = 0, offset = 16, style }: RevealProps) {
  const progress = useRef(new Animated.Value(0)).current;
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced) {
      progress.setValue(1);
      return;
    }
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: duration.slow + 200,
      delay: stagger(index) + delay,
      easing: Easing.bezier(0.16, 1, 0.3, 1),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [progress, reduced, index, delay]);

  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [offset, 0] });
  return <Animated.View style={[style, { opacity: progress, transform: [{ translateY }] }]}>{children}</Animated.View>;
}
