// Filter / option chip. Selected = inverted (foreground fill, background
// label). `round` makes a 44 px circle for sizes and swatches; `struck`
// crosses the label out for a sold-out option.

import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { fontWeight, radius, space, text } from '../theme/tokens';
import { usePalette } from '../theme/usePalette';
import Press, { type PressRole } from './Press';

export type ChipSize = 'sm' | 'md';

export interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  /** 32 or 36 px tall. Default 'md'. */
  size?: ChipSize;
  /** A 44 px circle instead of a pill. */
  round?: boolean;
  /** Cross the label out (unavailable option). */
  struck?: boolean;
  disabled?: boolean;
  /** Small icon or swatch before the label. */
  leading?: React.ReactNode;
  /** Default 'button'; 'radio' / 'checkbox' for single / multi select groups. */
  accessibilityRole?: Extract<PressRole, 'button' | 'radio' | 'checkbox' | 'tab'>;
  /** Default: the label. */
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

const HEIGHT: Record<ChipSize, number> = { sm: 32, md: 36 };
const ROUND = 44;

export default function Chip({
  label,
  selected = false,
  onPress,
  size = 'md',
  round = false,
  struck = false,
  disabled = false,
  leading,
  accessibilityRole = 'button',
  accessibilityLabel,
  style,
}: ChipProps) {
  const palette = usePalette();
  const fill = selected ? palette.foreground : palette.secondary;
  const ink = selected ? palette.background : palette.foreground;
  const state = accessibilityRole === 'button' ? { selected } : { checked: selected };
  return (
    <Press
      onPress={onPress}
      disabled={disabled}
      haptic="selection"
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={state}
      style={[
        styles.chip,
        round ? styles.round : { height: HEIGHT[size], paddingHorizontal: size === 'sm' ? space[3] : space[4] },
        { backgroundColor: fill },
        style,
      ]}
    >
      <View style={styles.row}>
        {leading !== undefined ? <View style={styles.leading}>{leading}</View> : null}
        <Text
          numberOfLines={1}
          style={[
            styles.label,
            size === 'sm' ? styles.labelSm : null,
            { color: ink },
            struck ? styles.struck : null,
          ]}
        >
          {label}
        </Text>
      </View>
    </Press>
  );
}

const styles = StyleSheet.create({
  chip: { borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  round: { width: ROUND, height: ROUND },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  leading: { marginRight: space[2] },
  label: { fontSize: text.sm.fontSize, lineHeight: text.sm.lineHeight, fontWeight: fontWeight.medium },
  labelSm: { fontSize: text.xs.fontSize, lineHeight: text.xs.lineHeight },
  struck: { textDecorationLine: 'line-through', opacity: 0.55 },
});
