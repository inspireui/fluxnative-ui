import '../global.css';
import '@fluxnative/glass/expo';

import React from 'react';
import { useColorScheme } from 'react-native';
import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { FluxNativeProvider, type StyleEngine } from '@fluxnative/ui';
import { FluxStack } from '@fluxnative/ui/expo-router';

// `EXPO_PUBLIC_STYLE_ENGINE=runtime npx expo start` resolves the library's
// classes in JS (the engine the Flux WebView uses) instead of through Uniwind.
const styleEngine: StyleEngine = process.env.EXPO_PUBLIC_STYLE_ENGINE === 'runtime' ? 'runtime' : 'uniwind';

export default function RootLayout() {
  const dark = useColorScheme() === 'dark';
  return (
    <FluxNativeProvider styleEngine={styleEngine}>
      <ThemeProvider value={dark ? DarkTheme : DefaultTheme}>
        <StatusBar style="auto" />
        <FluxStack>
          <FluxStack.Screen name="(tabs)" />
          <FluxStack.Screen name="detail" />
        </FluxStack>
      </ThemeProvider>
    </FluxNativeProvider>
  );
}
