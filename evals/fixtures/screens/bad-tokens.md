```tsx
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Chip from '../components/Chip';
import StateView from '../components/StateView';
import { space } from '../theme/tokens';
import { usePalette } from '../theme/usePalette';

type PreviewState = 'live' | 'loading' | 'empty' | 'error';

const CATEGORIES = ['All', 'Tops', 'Shoes'];
const CARD_RADIUS = 12;

export default function CatalogGridScreen({ previewState = 'live' }: { previewState?: PreviewState }) {
  const palette = usePalette();
  if (previewState === 'error') {
    return <StateView tone="error" title="Couldn't load new arrivals" actionLabel="Try again" onAction={() => undefined} />;
  }
  return (
    <ScrollView style={{ backgroundColor: palette.background }} contentContainerStyle={styles.content}>
      <Text style={styles.title}>New in</Text>
      <View style={styles.row}>
        {CATEGORIES.map((c) => (
          <Chip key={c} label={c} selected={c === 'All'} />
        ))}
      </View>
      <View style={[styles.card, { backgroundColor: 'white' }]} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: space[4], gap: space[4] },
  title: { fontSize: 28, lineHeight: 34, color: '#1A1A1A' },
  row: { flexDirection: 'row', gap: space[2] },
  card: { height: 120, borderRadius: CARD_RADIUS, borderColor: 'rgba(0, 0, 0, 0.1)', borderWidth: 1 },
});
```
