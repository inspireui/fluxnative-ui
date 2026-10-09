// The viewfinder of an AI scan screen: four corner brackets and, while
// `scanning`, a line sweeping up and down. Draws no camera: put the camera
// view or the captured photo inside as children, or lay the frame over a
// full-screen camera. Size it with `style` (`{ width: '100%', aspectRatio:
// 3 / 4 }`). Reduce Motion holds the line still across the middle.

import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import { shape, space, type ColorName } from '../theme/tokens';
import { usePalette } from '../theme/usePalette';
import useReducedMotion from './useReducedMotion';

export interface ScanFrameProps {
  /** Sweep the scan line (analysing). Default false. */
  scanning?: boolean;
  /** The camera view or the photo, clipped to the frame's rounded corners. */
  children?: React.ReactNode;
  /** Palette role of the corners and the line. Default 'primary'. */
  tint?: ColorName;
  /** Names the frame for screen readers ('Product photo') and reports `scanning` as busy. Omit to leave the children as they are. */
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

const STROKE = 3;
const LINE = 2;
const SWEEP_MS = 1800;

export default function ScanFrame({ scanning = false, children, tint = 'primary', accessibilityLabel, style }: ScanFrameProps) {
  const palette = usePalette();
  const reduced = useReducedMotion();
  const [height, setHeight] = useState(0);
  const sweep = useRef(new Animated.Value(0.5)).current;
  const color = palette[tint];
  const corner = Math.max(space[8], shape.card + space[4]);
  const inset = space[3];

  useEffect(() => {
    if (!scanning || reduced || height === 0) {
      sweep.setValue(0.5);
      return;
    }
    sweep.setValue(0);
    const pass = (toValue: number) =>
      Animated.timing(sweep, { toValue, duration: SWEEP_MS, easing: Easing.inOut(Easing.ease), useNativeDriver: true });
    const loop = Animated.loop(Animated.sequence([pass(1), pass(0)]));
    loop.start();
    return () => loop.stop();
  }, [scanning, reduced, height, sweep]);

  const travel = Math.max(0, height - inset * 2 - LINE);
  const translateY = sweep.interpolate({ inputRange: [0, 1], outputRange: [inset, inset + travel] });
  const edge = { borderColor: color, width: corner, height: corner };

  return (
    <View
      accessible={accessibilityLabel !== undefined}
      accessibilityRole={accessibilityLabel !== undefined ? 'image' : undefined}
      accessibilityLabel={accessibilityLabel}
      aria-busy={accessibilityLabel !== undefined ? scanning : undefined}
      onLayout={(event: LayoutChangeEvent) => setHeight(event.nativeEvent.layout.height)}
      style={[styles.frame, { borderRadius: shape.card }, style]}
    >
      {children}
      <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={StyleSheet.absoluteFill}>
        <View style={[styles.corner, edge, styles.topLeft, { borderTopLeftRadius: shape.card }]} />
        <View style={[styles.corner, edge, styles.topRight, { borderTopRightRadius: shape.card }]} />
        <View style={[styles.corner, edge, styles.bottomLeft, { borderBottomLeftRadius: shape.card }]} />
        <View style={[styles.corner, edge, styles.bottomRight, { borderBottomRightRadius: shape.card }]} />
        {scanning && height > 0 ? (
          <Animated.View
            style={[
              styles.line,
              { left: inset, right: inset, backgroundColor: color, shadowColor: color, transform: [{ translateY }] },
            ]}
          />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { overflow: 'hidden' },
  corner: { position: 'absolute' },
  topLeft: { top: 0, left: 0, borderTopWidth: STROKE, borderLeftWidth: STROKE },
  topRight: { top: 0, right: 0, borderTopWidth: STROKE, borderRightWidth: STROKE },
  bottomLeft: { bottom: 0, left: 0, borderBottomWidth: STROKE, borderLeftWidth: STROKE },
  bottomRight: { bottom: 0, right: 0, borderBottomWidth: STROKE, borderRightWidth: STROKE },
  line: {
    position: 'absolute',
    top: 0,
    height: LINE,
    borderRadius: LINE / 2,
    shadowOpacity: 0.8,
    shadowRadius: space[2],
    shadowOffset: { width: 0, height: 0 },
  },
});
