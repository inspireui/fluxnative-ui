// App-wide settings: which engine reads `className`, and which native chrome
// a navigator integration can host. Everything has a working default, so
// `<FluxNativeProvider>` is optional on Expo + Uniwind.

import React, { createContext, useContext, type ComponentType, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { colors, type ColorScheme } from '@fluxnative/tokens';
import { useClassStyle } from '@fluxnative/tw-runtime';

/**
 * `uniwind`: classes compile at build time (Expo); components pass
 * `className` through. `runtime`: classes resolve in JS (Flux WebView, Snack).
 */
export type StyleEngine = 'uniwind' | 'runtime';

export interface NativeHeaderProps {
  title?: string;
  largeTitle: boolean;
  leading?: ReactNode;
  trailing?: ReactNode;
}

interface ChromeHost {
  /** Renders a screen's AppBar as the navigator's native header. */
  NativeHeader?: ComponentType<NativeHeaderProps>;
}

const EngineContext = createContext<StyleEngine>('uniwind');
const ChromeHostContext = createContext<ChromeHost>({});

export function FluxNativeProvider({
  styleEngine = 'uniwind',
  children,
}: {
  styleEngine?: StyleEngine;
  children: ReactNode;
}) {
  return <EngineContext.Provider value={styleEngine}>{children}</EngineContext.Provider>;
}

export const ChromeHostProvider = ChromeHostContext.Provider;
export const useChromeHost = () => useContext(ChromeHostContext);

export function useScheme(): ColorScheme {
  return useColorScheme() === 'dark' ? 'dark' : 'light';
}

export function usePalette() {
  return colors[useScheme()];
}

/**
 * Props for a View-like element given an optional `className`: passed
 * through for Uniwind, resolved to a style for the runtime engine.
 */
export function useClassProps<S>(className: string | undefined, style: S): { className?: string; style: S | unknown[] } {
  const engine = useContext(EngineContext);
  // Hooks run unconditionally; the runtime result is ignored under Uniwind.
  const resolved = useClassStyle(engine === 'runtime' ? className : undefined);
  if (engine === 'uniwind') return className ? { className, style } : { style };
  return { style: [resolved, style] };
}
