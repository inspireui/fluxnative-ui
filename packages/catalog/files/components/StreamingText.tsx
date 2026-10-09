// Text that is still arriving: an AI reply, an image description. Reads a
// small Markdown subset (bold, italic, `code`, lists, headings, code
// blocks) and shows a caret while `streaming`. Screen readers never get
// the deltas: the live region stays off, the element is marked busy, and
// the finished text is announced once when streaming ends. Reduce Motion
// holds the caret still. Copy (long-press select) works once it is done.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Platform, StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { fontWeight, shape, space, type, type ColorName, type TypeRole } from '../theme/tokens';
import { usePalette } from '../theme/usePalette';
import { parseMarkdown, plainText, type MarkdownBlock, type MarkdownSpan } from './markdown';
import useReducedMotion from './useReducedMotion';

export interface StreamingTextProps {
  text: string;
  /** True while more text may arrive: shows the caret, marks the text busy and holds the announcement. */
  streaming: boolean;
  /** Text role. Default 'body'. */
  role?: TypeRole;
  /** Palette role of the ink, for the surface underneath. Default 'foreground'. */
  color?: ColorName;
  /** Read the Markdown subset. Default true; false shows `text` exactly as given. */
  markdown?: boolean;
  /** What screen readers read and hear when streaming ends. Default: the text without Markdown. */
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

/** LEFT THREE EIGHTHS BLOCK, the usual streaming caret. */
const CARET = '\u258D';
const BLINK_MS = 530;
const MONO = Platform.select({ ios: 'Menlo', default: 'monospace' });

export default function StreamingText({
  text,
  streaming,
  role = 'body',
  color = 'foreground',
  markdown = true,
  accessibilityLabel,
  style,
}: StreamingTextProps) {
  const palette = usePalette();
  const reduced = useReducedMotion();
  const ink = palette[color];
  const blocks = useMemo<MarkdownBlock[]>(
    () => (markdown ? parseMarkdown(text, { open: streaming }) : [{ kind: 'paragraph', spans: [{ text }] }]),
    [text, streaming, markdown],
  );
  const label = accessibilityLabel ?? (markdown ? plainText(blocks) : text);

  const [caretOn, setCaretOn] = useState(true);
  useEffect(() => {
    setCaretOn(true);
    if (!streaming || reduced) return;
    const timer = setInterval(() => setCaretOn((on) => !on), BLINK_MS);
    return () => clearInterval(timer);
  }, [streaming, reduced]);

  // One announcement per stream, when it ends; never one per delta.
  const wasStreaming = useRef(streaming);
  useEffect(() => {
    if (wasStreaming.current && !streaming && label.trim() !== '') AccessibilityInfo.announceForAccessibility?.(label);
    wasStreaming.current = streaming;
  }, [streaming, label]);

  const base: StyleProp<TextStyle> = [type[role], { color: ink }];
  const caret = streaming ? <Text style={{ color: caretOn ? ink : 'transparent' }}>{CARET}</Text> : null;
  const spans = (items: MarkdownSpan[]) =>
    items.map((span, index) => (
      <Text
        key={index}
        style={[
          span.bold ? styles.bold : null,
          span.italic ? styles.italic : null,
          span.code ? [styles.code, { backgroundColor: palette.accent }] : null,
        ]}
      >
        {span.text}
      </Text>
    ));

  const last = blocks.length - 1;
  const body =
    blocks.length === 0 ? (
      <Text style={base}>{caret}</Text>
    ) : (
      blocks.map((block, index) => {
        const tail = index === last ? caret : null;
        const gap = index === 0 ? null : block.kind === 'item' && blocks[index - 1]?.kind === 'item' ? styles.itemGap : styles.blockGap;
        switch (block.kind) {
          case 'code':
            return (
              <View key={index} style={[styles.codeBlock, { backgroundColor: palette.accent, borderRadius: shape.well }, gap]}>
                <Text selectable={!streaming} style={[base, styles.mono]}>
                  {block.text}
                  {tail}
                </Text>
              </View>
            );
          case 'item':
            return (
              <View key={index} style={[styles.item, gap]}>
                <Text style={[base, styles.marker]}>{block.marker}</Text>
                <Text selectable={!streaming} style={[base, styles.itemText]}>
                  {spans(block.spans)}
                  {tail}
                </Text>
              </View>
            );
          case 'heading':
            return (
              <Text key={index} selectable={!streaming} style={[base, styles.heading, gap]}>
                {spans(block.spans)}
                {tail}
              </Text>
            );
          case 'paragraph':
            return (
              <Text key={index} selectable={!streaming} style={[base, gap]}>
                {spans(block.spans)}
                {tail}
              </Text>
            );
        }
      })
    );

  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel={label}
      aria-busy={streaming}
      aria-live="off"
      style={style}
    >
      {body}
    </View>
  );
}

const styles = StyleSheet.create({
  bold: { fontWeight: fontWeight.semibold },
  italic: { fontStyle: 'italic' },
  code: { fontFamily: MONO },
  mono: { fontFamily: MONO },
  heading: { fontWeight: type.title.fontWeight },
  blockGap: { marginTop: space[2] },
  itemGap: { marginTop: space[1] },
  item: { flexDirection: 'row' },
  marker: { minWidth: space[5] },
  itemText: { flex: 1 },
  codeBlock: { paddingHorizontal: space[3], paddingVertical: space[2] },
});
