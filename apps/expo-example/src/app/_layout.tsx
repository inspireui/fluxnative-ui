import '../global.css';
import '@flux-ui/glass/expo';

import React from 'react';
import { useColorScheme } from 'react-native';
import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { FluxStack } from '@flux-ui/core/expo-router';

export default function RootLayout() {
  const dark = useColorScheme() === 'dark';
  return (
    <ThemeProvider value={dark ? DarkTheme : DefaultTheme}>
      <StatusBar style="auto" />
      <FluxStack>
        <FluxStack.Screen name="(tabs)" />
        <FluxStack.Screen name="detail" />
      </FluxStack>
    </ThemeProvider>
  );
}
