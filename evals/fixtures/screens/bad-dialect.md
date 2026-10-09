```tsx
import React from 'react';
import { Text, View } from 'react-native';
import Button from '../components/Button';
import StateView from '../components/StateView';
import { space } from '../theme/tokens';
import { usePalette } from '../theme/usePalette';

type PreviewState = 'live' | 'loading' | 'empty' | 'error';

export default function CatalogGridScreen({ previewState = 'live' }: { previewState?: PreviewState }) {
  const palette = usePalette();
  if (previewState === 'error') return <StateView tone="error" title="Couldn't load new arrivals" />;
  return (
    <View style={{ padding: space[4], backgroundColor: palette.background }}>
      <div>
        <Text style={{ color: palette.foreground }}>New in</Text>
      </div>
      <Button
        label="Open the size guide"
        onPress={() => {
          window.location.href = 'https://example.com/size-guide';
        }}
      />
    </View>
  );
}
```
