// A short message over the bottom of the screen with one optional action
// ("Removed · Undo"). Drawn inside the screen like Sheet: keep it the last
// child of the screen root. It rises and fades in (Reduce Motion: it just
// appears), is read out by screen readers, and asks to close through
// `onDismiss` after `duration` ms. A plain message with no action can go to
// the host instead: `bridge()?.ui?.toast?.(message)`.

import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Platform, StyleSheet, Text, View } from 'react-native';
import { duration as motion, easing, elevation, interaction, layout, shape, space, type } from '../theme/tokens';
import { usePalette } from '../theme/usePalette';
import Press from './Press';
import useReducedMotion from './useReducedMotion';

export interface SnackbarProps {
  /** Shown while true; it animates in and out. */
  visible: boolean;
  message: string;
  /** The one action ("Undo"); shown only with `onAction`. */
  actionLabel?: string;
  /** Runs the action; `onDismiss` follows. */
  onAction?: () => void;
  /** The snackbar asks to close (timer ran out, action ran): set `visible` to false. */
  onDismiss: () => void;
  /** Distance from the bottom of the screen root in px, to clear a tab bar. Default `layout.gutter`. */
  bottom?: number;
  /** Ms before `onDismiss`; 0 keeps it up. Android stretches it to the user's accessibility timeout. Default 4000. */
  duration?: number;
}

const AUTO_DISMISS = 4000;
/** A text action is short: it always gets at least this much extra hit area, in px. */
const ACTION_SLOP = 6;

export default function Snackbar({
  visible,
  message,
  actionLabel,
  onAction,
  onDismiss,
  bottom = layout.gutter,
  duration = AUTO_DISMISS,
}: SnackbarProps) {
  const palette = usePalette();
  const reduced = useReducedMotion();
  const progress = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(visible);
  const dismiss = useRef(onDismiss);
  dismiss.current = onDismiss;

  useEffect(() => {
    if (visible) {
      setMounted(true);
      if (reduced) {
        progress.setValue(1);
        return;
      }
      const enter = Animated.timing(progress, {
        toValue: 1,
        duration: motion.normal,
        easing: Easing.bezier(...easing.standard),
        useNativeDriver: true,
      });
      enter.start();
      return () => enter.stop();
    }
    if (!mounted) return;
    const exit = Animated.timing(progress, { toValue: 0, duration: reduced ? 0 : motion.fast, useNativeDriver: true });
    exit.start(({ finished }) => {
      if (finished) setMounted(false);
    });
    return () => exit.stop();
    // `mounted` is only read here, never a trigger.
  }, [visible, reduced, progress]);

  useEffect(() => {
    if (!visible) return;
    // iOS has no live regions, so say it; Android and the web read the live region below.
    if (Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility(message);
    if (duration <= 0) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const wait = AccessibilityInfo.getRecommendedTimeoutMillis?.(duration) ?? Promise.resolve(duration);
    wait
      .catch(() => duration)
      .then((ms) => {
        if (alive) timer = setTimeout(() => dismiss.current(), ms);
      });
    return () => {
      alive = false;
      if (timer !== undefined) clearTimeout(timer);
    };
  }, [visible, message, duration]);

  if (!mounted) return null;

  const rise = progress.interpolate({ inputRange: [0, 1], outputRange: [reduced ? 0 : interaction.reveal.offset, 0] });
  const ink = palette['inverse-foreground'];
  const hasAction = actionLabel !== undefined && onAction !== undefined;
  return (
    <Animated.View style={[styles.layer, { bottom, opacity: progress, transform: [{ translateY: rise }] }]}>
      <View
        accessibilityLiveRegion="polite"
        style={[styles.bar, hasAction ? styles.barWithAction : null, elevation[3], { backgroundColor: palette.inverse, borderRadius: shape.control }]}
      >
        <Text numberOfLines={2} style={[type.bodySm, styles.message, { color: ink }]}>
          {message}
        </Text>
        {hasAction ? (
          <Press
            onPress={() => {
              onAction();
              dismiss.current();
            }}
            accessibilityLabel={actionLabel}
            hitSlop={Math.max(ACTION_SLOP, interaction.press.hitSlop)}
            style={styles.action}
          >
            <Text style={[type.label, { color: ink }]}>{actionLabel}</Text>
          </Press>
        ) : null}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  layer: { position: 'absolute', left: layout.gutter, right: layout.gutter, zIndex: 30, pointerEvents: 'box-none' },
  bar: { minHeight: space[12], flexDirection: 'row', alignItems: 'center', paddingVertical: space[2], paddingHorizontal: space[5] },
  barWithAction: { paddingRight: space[2] },
  message: { flex: 1 },
  action: { minHeight: space[9], marginLeft: space[2], paddingHorizontal: space[3], alignItems: 'center', justifyContent: 'center' },
});
