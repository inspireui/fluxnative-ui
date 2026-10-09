// A conversation anchored to the bottom. The list keeps chronological order
// (oldest first), so screen readers read it in that order on every
// platform (an inverted list reads newest first on Android and the web),
// and sticks to the latest message: while the reader is there, a streaming
// reply or a new message scrolls into view. Once they scroll up, the list
// stays where they are (new text grows below them) and shows a "Jump to
// latest" button; a new user message brings it back down. Messages added
// after mount fade in (Reveal; Reduce Motion snaps). Each message is one
// screen-reader element that starts with its speaker.

import React, { useEffect, useRef, useState } from 'react';
import {
  FlatList,
  Platform,
  StyleSheet,
  Text,
  View,
  type ListRenderItemInfo,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { elevation, layout, shape, space, type } from '../theme/tokens';
import { usePalette } from '../theme/usePalette';
import Icon from './Icon';
import IconButton, { iconButtonInk } from './IconButton';
import Reveal from './Reveal';
import StreamingText from './StreamingText';
import { stripMarkdown } from './markdown';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
}

export interface MessageListProps<M extends ChatMessage = ChatMessage> {
  /** Oldest first, as `useAiChat` returns them. Extra fields ride along to `renderMessage`. */
  messages: readonly M[];
  /** The message a reply is streaming into (`useAiChat().streamingId`). */
  streamingId?: string | null;
  /** Draws one message (a structured result card, a copy button); use `MessageBubble` for the plain ones. */
  renderMessage?: (message: M, info: { index: number; streaming: boolean }) => React.ReactNode;
  /** Shown instead of the list while there are no messages: a greeting and suggestion chips. */
  emptyState?: React.ReactNode;
  /** Under the latest message, scrolling with it: an inline error with Retry, a quota notice. */
  footer?: React.ReactNode;
  /** Called when the reader is back at the latest message after scrolling away (by hand or with the jump button). */
  onScrollToEnd?: () => void;
  /** Screen-reader name of the user's messages. Default 'You'. */
  userLabel?: string;
  /** Screen-reader name of the assistant's messages (its name). Default 'Assistant'. */
  assistantLabel?: string;
  /** Default 'Jump to latest'. */
  jumpLabel?: string;
  style?: StyleProp<ViewStyle>;
}

export interface MessageBubbleProps {
  message: ChatMessage;
  /** The reply is still arriving: caret, busy, one announcement at the end. */
  streaming?: boolean;
  /** Screen-reader name of the speaker. Default 'You' or 'Assistant'. */
  speaker?: string;
  style?: StyleProp<ViewStyle>;
}

/** The default bubble: user right on `primary`, assistant left on `muted` with Markdown. */
export function MessageBubble({ message, streaming = false, speaker, style }: MessageBubbleProps) {
  const palette = usePalette();
  if (message.role === 'user') {
    return (
      <View style={[styles.bubble, styles.mine, { backgroundColor: palette.primary, borderRadius: shape.card }, style]}>
        <Text
          selectable
          accessibilityLabel={`${speaker ?? 'You'}: ${message.text}`}
          style={[type.body, { color: palette['primary-foreground'] }]}
        >
          {message.text}
        </Text>
      </View>
    );
  }
  return (
    <View style={[styles.bubble, styles.theirs, { backgroundColor: palette.muted, borderRadius: shape.card }, style]}>
      <StreamingText
        text={message.text}
        streaming={streaming}
        accessibilityLabel={`${speaker ?? 'Assistant'}: ${stripMarkdown(message.text, { open: streaming })}`}
      />
    </View>
  );
}

/** Within this many px of the end counts as "at the latest message". */
const NEAR_END = 48;
/** Rendered on mount, so a restored conversation opens at its end in one pass. */
const FIRST_BATCH = 50;

