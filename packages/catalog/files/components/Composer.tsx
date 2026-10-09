// The message field of a chat screen: a growing text field, optional
// attach/mic slots, and one button that sends, or stops the reply while it
// streams (same control, its label changes). Put it last in the screen's
// column, under the list. It keeps itself above the keyboard with core
// KeyboardAvoidingView (padding); pass `keyboardVerticalOffset` when a
// header sits above the screen, and don't wrap the screen in another one.

import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, TextInput, View, type StyleProp, type ViewStyle } from 'react-native';
import { radius, shape, space, type } from '../theme/tokens';
import { usePalette } from '../theme/usePalette';
import Icon from './Icon';
import IconButton, { iconButtonInk } from './IconButton';

export interface ComposerProps {
  value: string;
  onChangeText: (text: string) => void;
  /** Gets the trimmed text; clear `value` here. Not called for blank text. */
  onSend: (text: string) => void;
  /** Stops the reply; the button calls it while `streaming`. */
  onStop: () => void;
  /** A reply is streaming: the send button becomes the stop button. Typing still works. */
  streaming: boolean;
  /** No sending and no typing (out of quota, AI unavailable). Stop stays available while streaming. */
  disabled?: boolean;
  /** Also the field's screen-reader name. Default 'Message'. */
  placeholder?: string;
  /** Left of the field: an attach button. */
  leading?: React.ReactNode;
  /** Inside the field, before the send button: a mic button. */
  trailing?: React.ReactNode;
  /** Default 'Send'. */
  sendLabel?: string;
  /** Default 'Stop'. */
  stopLabel?: string;
  /** Distance from the top of the window to the top of the screen holding the Composer (a header's height). Default 0. */
  keyboardVerticalOffset?: number;
  /** Keep clear of the keyboard. Default true; false when something above already does. */
  avoidKeyboard?: boolean;
  style?: StyleProp<ViewStyle>;
}

const LINE = type.body.lineHeight;
const FIELD_PAD = space['2.5'];
const MIN_HEIGHT = LINE + FIELD_PAD * 2;
const MAX_HEIGHT = LINE * 5 + FIELD_PAD * 2;
// A native multiline field grows by itself; a web <textarea> is sized from its content.
const WEB = Platform.OS === 'web';

export default function Composer({
  value,
  onChangeText,
  onSend,
  onStop,
  streaming,
  disabled = false,
  placeholder = 'Message',
  leading,
  trailing,
  sendLabel = 'Send',
  stopLabel = 'Stop',
  keyboardVerticalOffset = 0,
  avoidKeyboard = true,
  style,
}: ComposerProps) {
  const palette = usePalette();
  const [contentHeight, setContentHeight] = useState(MIN_HEIGHT);
  const text = value.trim();
  const ink = iconButtonInk('filled', palette);
  const webHeight = value === '' ? MIN_HEIGHT : Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, contentHeight));
  return (
    <KeyboardAvoidingView
      behavior="padding"
      enabled={avoidKeyboard}
      keyboardVerticalOffset={keyboardVerticalOffset}
      style={[styles.bar, { backgroundColor: palette.background, borderTopColor: palette['border-soft'] }, style]}
    >
      <View style={styles.row}>
        {leading !== undefined ? <View style={styles.leading}>{leading}</View> : null}
        <View style={[styles.field, { backgroundColor: palette.muted, borderRadius: shape.field }, disabled ? styles.dimmed : null]}>
          <TextInput
            value={value}
            onChangeText={onChangeText}
            editable={!disabled}
            multiline
            placeholder={placeholder}
            placeholderTextColor={palette['muted-foreground']}
            selectionColor={palette.primary}
            underlineColorAndroid="transparent"
            accessibilityLabel={placeholder}
            accessibilityState={{ disabled }}
            onContentSizeChange={WEB ? (event) => setContentHeight(event.nativeEvent.contentSize.height) : undefined}
            style={[type.body, styles.input, { color: palette.foreground }, WEB ? { height: webHeight } : null]}
          />
          {trailing !== undefined ? <View style={styles.trailing}>{trailing}</View> : null}
          <IconButton
            variant="filled"
            size="sm"
            accessibilityLabel={streaming ? stopLabel : sendLabel}
            disabled={streaming ? false : disabled || text === ''}
            onPress={() => {
              if (streaming) onStop();
              else if (text !== '') onSend(text);
            }}
            style={styles.send}
          >
            {streaming ? <View style={[styles.stop, { backgroundColor: ink }]} /> : <Icon name="arrow-up" size={20} color={ink} />}
          </IconButton>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  bar: { borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: space[3], paddingVertical: space[2] },
  row: { flexDirection: 'row', alignItems: 'flex-end' },
  leading: { marginRight: space[2], marginBottom: space[1] },
  field: { flex: 1, flexDirection: 'row', alignItems: 'flex-end', paddingLeft: space[4], paddingRight: space[1] },
  dimmed: { opacity: 0.45 },
  input: {
    flex: 1,
    minHeight: MIN_HEIGHT,
    maxHeight: MAX_HEIGHT,
    paddingTop: FIELD_PAD,
    paddingBottom: FIELD_PAD,
    paddingHorizontal: 0,
  },
  trailing: { marginLeft: space[1], marginBottom: space[1] },
  send: { marginLeft: space[1], marginBottom: space[1] },
  stop: { width: space[3], height: space[3], borderRadius: radius.xs },
});
