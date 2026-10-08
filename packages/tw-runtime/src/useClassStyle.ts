import { useMemo } from 'react';
import { Platform, useColorScheme, useWindowDimensions } from 'react-native';
import { resolve, type Platform as TwPlatform, type Style } from './resolve.ts';

const warned = new Set<string>();

/**
 * The style for a class string in the current color scheme, platform and
 * window size (`w-screen` / `h-screen` follow rotation).
 * In development, each unknown class warns once with the valid alternative.
 */
export function useClassStyle(className: string | undefined): Style {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const platform: TwPlatform = Platform.OS === 'ios' || Platform.OS === 'android' ? Platform.OS : 'web';
  const { width, height } = useWindowDimensions();
  return useMemo(() => {
    const { style, unknown } = resolve(className, { scheme, platform, window: { width, height } });
    if (__DEV__) {
      for (const { className: cls, hint } of unknown) {
        if (warned.has(cls)) continue;
        warned.add(cls);
        console.warn(`[fluxnative-ui] Unknown class "${cls}". ${hint}`);
      }
    }
    return style;
  }, [className, scheme, platform, width, height]);
}
