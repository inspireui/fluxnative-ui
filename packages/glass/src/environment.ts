// Reads the device side of the glass ladder once and keeps it live: the
// accessibility settings that force `opaque`, and what the registered
// adapter can draw. One shared subscription serves every glass surface.

import { createContext, useContext, useSyncExternalStore } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';
import { getGlassAdapter, subscribeGlassAdapter } from './adapter.ts';
import type { GlassEnvironment } from './tiers.ts';

interface A11y {
  reduceTransparency: boolean;
  increaseContrast: boolean;
}

let a11y: A11y = { reduceTransparency: false, increaseContrast: false };
const listeners = new Set<() => void>();
let started = false;

function set(patch: Partial<A11y>) {
  const next = { ...a11y, ...patch };
  if (next.reduceTransparency === a11y.reduceTransparency && next.increaseContrast === a11y.increaseContrast) return;
  a11y = next;
  for (const listener of listeners) listener();
}

// AccessibilityInfo grew these methods across React Native releases and
// react-native-web stubs some of them, so each one is feature-checked.
type Info = typeof AccessibilityInfo & {
  isDarkerSystemColorsEnabled?: () => Promise<boolean>;
  isHighTextContrastEnabled?: () => Promise<boolean>;
};

function start() {
  if (started) return;
  started = true;
  const info = AccessibilityInfo as Info;
  const watch = (
    read: (() => Promise<boolean>) | undefined,
    event: string,
    key: keyof A11y,
  ) => {
    if (typeof read !== 'function') return;
    read.call(info).then((on) => set({ [key]: on }), () => {});
    try {
      // Event names are typed per platform; an unknown one is a no-op.
      (info.addEventListener as (e: string, h: (on: boolean) => void) => unknown)(event, (on) =>
        set({ [key]: on }),
      );
    } catch {
      // Older runtimes throw on events they don't know.
    }
  };
  watch(info.isReduceTransparencyEnabled, 'reduceTransparencyChanged', 'reduceTransparency');
  if (Platform.OS === 'ios') {
    watch(info.isDarkerSystemColorsEnabled, 'darkerSystemColorsChanged', 'increaseContrast');
  } else if (Platform.OS === 'android') {
    watch(info.isHighTextContrastEnabled, 'highTextContrastChanged', 'increaseContrast');
  }
}

function subscribe(listener: () => void) {
  start();
  listeners.add(listener);
  const unsubscribeAdapter = subscribeGlassAdapter(listener);
  return () => {
    listeners.delete(listener);
    unsubscribeAdapter();
  };
}

let adapterName = '';
let snapshot: Omit<GlassEnvironment, 'nativeBarAvailable'> | undefined;

function getSnapshot() {
  const adapter = getGlassAdapter();
  if (
    !snapshot ||
    adapterName !== adapter.name ||
    snapshot.reduceTransparency !== a11y.reduceTransparency ||
    snapshot.increaseContrast !== a11y.increaseContrast
  ) {
    adapterName = adapter.name;
    snapshot = {
      ...a11y,
      liquidGlassAvailable: adapter.liquidGlassAvailable(),
      blurAvailable: adapter.blurAvailable(),
    };
  }
  return snapshot;
}

/**
 * Set by a navigator integration (e.g. `@flux-ui/core/expo-router`) when it
 * renders bars as native system bars. Off by default: a plain `<AppBar>`
 * draws its own glass.
 */
export const NativeBarContext = createContext(false);

export function useGlassEnvironment(): GlassEnvironment {
  const device = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const nativeBar = useContext(NativeBarContext);
  return { ...device, nativeBarAvailable: nativeBar && Platform.OS === 'ios' };
}
