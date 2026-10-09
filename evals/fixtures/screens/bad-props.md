```tsx
import React, { useState } from 'react';
import { View } from 'react-native';
import Button from '../components/Button';
import Chip from '../components/Chip';
import { space } from '../theme/tokens';
import { usePalette } from '../theme/usePalette';

type PreviewState = 'live' | 'loading' | 'empty' | 'error';

const CATEGORIES = ['All', 'Tops', 'Shoes'];

export default function CatalogGridScreen({ previewState = 'live' }: { previewState?: PreviewState }) {
  const palette = usePalette();
  const [category, setCategory] = useState('All');
  return (
    <View style={{ padding: space[4], gap: space[3], backgroundColor: palette.background }}>
      {CATEGORIES.map((c) => (
        <Chip key={c} label={c} active={c === category} onPress={() => setCategory(c)} />
      ))}
      <Button label="Apply" title="Apply filters" fullWidth onPress={() => undefined} disabled={previewState === 'loading'} />
    </View>
  );
}
```
