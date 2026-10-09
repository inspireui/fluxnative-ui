// A number that counts up to `target`: from 0 on mount, then from where it
// is to each new target, so a figure the user just changed slides to its
// new value instead of replaying from zero. For values the native driver
// can't carry (a figure read out, a bar's height); it re-renders every
// frame, so drive a screen's few headline numbers with it, not a list.
// Reduce Motion, or `enabled: false`, shows `target` at once.

import { useEffect, useRef, useState } from 'react';
import { Animated, Easing } from 'react-native';
import useReducedMotion from './useReducedMotion';

export interface CountUpOptions {
  /** Length of a count in ms. Default 900. */
  duration?: number;
  /** Wait before the first count, in ms (a stagger); later counts start at once. Default 0. */
  delay?: number;
  /** false shows `target` without counting. Default true. */
  enabled?: boolean;
}

export default function useCountUp(target: number, { duration = 900, delay = 0, enabled = true }: CountUpOptions = {}): number {
  const reduced = useReducedMotion();
  const animate = enabled && !reduced;
  const driver = useRef(new Animated.Value(0)).current;
  const [value, setValue] = useState(0);
  const started = useRef(false);

  useEffect(() => {
    if (!animate) {
      driver.stopAnimation();
      driver.setValue(target);
      setValue(target);
      started.current = true;
      return;
    }
    const listener = driver.addListener(({ value: next }) => setValue(next));
    const count = Animated.timing(driver, {
      toValue: target,
      duration,
      delay: started.current ? 0 : delay,
      easing: Easing.out(Easing.cubic),
      // Read back on every frame, so it runs on the JS side.
      useNativeDriver: false,
    });
    started.current = true;
    count.start();
    return () => {
      count.stop();
      driver.removeListener(listener);
    };
  }, [driver, target, duration, delay, animate]);

  return animate ? value : target;
}
