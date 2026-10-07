// iOS: the system tab bar (UITabBarController) — Liquid Glass on iOS 26+,
// with minimize-on-scroll and the search role handled by the OS.

import React from 'react';
import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { NativeBarContext } from '@fluxnative/glass';
import { ChromeHostProvider, usePalette } from '../provider.tsx';
import { Tab, collectTabs, type FluxTabsProps } from './tabs-shared.ts';

const NO_HOST = {};

function FluxTabsRoot({ children, minimize = 'automatic' }: FluxTabsProps) {
  const palette = usePalette();
  const tabs = collectTabs(children);
  return (
    // A tab screen isn't inside a native stack, so its AppBar draws its own
    // glass. Wrap a tab in <FluxStack> to give it the native navigation bar.
    <NativeBarContext.Provider value={false}>
      <ChromeHostProvider value={NO_HOST}>
        <NativeTabs minimizeBehavior={minimize} tintColor={palette.primary}>
          {tabs.map((tab) => (
            <NativeTabs.Trigger key={tab.name} name={tab.name} role={tab.role}>
              <NativeTabs.Trigger.Label>{tab.label}</NativeTabs.Trigger.Label>
              {tab.sf ? <NativeTabs.Trigger.Icon sf={tab.sf as never} /> : null}
              {tab.badge !== undefined ? <NativeTabs.Trigger.Badge>{String(tab.badge)}</NativeTabs.Trigger.Badge> : null}
            </NativeTabs.Trigger>
          ))}
        </NativeTabs>
      </ChromeHostProvider>
    </NativeBarContext.Provider>
  );
}

export const FluxTabs = Object.assign(FluxTabsRoot, { Tab });
