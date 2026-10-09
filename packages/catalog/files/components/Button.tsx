// The text button. One closed set of variants and sizes so every CTA in a
// template looks like the same family. `lg` is the 56 px bottom-bar pill,
// `xl` the 60 px screen CTA. Corners are `shape.control`; the label is a
// `type` role (`labelRole`), by default `type.label` at the button's size.

import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { fontWeight, shape, space, text, type, type TypeRole } from '../theme/tokens';
import { usePalette, type Palette } from '../theme/usePalette';
import Press, { type PressHaptic } from './Press';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'xl';

export interface ButtonProps {
  label: string;
  onPress?: () => void;
  /** Default 'primary'. */
  variant?: ButtonVariant;
  /** 36 / 44 / 56 / 60 px tall (`buttonHeight`). Default 'lg'. */
  size?: ButtonSize;
  /**
   * The label's text role, used as it is (`'title'` for a louder CTA). Default:
   * `type.label` set at the button's size, semibold: 16/24, or 14/20 on `sm`.
   */
  labelRole?: TypeRole;
  disabled?: boolean;
  /** Replaces the label with a spinner and disables the button. */
  loading?: boolean;
  /** Icon before / after the label; colour it with `buttonColors(variant, palette).ink`. */
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  /** Stretch to the parent's width. Default true. */
  block?: boolean;
  haptic?: PressHaptic;
  /** Default: the label. */
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

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

/** Comp tokens `button.height.*`: each size's height in px. */
export const buttonHeight: { readonly [S in ButtonSize]: number } = {
  sm: 36,
  md: 44,
  lg: 56,
  xl: 60,
};

export default function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'lg',
  labelRole,
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
  const height = buttonHeight[size];
  const labelStyle = labelRole === undefined ? [type.label, size === 'sm' ? styles.labelSm : styles.label] : type[labelRole];
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
            <Text numberOfLines={1} style={[labelStyle, { color: ink }]}>
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
  button: { borderRadius: shape.control, alignItems: 'center', justifyContent: 'center', borderWidth: 0 },
  outlined: { borderWidth: StyleSheet.hairlineWidth * 2 },
  block: { alignSelf: 'stretch' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  leading: { marginRight: space[2] },
  trailing: { marginLeft: space[2] },
  // Comp tokens: the default label is `type.label` at the button's size, semibold.
  label: { fontSize: text.base.fontSize, lineHeight: text.base.lineHeight, fontWeight: fontWeight.semibold },
  labelSm: { fontSize: text.sm.fontSize, lineHeight: text.sm.lineHeight, fontWeight: fontWeight.semibold },
});
