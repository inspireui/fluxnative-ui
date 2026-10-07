// A native stack whose screens' <AppBar> becomes the system navigation bar
// on iOS (Liquid Glass on iOS 26+, chrome-material blur before that). On
// Android and web the stack shows no header and AppBar draws its own glass.

import React, { type ReactNode } from 'react';
import { Platform } from 'react-native';
import { Stack } from 'expo-router';
import { NativeBarContext, useGlassEnvironment } from '@fluxnative/glass';
import { ChromeHostProvider, type NativeHeaderProps } from '../provider.tsx';

function NativeHeader({ title, largeTitle, leading, trailing }: NativeHeaderProps) {
  const { liquidGlassAvailable } = useGlassEnvironment();
  return (
    <Stack.Screen
      options={{
        headerShown: true,
        title,
        headerLargeTitleEnabled: largeTitle,
        headerShadowVisible: false,
        // A chevron only: the previous route's name is often a group like "(tabs)".
        headerBackButtonDisplayMode: 'minimal',
        // iOS 26 draws glass and the scroll-edge effect on a transparent bar;
        // earlier iOS needs the chrome material or content shows through raw.
        headerTransparent: true,
        headerBlurEffect: liquidGlassAvailable ? undefined : 'systemChromeMaterial',
        headerLeft: leading ? () => leading : undefined,
        headerRight: trailing ? () => trailing : undefined,
      }}
    />
  );
}

const NATIVE_HOST = { NativeHeader };
const NO_HOST = {};

function FluxStackRoot({ children }: { children?: ReactNode }) {
  const ios = Platform.OS === 'ios';
  return (
    <NativeBarContext.Provider value={ios}>
      <ChromeHostProvider value={ios ? NATIVE_HOST : NO_HOST}>
        <Stack screenOptions={{ headerShown: false }}>{children}</Stack>
      </ChromeHostProvider>
    </NativeBarContext.Provider>
  );
}

/** `<FluxStack.Screen name="…" />` passes through to Expo Router's Stack.Screen. */
export const FluxStack = Object.assign(FluxStackRoot, { Screen: Stack.Screen });
