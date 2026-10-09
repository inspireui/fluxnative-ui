// The text button. One closed set of variants and sizes so every CTA in a
// template looks like the same family. `lg` is the 56 px bottom-bar pill.

import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { fontWeight, radius, space, text } from '../theme/tokens';
import { usePalette, type Palette } from '../theme/usePalette';
import Press, { type PressHaptic } from './Press';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps {
  label: string;
  onPress?: () => void;
  /** Default 'primary'. */
  variant?: ButtonVariant;
  /** 36 / 44 / 56 px tall. Default 'lg'. */
  size?: ButtonSize;
  disabled?: boolean;
  /** Replaces the label with a spinner and disables the button. */
  loading?: boolean;
  /** Icon before / after the label; colour it with `buttonInk(variant, palette)`. */
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  /** Stretch to the parent's width. Default true. */
  block?: boolean;
  haptic?: PressHaptic;
  /** Default: the label. */
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

const HEIGHT: Record<ButtonSize, number> = { sm: 36, md: 44, lg: 56 };

/** The fill and ink a variant uses, for icons placed inside the button. */
export function buttonColors(variant: ButtonVariant, palette: Palette): { fill: string; ink: string; border: string } {
  switch (variant) {
    case 'primary':
      return { fill: palette.primary, ink: palette['primary-foreground'], border: 'transparent' };
    case 'secondary':
      return { fill: palette.secondary, ink: palette['secondary-foreground'], border: 'transparent' };
    case 'outline':
      return { fill: 'transparent', ink: palette.foreground, border: palette.border };
    case 'ghost':
      return { fill: 'transparent', ink: palette.primary, border: 'transparent' };
    case 'destructive':
      return { fill: palette.destructive, ink: palette['destructive-foreground'], border: 'transparent' };
  }
}

export default function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'lg',
  disabled = false,
  loading = false,
  leading,
  trailing,
  block = true,
  haptic = 'light',
  accessibilityLabel,
  style,
}: ButtonProps) {
  const palette = usePalette();
  const { fill, ink, border } = buttonColors(variant, palette);
  const height = HEIGHT[size];
  return (
    <Press
      onPress={onPress}
      disabled={disabled || loading}
      haptic={haptic}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ busy: loading }}
      style={[
        styles.button,
        { height, backgroundColor: fill, borderColor: border, paddingHorizontal: size === 'sm' ? space[4] : space[6] },
        variant === 'outline' ? styles.outlined : null,
        block ? styles.block : null,
        style,
      ]}
    >
      <View style={styles.row}>
        {loading ? (
          <ActivityIndicator color={ink} />
        ) : (
          <>
            {leading !== undefined ? <View style={styles.leading}>{leading}</View> : null}
            <Text numberOfLines={1} style={[styles.label, size === 'sm' ? styles.labelSm : null, { color: ink }]}>
              {label}
            </Text>
            {trailing !== undefined ? <View style={styles.trailing}>{trailing}</View> : null}
          </>
        )}
      </View>
    </Press>
  );
}

const styles = StyleSheet.create({
  button: { borderRadius: radius.full, alignItems: 'center', justifyContent: 'center', borderWidth: 0 },
  outlined: { borderWidth: StyleSheet.hairlineWidth * 2 },
  block: { alignSelf: 'stretch' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  leading: { marginRight: space[2] },
  trailing: { marginLeft: space[2] },
  label: { fontSize: text.base.fontSize, lineHeight: text.base.lineHeight, fontWeight: fontWeight.semibold },
  labelSm: { fontSize: text.sm.fontSize, lineHeight: text.sm.lineHeight },
});
