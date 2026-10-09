// A list section's title row: optional eyebrow, the title, and one text
// action on the right ("See all"). Text roles: `type.caps` (eyebrow),
// `type.title` and `type.label` (action).

import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { interaction, space, type } from '../theme/tokens';
import { usePalette } from '../theme/usePalette';
import Press from './Press';

export interface SectionHeaderProps {
  title: string;
  /** Small caps line above the title. */
  eyebrow?: string;
  /** Text action at the right edge; rendered only with `onAction`. */
  action?: string;
  onAction?: () => void;
  /** Default: the action text. Make it unique per screen. */
  actionLabel?: string;
  style?: StyleProp<ViewStyle>;
}

/** A text action is short: it always gets at least this much extra hit area, in px. */
const ACTION_SLOP = 8;

export default function SectionHeader({ title, eyebrow, action, onAction, actionLabel, style }: SectionHeaderProps) {
  const palette = usePalette();
  return (
    <View style={[styles.row, style]}>
      <View style={styles.text}>
        {eyebrow !== undefined ? (
          <Text style={[type.caps, styles.eyebrow, { color: palette['muted-foreground'] }]}>{eyebrow.toUpperCase()}</Text>
        ) : null}
        <Text accessibilityRole="header" numberOfLines={1} style={[type.title, { color: palette.foreground }]}>
          {title}
        </Text>
      </View>
      {action !== undefined && onAction !== undefined ? (
        <Press onPress={onAction} accessibilityLabel={actionLabel ?? action} hitSlop={Math.max(ACTION_SLOP, interaction.press.hitSlop)} activeScale={1}>
          <Text style={[type.label, { color: palette.primary }]}>{action}</Text>
        </Press>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', paddingVertical: space[2] },
  text: { flex: 1, marginRight: space[3] },
  eyebrow: { marginBottom: space[0.5] },
});
