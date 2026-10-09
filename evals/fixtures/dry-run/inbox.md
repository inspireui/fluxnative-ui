I'll build the inbox with a filter row, the conversation list and a long-press action sheet.

```typescript
import React, { useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Chip from '../components/Chip';
import Icon from '../components/Icon';
import IconButton, { iconButtonInk } from '../components/IconButton';
import Press from '../components/Press';
import Reveal from '../components/Reveal';
import Sheet from '../components/Sheet';
import Skeleton from '../components/Skeleton';
import StateView from '../components/StateView';
import Button from '../components/Button';
import { fontWeight, radius, space, text } from '../theme/tokens';
import { usePalette } from '../theme/usePalette';

type PreviewState = 'live' | 'loading' | 'empty' | 'error';
type Filter = 'All' | 'Unread' | 'Mentions';

interface Conversation {
  id: string;
  name: string;
  preview: string;
  time: string;
  unread: number;
  mention: boolean;
  muted: boolean;
}

const FILTERS: Filter[] = ['All', 'Unread', 'Mentions'];

const CONVERSATIONS: Conversation[] = [
  { id: 'c1', name: 'Design crit', preview: 'Linh: the new onboarding flow is up', time: '9:41', unread: 3, mention: true, muted: false },
  { id: 'c2', name: 'Bao Nguyen', preview: 'Can you review the PR before lunch?', time: '9:12', unread: 1, mention: false, muted: false },
  { id: 'c3', name: 'Release train', preview: 'v2.4 is rolling out to 10%', time: '8:30', unread: 2, mention: false, muted: false },
  { id: 'c4', name: 'Hana Sato', preview: 'Thanks, that fixed it', time: 'Yesterday', unread: 0, mention: false, muted: false },
  { id: 'c5', name: 'Random', preview: 'Who took the last oat milk', time: 'Yesterday', unread: 0, mention: false, muted: true },
  { id: 'c6', name: 'Quang Le', preview: 'See you at standup', time: 'Mon', unread: 0, mention: false, muted: false },
  { id: 'c7', name: 'Support rota', preview: 'You are on call next week', time: 'Mon', unread: 0, mention: false, muted: true },
  { id: 'c8', name: 'Mai Tran', preview: 'Sent the deck', time: 'Sun', unread: 0, mention: false, muted: false },
];

function initials(name: string): string {
  return name
    .split(' ')
    .map((part) => part.charAt(0))
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export default function InboxScreen({ previewState = 'live' }: { previewState?: PreviewState }) {
  const palette = usePalette();
  const navigation = useNavigation();
  const [filter, setFilter] = useState<Filter>('All');
  const [actionsFor, setActionsFor] = useState<Conversation | null>(null);

  const visible =
    previewState === 'empty'
      ? []
      : CONVERSATIONS.filter((c) => (filter === 'Unread' ? c.unread > 0 : filter === 'Mentions' ? c.mention : true));

  let content: React.ReactNode;
  if (previewState === 'loading') {
    content = [0, 1, 2, 3, 4].map((i) => <Skeleton key={i} height={56} />);
  } else if (previewState === 'error') {
    content = <StateView tone="error" title="Messages didn't load" actionLabel="Try again" onAction={() => undefined} />;
  } else if (visible.length === 0) {
    content = <StateView title="Nothing here" body="No conversations match this filter." actionLabel="Start a conversation" onAction={() => undefined} />;
  } else {
    content = (
      <FlatList
        data={visible}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => (
          <Reveal index={index}>
            <Press
              onPress={() => navigation.goBack()}
              onLongPress={() => setActionsFor(item)}
              accessibilityLabel={`${item.name}: ${item.preview}, ${item.time}${item.unread ? `, ${item.unread} unread` : ''}`}
            >
              <View style={[styles.row, item.muted ? styles.muted : null]}>
                <View style={[styles.avatar, { backgroundColor: palette.secondary }]}>
                  <Text style={[styles.avatarText, { color: palette['secondary-foreground'] }]}>{initials(item.name)}</Text>
                </View>
                <View style={styles.grow}>
                  <Text numberOfLines={1} style={[styles.name, { color: palette.foreground }, item.unread ? styles.unread : null]}>
                    {item.name}
                  </Text>
                  <Text numberOfLines={1} style={[styles.preview, { color: palette['muted-foreground'] }]}>
                    {item.preview}
                  </Text>
                </View>
                <View style={styles.meta}>
                  <Text style={[styles.preview, { color: palette['muted-foreground'] }]}>{item.time}</Text>
                  {item.unread ? (
                    <View style={[styles.badge, { backgroundColor: palette.primary }]}>
                      <Text style={[styles.badgeText, { color: palette['primary-foreground'] }]}>{item.unread}</Text>
                    </View>
                  ) : null}
                </View>
              </View>
            </Press>
          </Reveal>
        )}
      />
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: palette.background }]}>
      <View style={styles.header}>
        <Text accessibilityRole="header" style={[styles.title, { color: palette.foreground }]}>
          Inbox
        </Text>
        <IconButton variant="filled" accessibilityLabel="New message" onPress={() => undefined}>
          <Icon name="pencil" size={20} color={iconButtonInk('filled', palette)} />
        </IconButton>
      </View>
      <View style={styles.filters}>
        {FILTERS.map((f) => (
          <Chip key={f} label={f} selected={f === filter} onPress={() => setFilter(f)} accessibilityRole="radio" />
        ))}
      </View>
      {content}
      <Sheet open={actionsFor !== null} onClose={() => setActionsFor(null)} title={actionsFor?.name ?? ''}>
        <Button label="Mark as read" variant="ghost" onPress={() => setActionsFor(null)} />
        <Button label="Mute" variant="ghost" onPress={() => setActionsFor(null)} />
        <Button label="Archive" variant="ghost" onPress={() => setActionsFor(null)} />
        <Button label="Delete" variant="destructive" onPress={() => setActionsFor(null)} />
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: space[4], paddingTop: space[6], gap: space[3] },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: text['3xl'].fontSize, lineHeight: text['3xl'].lineHeight, fontWeight: fontWeight.bold },
  filters: { flexDirection: 'row', gap: space[2] },
  row: { flexDirection: 'row', alignItems: 'center', gap: space[3], paddingVertical: space[3] },
  muted: { opacity: 0.5 },
  avatar: { width: space[11], height: space[11], borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: text.sm.fontSize, fontWeight: fontWeight.semibold },
  grow: { flex: 1 },
  name: { fontSize: text.base.fontSize, lineHeight: text.base.lineHeight },
  unread: { fontWeight: fontWeight.bold },
  preview: { fontSize: text.sm.fontSize, lineHeight: text.sm.lineHeight },
  meta: { alignItems: 'flex-end', gap: space[1] },
  badge: { minWidth: space[5], height: space[5], paddingHorizontal: space[1.5], borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontSize: text.xs.fontSize, fontWeight: fontWeight.bold },
});
```

Long-press a row to open the action sheet.
