// Bottom sheet, drawn inside the screen (never a Modal, which escapes the
// preview frame). Springs up over a scrim; closes on scrim tap, a drag of
// the handle past 80 px, or `open={false}`. Keep it as the last child of
// the screen root so it paints above everything.

import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  PanResponder,
  StyleSheet,
  Text,
  View,
  type DimensionValue,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { duration, fontWeight, radius, space, text } from '../theme/tokens';
import { usePalette } from '../theme/usePalette';
import Scrim from './Scrim';
import useReducedMotion from './useReducedMotion';

export interface SheetProps {
  open: boolean;
  onClose: () => void;
  children?: React.ReactNode;
  /** Title row; omit for a bare sheet. */
  title?: string;
  /** Slot at the title's right edge (a "Clear all" text button, a close icon). */
  trailing?: React.ReactNode;
  /** Pinned below the content (a CTA). */
  footer?: React.ReactNode;
  /** Sheet height; defaults to hugging its content. */
  height?: DimensionValue;
  contentStyle?: StyleProp<ViewStyle>;
  /** Screen-reader name of the scrim tap target. Default 'Close sheet'. */
  closeLabel?: string;
}

const CLOSE_DRAG = 80;
const CLOSE_VELOCITY = 0.8;
const SKIRT = 48;

export default function Sheet({
  open,
  onClose,
  children,
  title,
  trailing,
  footer,
  height,
  contentStyle,
  closeLabel = 'Close sheet',
}: SheetProps) {
  const palette = usePalette();
  const reduced = useReducedMotion();
  const progress = useRef(new Animated.Value(0)).current;
  const drag = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(open);
  const [sheetHeight, setSheetHeight] = useState(0);

  useEffect(() => {
    if (open) {
      setMounted(true);
      drag.setValue(0);
      if (reduced) {
        progress.setValue(1);
        return;
      }
      const spring = Animated.spring(progress, { toValue: 1, damping: 20, stiffness: 190, mass: 1, useNativeDriver: true });
      spring.start();
      return () => spring.stop();
    }
    if (!mounted) return;
    const close = Animated.timing(progress, { toValue: 0, duration: reduced ? 0 : duration.normal, useNativeDriver: true });
    close.start(({ finished }) => {
      if (finished) setMounted(false);
    });
    return () => close.stop();
    // `mounted` is only read here, never a trigger.
  }, [open, reduced, progress, drag]);

  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => g.dy > 4 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderMove: (_, g) => drag.setValue(Math.max(0, g.dy)),
      onPanResponderRelease: (_, g) => {
        if (g.dy > CLOSE_DRAG || g.vy > CLOSE_VELOCITY) {
          onCloseRef.current();
          return;
        }
        Animated.spring(drag, { toValue: 0, damping: 20, stiffness: 190, useNativeDriver: true }).start();
      },
    }),
  ).current;

  if (!mounted) return null;

  const travel = sheetHeight > 0 ? sheetHeight + SKIRT : 800;
  const translateY = Animated.add(progress.interpolate({ inputRange: [0, 1], outputRange: [travel, 0] }), drag);
  const onLayout = (event: LayoutChangeEvent) => setSheetHeight(event.nativeEvent.layout.height);

  return (
    <View style={styles.layer} pointerEvents="box-none">
      <Scrim progress={progress} active={open} onPress={onClose} accessibilityLabel={closeLabel} />
      <Animated.View
        onLayout={onLayout}
        style={[
          styles.sheet,
          { backgroundColor: palette.background, transform: [{ translateY }] },
          height !== undefined ? { height } : null,
        ]}
        accessibilityViewIsModal
      >
        <View {...pan.panHandlers} style={styles.grab}>
          <View style={[styles.handle, { backgroundColor: palette.border }]} />
          {title !== undefined || trailing !== undefined ? (
            <View style={styles.titleRow}>
              {title !== undefined ? (
                <Text accessibilityRole="header" style={[styles.title, { color: palette.foreground }]}>
                  {title}
                </Text>
              ) : (
                <View style={styles.titleSpacer} />
              )}
              {trailing}
            </View>
          ) : null}
        </View>
        <View style={[styles.content, contentStyle]}>{children}</View>
        {footer !== undefined ? <View style={styles.footer}>{footer}</View> : null}
        <View style={[styles.skirt, { backgroundColor: palette.background }]} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  layer: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, justifyContent: 'flex-end', zIndex: 20 },
  sheet: {
    borderTopLeftRadius: radius['3xl'],
    borderTopRightRadius: radius['3xl'],
    paddingBottom: space[6],
    maxHeight: '92%',
  },
  grab: { paddingTop: space[2], paddingHorizontal: space[5] },
  handle: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, marginBottom: space[3] },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: space[3] },
  title: { fontSize: text.xl.fontSize, lineHeight: text.xl.lineHeight, fontWeight: fontWeight.bold, letterSpacing: -0.2 },
  titleSpacer: { flex: 1 },
  content: { paddingHorizontal: space[5], flexShrink: 1 },
  footer: { paddingHorizontal: space[5], paddingTop: space[3] },
  skirt: { position: 'absolute', left: 0, right: 0, bottom: -SKIRT, height: SKIRT },
});
