```tsx
import React, { useRef, useState } from 'react';
import { Animated, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Chip from '../components/Chip';
import { fontWeight, radius, space, text } from '../theme/tokens';
import { usePalette } from '../theme/usePalette';

type PreviewState = 'live' | 'loading' | 'empty' | 'error';

function ScalePressable({ onPress, children, label }: { onPress: () => void; children: React.ReactNode; label: string }) {
  const scale = useRef(new Animated.Value(1)).current;
  const to = (value: number) => Animated.spring(scale, { toValue: value, useNativeDriver: true }).start();
  return (
    <Pressable onPress={onPress} onPressIn={() => to(0.96)} onPressOut={() => to(1)} accessibilityRole="button" accessibilityLabel={label}>
      <Animated.View style={{ transform: [{ scale }] }}>{children}</Animated.View>
    </Pressable>
  );
}

function EmptyState({ title }: { title: string }) {
  const palette = usePalette();
  return (
    <View style={styles.empty}>
      <Text style={[styles.heading, { color: palette.foreground }]}>{title}</Text>
    </View>
  );
}

export default function CatalogGridScreen({ previewState = 'live' }: { previewState?: PreviewState }) {
  const palette = usePalette();
  const [open, setOpen] = useState(false);
  if (previewState === 'empty') return <EmptyState title="Nothing here yet" />;
  return (
    <View style={[styles.screen, { backgroundColor: palette.background }]}>
      <Chip label="All" selected />
      <ScalePressable onPress={() => setOpen(true)} label="Open filters">
        <Text style={[styles.link, { color: palette.primary }]}>Filters</Text>
      </ScalePressable>
      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <View style={[styles.sheet, { backgroundColor: palette.card }]}>
          <Text style={[styles.heading, { color: palette.foreground }]}>Filters</Text>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: space[4], gap: space[3] },
  empty: { alignItems: 'center', padding: space[8] },
  heading: { fontSize: text.lg.fontSize, lineHeight: text.lg.lineHeight, fontWeight: fontWeight.semibold },
  link: { fontSize: text.base.fontSize, lineHeight: text.base.lineHeight },
  sheet: { marginTop: 'auto', padding: space[6], borderTopLeftRadius: radius['3xl'], borderTopRightRadius: radius['3xl'] },
});
```
