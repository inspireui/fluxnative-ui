// Empty, error and offline states: an icon slot, a title, one line of
// body and one action. `inline` draws the same thing as a banner inside a
// list instead of a centred block.

import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { fontWeight, radius, space, text } from '../theme/tokens';
import { usePalette } from '../theme/usePalette';
import Button from './Button';

export type StateTone = 'neutral' | 'error';

export interface StateViewProps {
  title: string;
  body?: string;
  /** Rendered as a button when `onAction` is set. */
  actionLabel?: string;
  onAction?: () => void;
  /** 'error' colours the title with `destructive`. Default 'neutral'. */
  tone?: StateTone;
  icon?: React.ReactNode;
  /** Banner inside content instead of a centred block. */
  inline?: boolean;
  style?: StyleProp<ViewStyle>;
}

export default function StateView({ title, body, actionLabel, onAction, tone = 'neutral', icon, inline = false, style }: StateViewProps) {
  const palette = usePalette();
  const titleColor = tone === 'error' ? palette.destructive : palette.foreground;
  const action =
    actionLabel !== undefined && onAction !== undefined ? (
      <Button label={actionLabel} onPress={onAction} variant={tone === 'error' ? 'primary' : 'secondary'} size="md" block={false} />
    ) : null;

  if (inline) {
    return (
      <View
        accessibilityRole="alert"
        style={[styles.inline, { backgroundColor: palette.card, borderColor: palette.border }, style]}
      >
        {icon !== undefined ? <View style={styles.inlineIcon}>{icon}</View> : null}
        <View style={styles.inlineText}>
          <Text style={[styles.inlineTitle, { color: titleColor }]}>{title}</Text>
          {body !== undefined ? <Text style={[styles.inlineBody, { color: palette['muted-foreground'] }]}>{body}</Text> : null}
        </View>
        {action !== null ? <View style={styles.inlineAction}>{action}</View> : null}
      </View>
    );
  }

  return (
    <View accessibilityRole="alert" style={[styles.block, style]}>
      {icon !== undefined ? <View style={styles.icon}>{icon}</View> : null}
      <Text style={[styles.title, { color: titleColor }]}>{title}</Text>
      {body !== undefined ? <Text style={[styles.body, { color: palette['muted-foreground'] }]}>{body}</Text> : null}
      {action !== null ? <View style={styles.action}>{action}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { alignItems: 'center', paddingVertical: space[12], paddingHorizontal: space[8] },
  icon: { marginBottom: space[4] },
  title: {
    fontSize: text.lg.fontSize,
    lineHeight: text.lg.lineHeight,
    fontWeight: fontWeight.semibold,
    textAlign: 'center',
  },
  body: { marginTop: space[2], fontSize: text.sm.fontSize, lineHeight: text.sm.lineHeight, textAlign: 'center' },
  action: { marginTop: space[6] },
  inline: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: space[4],
    borderRadius: radius['2xl'],
    borderWidth: StyleSheet.hairlineWidth,
  },
  inlineIcon: { marginRight: space[3] },
  inlineText: { flex: 1 },
  inlineTitle: { fontSize: text.base.fontSize, lineHeight: text.base.lineHeight, fontWeight: fontWeight.semibold },
  inlineBody: { marginTop: 2, fontSize: text.sm.fontSize, lineHeight: text.sm.lineHeight },
  inlineAction: { marginLeft: space[3] },
});
