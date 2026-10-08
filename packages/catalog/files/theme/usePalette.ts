// The current colour scheme's palette. A template designed for one scheme
// sets `lockedScheme` through its colour overrides; otherwise the system
// setting decides.

import { useColorScheme } from 'react-native';
import { colors, lockedScheme, type ColorScheme, type Palette } from './tokens';

export type { ColorName, ColorScheme, Palette } from './tokens';

export function useScheme(): ColorScheme {
  const system = useColorScheme();
  return lockedScheme ?? (system === 'dark' ? 'dark' : 'light');
}

export function usePalette(): Palette {
  return colors[useScheme()];
}
