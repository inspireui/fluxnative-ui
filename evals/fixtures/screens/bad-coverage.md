```tsx
import React, { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import Chip from '../components/Chip';
import Icon from '../components/Icon';
import { fontWeight, space, text } from '../theme/tokens';
import { usePalette } from '../theme/usePalette';

type PreviewState = 'live' | 'loading' | 'empty' | 'error';

const CATEGORIES = ['All', 'Tops', 'Bottoms', 'Shoes', 'Accessories'];

export default function CatalogGridScreen({ previewState = 'live' }: { previewState?: PreviewState }) {
  const palette = usePalette();
  const [category, setCategory] = useState('All');
  if (previewState === 'loading') return <ActivityIndicator color={palette.primary} />;
  return (
    <ScrollView style={{ backgroundColor: palette.background }} contentContainerStyle={styles.content}>
      <View style={styles.row}>
        <Text style={[styles.title, { color: palette.foreground }]}>New in</Text>
        <Icon name="sliders" size={22} color={palette.foreground} accessibilityLabel="Filters" />
      </View>
      <View style={styles.row}>
        {CATEGORIES.map((c) => (
          <Chip key={c} label={c} selected={c === category} onPress={() => setCategory(c)} />
        ))}
      </View>
      <Text style={[styles.body, { color: palette['muted-foreground'] }]}>
        {previewState === 'empty' ? 'No products yet.' : previewState === 'error' ? 'Something went wrong.' : 'Products coming soon.'}
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: space[4], gap: space[4] },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space[2] },
  title: { flex: 1, fontSize: text['2xl'].fontSize, lineHeight: text['2xl'].lineHeight, fontWeight: fontWeight.bold },
  body: { fontSize: text.sm.fontSize, lineHeight: text.sm.lineHeight },
});
```
