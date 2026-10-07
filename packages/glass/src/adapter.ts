// A glass adapter is how a host plugs real materials into the ladder.
// `@fluxnative/glass/expo` registers expo-glass-effect + expo-blur; the Flux
// WebView host registers a backdrop-filter one through `flux/glass`. With no
// adapter registered, every custom surface lands on `translucent` or
// `opaque`, which need nothing but View.

import type { ComponentType, ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

export type GlassVariant = 'regular' | 'clear';

export interface NativeGlassProps {
  variant: GlassVariant;
  tintColor?: string;
  interactive?: boolean;
  colorScheme: 'light' | 'dark';
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
}

export interface NativeGlassGroupProps {
  spacing?: number;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
}

export interface BlurProps {
  colorScheme: 'light' | 'dark';
  /** Blur radius in px; adapters map it to their own intensity scale. */
  radius: number;
  saturate: number;
  style?: StyleProp<ViewStyle>;
}

export interface GlassAdapter {
  name: string;
  liquidGlassAvailable(): boolean;
  blurAvailable(): boolean;
  GlassView?: ComponentType<NativeGlassProps>;
  GlassGroup?: ComponentType<NativeGlassGroupProps>;
  BlurView?: ComponentType<BlurProps>;
}

const none: GlassAdapter = {
  name: 'none',
  liquidGlassAvailable: () => false,
  blurAvailable: () => false,
};

let current: GlassAdapter = none;
const listeners = new Set<() => void>();

/** Registers the host's glass adapter. Call once, at app start. */
export function registerGlassAdapter(adapter: GlassAdapter): void {
  current = adapter;
  for (const listener of listeners) listener();
}

export function getGlassAdapter(): GlassAdapter {
  return current;
}

export function subscribeGlassAdapter(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
