```tsx
import React, { useEffect, useRef, useState } from 'react';
import { Animated, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Button from '../components/Button';
import Chip from '../components/Chip';
import Icon from '../components/Icon';
import IconButton, { iconButtonInk } from '../components/IconButton';
import Reveal from '../components/Reveal';
import Skeleton from '../components/Skeleton';
import StateView from '../components/StateView';
import useReducedMotion from '../components/useReducedMotion';
import { duration, fontWeight, radius, space, text } from '../theme/tokens';
import { usePalette } from '../theme/usePalette';

type PreviewState = 'live' | 'loading' | 'empty' | 'error' | 'streaming' | 'quota';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  text: string;
}

const CONVERSATION: Message[] = [
  { id: 'm1', role: 'user', text: 'Plan a relaxed weekend in Kyoto for two.' },
  {
    id: 'm2',
    role: 'assistant',
    text: 'Saturday: Fushimi Inari before 8 am to beat the crowds, then Nishiki Market for lunch and an afternoon in Gion. Sunday: Arashiyama bamboo grove early, a boat on the Hozu river, and tea at Okochi Sanso.',
  },
  { id: 'm3', role: 'user', text: 'Add a good place for dinner on Saturday?' },
  { id: 'm4', role: 'assistant', text: 'Book a kaiseki counter in Pontocho Alley for 7 pm; ask for a seat facing the Kamo river.' },
];

const STREAMING_REPLY = 'Book a kaiseki counter in Pontocho Alley for 7 pm, and ask for';
const SUGGESTIONS = ['Plan a trip', 'Summarise an article', 'Draft an email', 'Explain a concept'];
const DAILY_LIMIT = 20;
const USED_TODAY = 6;

function Caret({ color }: { color: string }) {
  const reduced = useReducedMotion();
  const opacity = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (reduced) {
      opacity.setValue(1);
      return;
    }
    const blink = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0, duration: duration.slow, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: duration.slow, useNativeDriver: true }),
      ]),
    );
    blink.start();
    return () => blink.stop();
  }, [opacity, reduced]);
  return <Animated.Text style={{ color, opacity }}>{' ▍'}</Animated.Text>;
}

function Bubble({ message, index }: { message: Message; index: number }) {
  const palette = usePalette();
  const mine = message.role === 'user';
  return (
    <Reveal index={index} style={[styles.row, mine ? styles.rowMine : null]}>
      <View style={[styles.bubble, { backgroundColor: mine ? palette.primary : palette.muted }]}>
        <Text style={[styles.bubbleText, { color: mine ? palette['primary-foreground'] : palette.foreground }]}>{message.text}</Text>
      </View>
      {mine ? null : (
        <IconButton size="sm" accessibilityLabel="Copy reply" onPress={() => undefined}>
          <Icon name="copy" size={16} color={palette['muted-foreground']} />
        </IconButton>
      )}
    </Reveal>
  );
}

function LoadingHistory() {
  return (
    <View style={styles.loading}>
      <Skeleton width="60%" height={44} radius={radius['2xl']} style={styles.alignEnd} />
      <Skeleton width="85%" height={96} radius={radius['2xl']} />
      <Skeleton width="50%" height={44} radius={radius['2xl']} style={styles.alignEnd} />
    </View>
  );
}

export default function AiChatScreen({ previewState = 'live' }: { previewState?: PreviewState }) {
  const palette = usePalette();
  const [draft, setDraft] = useState('');
  const streaming = previewState === 'streaming';
  const quota = previewState === 'quota';
  const messages =
    previewState === 'loading' || previewState === 'empty'
      ? []
      : streaming || previewState === 'error'
        ? CONVERSATION.slice(0, 3)
        : CONVERSATION;
  const left = quota ? 0 : DAILY_LIMIT - USED_TODAY;
  const ink = iconButtonInk('filled', palette);

  return (
    <KeyboardAvoidingView
      style={[styles.screen, { backgroundColor: palette.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.header, { borderBottomColor: palette.border }]}>
        <Icon name="sparkle" size={20} color={palette.primary} />
        <Text accessibilityRole="header" style={[styles.title, { color: palette.foreground }]}>
          Nova
        </Text>
        <Text style={[styles.meta, { color: palette['muted-foreground'] }]}>
          {left} of {DAILY_LIMIT} messages left today
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.list}>
        {previewState === 'loading' ? <LoadingHistory /> : null}
        {previewState === 'empty' ? (
          <View style={styles.greeting}>
            <Icon name="sparkle" size={32} color={palette.primary} />
            <Text style={[styles.greetingTitle, { color: palette.foreground }]}>Hi, I'm Nova</Text>
            <Text style={[styles.meta, { color: palette['muted-foreground'] }]}>Ask me anything, or start with one of these.</Text>
            <View style={styles.suggestions}>
              {SUGGESTIONS.map((s) => (
                <Chip key={s} label={s} onPress={() => setDraft(s)} />
              ))}
            </View>
          </View>
        ) : null}
        {messages.map((message, index) => (
          <Bubble key={message.id} message={message} index={index} />
        ))}
        {streaming ? (
          <View style={styles.row}>
            <View style={[styles.bubble, { backgroundColor: palette.muted }]}>
              <Text style={[styles.bubbleText, { color: palette.foreground }]}>
                {STREAMING_REPLY}
                <Caret color={palette.foreground} />
              </Text>
            </View>
          </View>
        ) : null}
        {previewState === 'error' ? (
          <StateView
            inline
            tone="error"
            title="Nova couldn't reply"
            body="The connection dropped before the answer finished."
            actionLabel="Retry"
            onAction={() => undefined}
            icon={<Icon name="alert" size={20} color={palette.destructive} />}
          />
        ) : null}
      </ScrollView>

      {quota ? (
        <View style={[styles.quota, { borderTopColor: palette.border }]}>
          <StateView
            inline
            title={`You've used today's ${DAILY_LIMIT} messages`}
            body="Upgrade for unlimited messages, or come back tomorrow."
            icon={<Icon name="lock" size={20} color={palette['muted-foreground']} />}
          />
          <Button label="Upgrade" onPress={() => undefined} />
        </View>
      ) : null}

      <View style={[styles.composer, { borderTopColor: palette.border }]}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          editable={!quota}
          multiline
          placeholder={quota ? 'Daily limit reached' : 'Message Nova'}
          placeholderTextColor={palette['muted-foreground']}
          accessibilityLabel="Message"
          style={[styles.input, { color: palette.foreground, backgroundColor: palette.muted }]}
        />
        {streaming ? (
          <IconButton variant="filled" accessibilityLabel="Stop generating" onPress={() => undefined}>
            <Icon name="pause" size={20} color={ink} filled />
          </IconButton>
        ) : (
          <IconButton
            variant="filled"
            accessibilityLabel="Send message"
            disabled={quota || draft.trim() === ''}
            onPress={() => setDraft('')}
          >
            <Icon name="send" size={20} color={ink} />
          </IconButton>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    paddingHorizontal: space[4],
    paddingVertical: space[3],
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: { fontSize: text.lg.fontSize, lineHeight: text.lg.lineHeight, fontWeight: fontWeight.semibold },
  meta: { flexShrink: 1, fontSize: text.sm.fontSize, lineHeight: text.sm.lineHeight },
  list: { padding: space[4], gap: space[3] },
  loading: { gap: space[3] },
  alignEnd: { alignSelf: 'flex-end' },
  greeting: { alignItems: 'center', gap: space[2], paddingVertical: space[12] },
  greetingTitle: { fontSize: text['2xl'].fontSize, lineHeight: text['2xl'].lineHeight, fontWeight: fontWeight.bold },
  suggestions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: space[2], marginTop: space[4] },
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: space[1] },
  rowMine: { justifyContent: 'flex-end' },
  bubble: { maxWidth: '80%', paddingHorizontal: space[4], paddingVertical: space[3], borderRadius: radius['2xl'] },
  bubbleText: { fontSize: text.base.fontSize, lineHeight: text.base.lineHeight },
  quota: { gap: space[3], padding: space[4], borderTopWidth: StyleSheet.hairlineWidth },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: space[2],
    padding: space[3],
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  input: {
    flex: 1,
    minHeight: space[11],
    maxHeight: space[32],
    paddingHorizontal: space[4],
    paddingVertical: space[2.5],
    borderRadius: radius['2xl'],
    fontSize: text.base.fontSize,
  },
});
```
