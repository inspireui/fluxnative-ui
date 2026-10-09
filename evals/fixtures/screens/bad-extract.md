Here's the screen:

```tsx
import React from 'react';
import { Text, View } from 'react-native';
import { space, text } from '../theme/tokens';
import { usePalette } from '../theme/usePalette';

type PreviewState = 'live' | 'loading' | 'empty' | 'error';

export default function CatalogGridScreen({ previewState = 'live' }: { previewState?: PreviewState }) {
  const palette = usePalette();
  return (
    <View style={{ padding: space[4], backgroundColor: palette.background }}>
      <Text style={{ color: palette.foreground, fontSize: text.lg.fontSize, lineHeight: text.lg.lineHeight }}>{previewState}</Text>
    </View>
  );
}
```

And register it in `App.tsx`:

```tsx
import CatalogGridScreen from './screens/CatalogGridScreen';
export default CatalogGridScreen;
```