export default function MessageList<M extends ChatMessage = ChatMessage>({
  messages,
  streamingId = null,
  renderMessage,
  emptyState,
  footer,
  onScrollToEnd,
  userLabel = 'You',
  assistantLabel = 'Assistant',
  jumpLabel = 'Jump to latest',
  style,
}: MessageListProps<M>) {
  const palette = usePalette();
  const list = useRef<FlatList<M>>(null);
  const [atEnd, setAtEnd] = useState(true);
  const atEndRef = useRef(true);
  const onEndRef = useRef(onScrollToEnd);
  onEndRef.current = onScrollToEnd;
  // Messages that were there on mount appear at once; later ones fade in.
  const [initialIds] = useState(() => new Set(messages.map((message) => message.id)));
  const [firstBatch] = useState(() => Math.min(Math.max(messages.length, 10), FIRST_BATCH));

  // Measured sizes, not the list's cell estimates: a streaming cell grows
  // before the list re-measures it. Scrolls are instant, and the offset of
  // the last one is kept: its scroll event can arrive after more text did,
  // and must not read as "the reader scrolled away".
  const size = useRef({ content: 0, viewport: 0 });
  const pinned = useRef<number | null>(null);
  const toEnd = () => {
    const offset = Math.max(0, size.current.content - size.current.viewport);
    pinned.current = offset;
    list.current?.scrollToOffset({ offset, animated: false });
  };
  const markEnd = (value: boolean) => {
    if (atEndRef.current === value) return;
    atEndRef.current = value;
    setAtEnd(value);
    if (value) onEndRef.current?.();
  };
  // While the reader is at the latest message, growth (a delta, a new
  // message, a keyboard shrinking the list) keeps it in view.
  const follow = () => {
    if (atEndRef.current) toEnd();
  };

  let lastUser: string | null = null;
  for (let i = messages.length - 1; i >= 0 && lastUser === null; i -= 1) {
    const message = messages[i];
    if (message?.role === 'user') lastUser = message.id;
  }
  const lastUserRef = useRef(lastUser);
  useEffect(() => {
    if (lastUser === lastUserRef.current) return;
    lastUserRef.current = lastUser;
    if (lastUser === null || atEndRef.current) return;
    // The user just sent something: show it, and follow the reply.
    markEnd(true);
    toEnd();
  }, [lastUser]);

  if (messages.length === 0 && emptyState !== undefined) {
    return <View style={[styles.root, style]}>{emptyState}</View>;
  }

  const renderItem = ({ item, index }: ListRenderItemInfo<M>) => {
    const streaming = item.id === streamingId;
    const content =
      renderMessage !== undefined ? (
        renderMessage(item, { index, streaming })
      ) : (
        <MessageBubble message={item} streaming={streaming} speaker={item.role === 'user' ? userLabel : assistantLabel} />
      );
    const row = <View style={styles.row}>{content}</View>;
    return initialIds.has(item.id) ? row : <Reveal>{row}</Reveal>;
  };

  return (
    <View style={[styles.root, style]}>
      <FlatList
        ref={list}
        data={messages}
        keyExtractor={(message) => message.id}
        renderItem={renderItem}
        extraData={streamingId}
        ListFooterComponent={footer !== undefined ? <View style={styles.footer}>{footer}</View> : null}
        initialNumToRender={firstBatch}
        onContentSizeChange={(_width, height) => {
          size.current.content = height;
          follow();
        }}
        onLayout={(event) => {
          size.current.viewport = event.nativeEvent.layout.height;
          follow();
        }}
        onScroll={(event: NativeSyntheticEvent<NativeScrollEvent>) => {
          const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
          size.current = { content: contentSize.height, viewport: layoutMeasurement.height };
          if (pinned.current !== null && Math.abs(contentOffset.y - pinned.current) < 1) return;
          pinned.current = null;
          markEnd(contentSize.height - layoutMeasurement.height - contentOffset.y <= NEAR_END);
        }}
        scrollEventThrottle={16}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        contentContainerStyle={styles.content}
        style={styles.root}
      />
      {atEnd ? null : (
        <View pointerEvents="box-none" style={styles.jump}>
          <IconButton
            variant="tonal"
            size="sm"
            accessibilityLabel={jumpLabel}
            onPress={() => {
              markEnd(true);
              toEnd();
            }}
            style={elevation[2]}
          >
            <Icon name="arrow-down" size={18} color={iconButtonInk('tonal', palette)} />
          </IconButton>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  // flex-end: a short conversation sits on the bottom edge, by the composer.
  content: { flexGrow: 1, justifyContent: 'flex-end', paddingHorizontal: layout.gutter, paddingVertical: space[3] },
  row: { paddingVertical: space[1] },
  footer: { paddingTop: space[2] },
  bubble: { maxWidth: '88%', paddingHorizontal: space[4], paddingVertical: space['2.5'] },
  mine: { alignSelf: 'flex-end' },
  theirs: { alignSelf: 'flex-start' },
  jump: { position: 'absolute', left: 0, right: 0, bottom: space[3], alignItems: 'center' },
});
