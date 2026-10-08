// A list section's title row: optional eyebrow, the title, and one text
// action on the right ("See all").

import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { fontWeight, space, text } from '../theme/tokens';
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

export default function SectionHeader({ title, eyebrow, action, onAction, actionLabel, style }: SectionHeaderProps) {
  const palette = usePalette();
  return (
    <View style={[styles.row, style]}>
      <View style={styles.text}>
        {eyebrow !== undefined ? (
          <Text style={[styles.eyebrow, { color: palette['muted-foreground'] }]}>{eyebrow.toUpperCase()}</Text>
        ) : null}
        <Text accessibilityRole="header" numberOfLines={1} style={[styles.title, { color: palette.foreground }]}>
          {title}
        </Text>
      </View>
      {action !== undefined && onAction !== undefined ? (
        <Press onPress={onAction} accessibilityLabel={actionLabel ?? action} hitSlop={8} activeScale={1}>
          <Text style={[styles.action, { color: palette.primary }]}>{action}</Text>
        </Press>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', paddingVertical: space[2] },
  text: { flex: 1, marginRight: space[3] },
  eyebrow: { fontSize: 11, lineHeight: 14, fontWeight: fontWeight.semibold, letterSpacing: 1.2, marginBottom: 2 },
  title: { fontSize: text.xl.fontSize, lineHeight: text.xl.lineHeight, fontWeight: fontWeight.bold, letterSpacing: -0.2 },
  action: { fontSize: text.sm.fontSize, lineHeight: text.sm.lineHeight, fontWeight: fontWeight.medium },
});
