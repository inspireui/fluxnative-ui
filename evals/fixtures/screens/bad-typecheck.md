```tsx
import React from 'react';
import { Text, View } from 'react-native';
import Button from '../components/Button';
import { space, text } from '../theme/tokens';
import { usePalette } from '../theme/usePalette';

type PreviewState = 'live' | 'loading' | 'empty' | 'error';

const PRODUCTS = [{ name: 'Linen overshirt', price: 89 }];

export default function CatalogGridScreen({ previewState = 'live' }: { previewState?: PreviewState }) {
  const palette = usePalette();
  const first = PRODUCTS[0];
  return (
    <View style={{ padding: space[4], backgroundColor: palette.background }}>
      <Text style={{ color: palette.foreground, fontSize: text.lg.fontSize }}>{first.name}</Text>
      <Button label={previewState === 'error' ? 'Try again' : 'Shop'} variant="danger" onPress={() => undefined} />
    </View>
  );
}
```
