// A round icon-only control: 36 / 44 / 52 px. The child is the icon; pick
// its colour with `iconButtonInk(variant, palette)` so it reads on the fill.

import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { fontWeight, radius } from '../theme/tokens';
import { usePalette, type Palette } from '../theme/usePalette';
import Press, { type PressHaptic } from './Press';

export type IconButtonVariant = 'plain' | 'tonal' | 'filled' | 'translucent' | 'outline';
export type IconButtonSize = 'sm' | 'md' | 'lg';

export interface IconButtonProps {
  children: React.ReactNode;
  onPress?: () => void;
  /** Screen-reader name. Required: the icon has no text. */
  accessibilityLabel: string;
  accessibilityHint?: string;
  /** Default 'plain'. 'translucent' is the white-over-photo button. */
  variant?: IconButtonVariant;
  /** Default 'md' (44 px). */
  size?: IconButtonSize;
  disabled?: boolean;
  /** Count or dot in the top-right corner. */
  badge?: number | string;
  /** Marks a toggled state (saved, selected) for screen readers. */
  selected?: boolean;
  haptic?: PressHaptic;
  style?: StyleProp<ViewStyle>;
}

const SIZE: Record<IconButtonSize, number> = { sm: 36, md: 44, lg: 52 };

/** The colour an icon should use on each variant's fill. */
export function iconButtonInk(variant: IconButtonVariant, palette: Palette): string {
  return variant === 'filled' ? palette['primary-foreground'] : palette.foreground;
}

function fillOf(variant: IconButtonVariant, palette: Palette): ViewStyle {
  switch (variant) {
    case 'plain':
      return { backgroundColor: 'transparent' };
    case 'tonal':
      return { backgroundColor: palette.secondary };
    case 'filled':
      return { backgroundColor: palette.primary };
    case 'translucent':
      return { backgroundColor: palette['glass-fill'], borderWidth: StyleSheet.hairlineWidth, borderColor: palette['glass-border'] };
    case 'outline':
      return { backgroundColor: 'transparent', borderWidth: StyleSheet.hairlineWidth * 2, borderColor: palette.border };
  }
}

export default function IconButton({
  children,
  onPress,
  accessibilityLabel,
  accessibilityHint,
  variant = 'plain',
  size = 'md',
  disabled = false,
  badge,
  selected,
  haptic = 'light',
  style,
}: IconButtonProps) {
  const palette = usePalette();
  const px = SIZE[size];
  const showBadge = badge !== undefined && badge !== 0 && badge !== '';
  return (
    <Press
      onPress={onPress}
      disabled={disabled}
      haptic={haptic}
      hitSlop={px < 44 ? (44 - px) / 2 : 0}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={selected === undefined ? undefined : { selected }}
      style={[styles.button, { width: px, height: px, borderRadius: px / 2 }, fillOf(variant, palette), style]}
    >
      <View style={styles.center}>{children}</View>
      {showBadge ? (
        <View style={[styles.badge, { backgroundColor: palette.destructive }]}>
          <Text style={[styles.badgeText, { color: palette['destructive-foreground'] }]}>{String(badge)}</Text>
        </View>
      ) : null}
    </Press>
  );
}

const styles = StyleSheet.create({
  button: { alignItems: 'center', justifyContent: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  badge: {
    position: 'absolute',
    top: 2,
    right: 2,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 5,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontSize: 11, lineHeight: 14, fontWeight: fontWeight.bold },
});
