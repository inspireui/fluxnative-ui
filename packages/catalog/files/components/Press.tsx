// The one pressable. Scales down while pressed, fires an optional haptic
// through the host bridge, and always carries a screen-reader name. Its
// defaults (haptic, scale, hit slop, spring) are the template's interaction
// profile, `interaction.press` in theme/tokens; props still override them.
// Layout styles (flex, position, margins) go on the Pressable so the
// control sits in its parent's layout; the rest paints the animated box.

import React, { useRef } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  type AccessibilityRole,
  type AccessibilityState,
  type GestureResponderEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { interaction } from '../theme/tokens';
import { bridge } from './bridge';
import useReducedMotion from './useReducedMotion';

export type PressHaptic = 'none' | 'light' | 'selection' | 'medium';
export type PressRole = Extract<AccessibilityRole, 'button' | 'link' | 'tab' | 'radio' | 'checkbox' | 'switch' | 'menuitem'>;

export interface PressProps {
  onPress?: (event: GestureResponderEvent) => void;
  onLongPress?: (event: GestureResponderEvent) => void;
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Screen-reader name. Required: a control with no name is a bug. */
  accessibilityLabel: string;
  accessibilityHint?: string;
  accessibilityRole?: PressRole;
  accessibilityState?: AccessibilityState;
  disabled?: boolean;
  /** Haptic on press, through the host bridge when it has one. Default `interaction.press.haptic` ('none' in the kit). */
  haptic?: PressHaptic;
  /** Scale while pressed; 1 turns it off. Default `interaction.press.activeScale` (0.96 in the kit). */
  activeScale?: number;
  /** Extra hit area in px on every side. Default `interaction.press.hitSlop` (0 in the kit). */
  hitSlop?: number;
  testID?: string;
}

/** How far a disabled control fades. Not a token: every template dims the same way. */
const DISABLED_OPACITY = 0.45;

const OUTER_KEYS = new Set<keyof ViewStyle>([
  'flex',
  'flexGrow',
  'flexShrink',
  'flexBasis',
  'alignSelf',
  'position',
  'top',
  'right',
  'bottom',
  'left',
  'zIndex',
  'margin',
  'marginTop',
  'marginRight',
  'marginBottom',
  'marginLeft',
  'marginHorizontal',
  'marginVertical',
  'width',
  'minWidth',
  'maxWidth',
]);

function splitStyle(style: StyleProp<ViewStyle>): { outer: ViewStyle; inner: ViewStyle } {
  const flat = StyleSheet.flatten(style) ?? {};
  const outer: Record<string, unknown> = {};
  const inner: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(flat)) {
    (OUTER_KEYS.has(key as keyof ViewStyle) ? outer : inner)[key] = value;
  }
  // The inner box fills the outer one so width on the outside still paints.
  if ('width' in outer || 'flex' in outer || 'alignSelf' in outer) inner.width = inner.width ?? '100%';
  return { outer: outer as ViewStyle, inner: inner as ViewStyle };
}

export default function Press({
  onPress,
  onLongPress,
  children,
  style,
  accessibilityLabel,
  accessibilityHint,
  accessibilityRole = 'button',
  accessibilityState,
  disabled = false,
  haptic = interaction.press.haptic,
  activeScale = interaction.press.activeScale,
  hitSlop = interaction.press.hitSlop,
  testID,
}: PressProps) {
  const scale = useRef(new Animated.Value(1)).current;
  const reduced = useReducedMotion();
  const { outer, inner } = splitStyle(style);

  const to = (value: number) => {
    if (reduced || activeScale === 1) return;
    const { speed, bounciness } = interaction.press.spring;
    Animated.spring(scale, { toValue: value, useNativeDriver: true, speed, bounciness }).start();
  };

  return (
    <Pressable
      onPress={(event) => {
        if (haptic !== 'none') bridge()?.ui?.haptic?.(haptic);
        onPress?.(event);
      }}
      onLongPress={onLongPress}
      onPressIn={() => to(activeScale)}
      onPressOut={() => to(1)}
      disabled={disabled}
      hitSlop={hitSlop}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled, ...accessibilityState }}
      style={outer}
      testID={testID}
    >
      <Animated.View style={[inner, { transform: [{ scale }] }, disabled ? styles.disabled : null]}>{children}</Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  disabled: { opacity: DISABLED_OPACITY },
});
