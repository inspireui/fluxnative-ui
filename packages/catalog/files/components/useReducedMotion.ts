// Reads the OS reduce-motion setting once and follows changes. Every
// animated primitive asks this before moving anything.

import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';
import { prefersReducedMotion, setReducedMotion } from './bridge';

export default function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(prefersReducedMotion);
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => {
        if (!alive) return;
        setReducedMotion(value);
        setReduced(value);
      })
      .catch(() => undefined);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', (value) => {
      setReducedMotion(value);
      setReduced(value);
    });
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);
  return reduced;
}
