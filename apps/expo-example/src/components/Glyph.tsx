// Tiny drawn glyphs so the example needs no icon font. A real app would use
// expo-symbols / an icon set; FluxNative UI takes any ReactNode as an icon.

import React from 'react';
import { View } from 'react-native';

type Name = 'discover' | 'library' | 'settings' | 'search' | 'back';

export function Glyph({ name, color, size = 20 }: { name: Name; color: string; size?: number }) {
  const s = size;
  switch (name) {
    case 'discover':
      return (
        <View style={{ width: s, height: s, alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ width: s * 0.7, height: s * 0.7, borderRadius: s, borderWidth: 2, borderColor: color }} />
          <View style={{ position: 'absolute', width: s * 0.22, height: s * 0.22, borderRadius: s, backgroundColor: color }} />
        </View>
      );
    case 'library':
      return (
        <View style={{ width: s, height: s, justifyContent: 'center', gap: 3 }}>
          {[0.9, 0.75, 0.6].map((w) => (
            <View key={w} style={{ width: s * w, height: 2.5, borderRadius: 2, backgroundColor: color }} />
          ))}
        </View>
      );
    case 'settings':
      return (
        <View style={{ width: s, height: s, alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ width: s * 0.78, height: s * 0.78, borderRadius: s * 0.25, borderWidth: 2, borderColor: color, transform: [{ rotate: '45deg' }] }} />
          <View style={{ position: 'absolute', width: s * 0.28, height: s * 0.28, borderRadius: s, borderWidth: 2, borderColor: color }} />
        </View>
      );
    case 'search':
      return (
        <View style={{ width: s, height: s }}>
          <View style={{ width: s * 0.62, height: s * 0.62, borderRadius: s, borderWidth: 2, borderColor: color }} />
          <View style={{ position: 'absolute', right: s * 0.08, bottom: s * 0.12, width: s * 0.34, height: 2.5, borderRadius: 2, backgroundColor: color, transform: [{ rotate: '45deg' }] }} />
        </View>
      );
    case 'back':
      return (
        <View style={{ width: s, height: s, justifyContent: 'center', paddingLeft: s * 0.3 }}>
          <View style={{ width: s * 0.45, height: s * 0.45, borderLeftWidth: 2.5, borderBottomWidth: 2.5, borderColor: color, transform: [{ rotate: '45deg' }] }} />
        </View>
      );
  }
}
