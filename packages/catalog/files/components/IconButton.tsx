// A round icon-only control: 36 / 44 / 52 px. The child is the icon; pick
// its colour with `iconButtonInk(variant, palette)` so it reads on the fill.
// Corners follow `shape.control` (round in the kit). `badge` and `dot` mark
// the top-right corner, and a count joins the screen-reader name.

import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { fontWeight, interaction, shape, type } from '../theme/tokens';
import { usePalette, type Palette } from '../theme/usePalette';
import Press, { type PressHaptic } from './Press';

export type IconButtonVariant = 'plain' | 'tonal' | 'filled' | 'translucent' | 'outline' | 'outline-on-surface';
export type IconButtonSize = 'sm' | 'md' | 'lg';

export interface IconButtonProps {
  children: React.ReactNode;
  onPress?: () => void;
  /** Screen-reader name. Required: the icon has no text. */
  accessibilityLabel: string;
  accessibilityHint?: string;
  /**
   * Default 'plain'. 'translucent' is the white-over-photo button;
   * 'outline-on-surface' is a `card` face with a hairline ring (header buttons).
   */
  variant?: IconButtonVariant;
  /** Default 'md' (44 px). */
  size?: IconButtonSize;
  disabled?: boolean;
  /**
   * A count or short text in the top-right corner; `true` shows a dot; 0, ''
   * and false hide it. A count or text joins the screen-reader name ("Bag, 3")
   * unless the name already says it.
   */
  badge?: number | string | boolean;
  /** A small dot in the corner (something new) when there is no count. */
  dot?: boolean;
  /** Marks a toggled state (saved, selected) for screen readers. */
  selected?: boolean;
  haptic?: PressHaptic;
  style?: StyleProp<ViewStyle>;
}

const SIZE: Record<IconButtonSize, number> = { sm: 36, md: 44, lg: 52 };
/** The smallest comfortable touch target: a smaller button grows its hit area to it. */
const MIN_TARGET = 44;
/** The icon size the dot is placed against (`Icon`'s default). */
const ICON = 24;
/** Comp tokens `iconButton.badge.*`: count height, dot diameter, and the ring that sets a mark off an 'outline-on-surface' face. */
const BADGE = 18;
const DOT = 8;
const RING = 2;

/** The colour an icon should use on each variant's fill. */
export function iconButtonInk(variant: IconButtonVariant, palette: Palette): string {
  if (variant === 'filled') return palette['primary-foreground'];
  if (variant === 'outline-on-surface') return palette['card-foreground'];
  return palette.foreground;
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
    case 'outline-on-surface':
      return { backgroundColor: palette.card, borderWidth: StyleSheet.hairlineWidth * 2, borderColor: palette.border };
  }
}

/** What the corner shows: a count or text, a dot, or nothing. */
function markOf(badge: IconButtonProps['badge'], dot: boolean): { text: string } | 'dot' | null {
  if ((typeof badge === 'number' && badge !== 0) || (typeof badge === 'string' && badge !== '')) return { text: String(badge) };
  return badge === true || dot ? 'dot' : null;
}

/** "Bag" and "3" → "Bag, 3"; a name that already holds the count stays as it is. */
function withCount(label: string, count: string): string {
  const escaped = count.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|\\W)${escaped}($|\\W)`).test(label) ? label : `${label}, ${count}`;
}

/** The dot sits on the corner of a default-size icon. */
function dotPlace(px: number, ringed: boolean): ViewStyle {
  const size = ringed ? DOT + RING * 2 : DOT;
  const inset = Math.max(0, (px - ICON) / 2 - (ringed ? RING : 0));
  return { top: inset, right: inset, width: size, height: size, borderRadius: size / 2 };
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
  dot = false,
  selected,
  haptic = 'light',
  style,
}: IconButtonProps) {
  const palette = usePalette();
  const px = SIZE[size];
  const mark = markOf(badge, dot);
  const ringed = variant === 'outline-on-surface';
  const ring = ringed ? { borderWidth: RING, borderColor: palette.card } : null;
  return (
    <Press
      onPress={onPress}
      disabled={disabled}
      haptic={haptic}
      hitSlop={Math.max(interaction.press.hitSlop, px < MIN_TARGET ? (MIN_TARGET - px) / 2 : 0)}
      accessibilityLabel={mark !== null && mark !== 'dot' ? withCount(accessibilityLabel, mark.text) : accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={selected === undefined ? undefined : { selected }}
      style={[styles.button, { width: px, height: px, borderRadius: Math.min(shape.control, px / 2) }, fillOf(variant, palette), style]}
    >
      <View style={styles.center}>{children}</View>
      {mark === 'dot' ? (
        <View style={[styles.dot, dotPlace(px, ringed), { backgroundColor: palette.destructive }, ring]} />
      ) : mark !== null ? (
        <View style={[styles.badge, ringed ? styles.badgeRinged : null, { backgroundColor: palette.destructive }, ring]}>
          <Text style={[type.caps, styles.badgeText, { color: palette['destructive-foreground'] }]}>{mark.text}</Text>
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
    minWidth: BADGE,
    height: BADGE,
    paddingHorizontal: 5,
    borderRadius: shape.chip,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // The ring goes around the 18 px count, so the count stays where it is.
  badgeRinged: { top: 2 - RING, right: 2 - RING, minWidth: BADGE + RING * 2, height: BADGE + RING * 2 },
  // The caps role, bold and untracked: a count, not a label.
  badgeText: { fontWeight: fontWeight.bold, letterSpacing: 0 },
  dot: { position: 'absolute' },
});
