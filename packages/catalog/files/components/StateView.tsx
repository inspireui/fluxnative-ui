// Empty, error and offline states: an icon slot, a title, one line of
// body and one action. `variant="inline"` draws the same thing as a banner
// inside a list, `variant="card"` as the centred block on a card surface
// (`shape.card`); `badge` sets the icon in a tinted circle above the title.

import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { fontWeight, shape, space, text, type } from '../theme/tokens';
import { usePalette } from '../theme/usePalette';
import Button from './Button';

export type StateTone = 'neutral' | 'error';
export type StateVariant = 'inline' | 'card';

export interface StateViewProps {
  title: string;
  body?: string;
  /** Rendered as a button when `onAction` is set. */
  actionLabel?: string;
  onAction?: () => void;
  /** 'error' colours the title with `destructive`. Default 'neutral'. */
  tone?: StateTone;
  icon?: React.ReactNode;
  /** An icon drawn in an `accent` circle above the title, in place of `icon`; colour it `accent-foreground`. */
  badge?: React.ReactNode;
  /** 'inline': a banner inside content; 'card': the centred block on a card surface. Default: the centred block. */
  variant?: StateVariant;
  /** Same as `variant="inline"`. */
  inline?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** Comp token `stateView.badgeSize`: the circle behind `badge` in px, and its size in an inline banner. */
const BADGE = 76;
const BADGE_INLINE = 40;

export default function StateView({
  title,
  body,
  actionLabel,
  onAction,
  tone = 'neutral',
  icon,
  badge,
  variant,
  inline = false,
  style,
}: StateViewProps) {
  const palette = usePalette();
  const kind = variant ?? (inline ? 'inline' : 'block');
  const titleColor = tone === 'error' ? palette.destructive : kind === 'block' ? palette.foreground : palette['card-foreground'];
  const action =
    actionLabel !== undefined && onAction !== undefined ? (
      <Button label={actionLabel} onPress={onAction} variant={tone === 'error' ? 'primary' : 'secondary'} size="md" block={false} />
    ) : null;
  const mark = (size: number): React.ReactNode =>
    badge !== undefined ? (
      <View style={[styles.badge, { width: size, height: size, borderRadius: Math.min(shape.avatar, size / 2), backgroundColor: palette.accent }]}>
        {badge}
      </View>
    ) : (
      icon
    );

  if (kind === 'inline') {
    const lead = mark(BADGE_INLINE);
    return (
      <View
        accessibilityRole="alert"
        style={[styles.inline, { backgroundColor: palette.card, borderColor: palette.border }, style]}
      >
        {lead !== undefined ? <View style={styles.inlineIcon}>{lead}</View> : null}
        <View style={styles.inlineText}>
          <Text style={[type.title, styles.inlineTitle, { color: titleColor }]}>{title}</Text>
          {body !== undefined ? <Text style={[type.bodySm, styles.inlineBody, { color: palette['muted-foreground'] }]}>{body}</Text> : null}
        </View>
        {action !== null ? <View style={styles.inlineAction}>{action}</View> : null}
      </View>
    );
  }

  const lead = mark(BADGE);
  return (
    <View
      accessibilityRole="alert"
      style={[styles.block, kind === 'card' ? [styles.card, { backgroundColor: palette.card, borderColor: palette.border }] : null, style]}
    >
      {lead !== undefined ? <View style={styles.icon}>{lead}</View> : null}
      <Text style={[type.title, styles.title, { color: titleColor }]}>{title}</Text>
      {body !== undefined ? <Text style={[type.bodySm, styles.body, { color: palette['muted-foreground'] }]}>{body}</Text> : null}
      {action !== null ? <View style={styles.action}>{action}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { alignItems: 'center', paddingVertical: space[12], paddingHorizontal: space[8] },
  card: { paddingVertical: space[8], paddingHorizontal: space[6], borderRadius: shape.card, borderWidth: StyleSheet.hairlineWidth },
  icon: { marginBottom: space[4] },
  badge: { alignItems: 'center', justifyContent: 'center' },
  // Comp tokens: the title is `type.title` set at 18/28 semibold (16/24 in a banner), untracked.
  title: {
    fontSize: text.lg.fontSize,
    lineHeight: text.lg.lineHeight,
    fontWeight: fontWeight.semibold,
    letterSpacing: 0,
    textAlign: 'center',
  },
  body: { marginTop: space[2], textAlign: 'center' },
  action: { marginTop: space[6] },
  inline: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: space[4],
    borderRadius: shape.card,
    borderWidth: StyleSheet.hairlineWidth,
  },
  inlineIcon: { marginRight: space[3] },
  inlineText: { flex: 1 },
  inlineTitle: { fontSize: text.base.fontSize, lineHeight: text.base.lineHeight, fontWeight: fontWeight.semibold, letterSpacing: 0 },
  inlineBody: { marginTop: space[0.5] },
  inlineAction: { marginLeft: space[3] },
});
