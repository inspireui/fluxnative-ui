import { useMemo } from 'react';
import { Platform, useColorScheme } from 'react-native';
import { resolve, type Platform as TwPlatform, type Style } from './resolve.ts';

const warned = new Set<string>();

/**
 * The style for a class string in the current color scheme and platform.
 * In development, each unknown class warns once with the valid alternative.
 */
export function useClassStyle(className: string | undefined): Style {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const platform: TwPlatform = Platform.OS === 'ios' || Platform.OS === 'android' ? Platform.OS : 'web';
  return useMemo(() => {
    const { style, unknown } = resolve(className, { scheme, platform });
    if (__DEV__) {
      for (const { className: cls, hint } of unknown) {
        if (warned.has(cls)) continue;
        warned.add(cls);
        console.warn(`[flux-ui] Unknown class "${cls}". ${hint}`);
      }
    }
    return style;
  }, [className, scheme, platform]);
}
