// Runs before every test file, after the React Native preset's own setup.
import { jest } from '@jest/globals';
import type { ReactNode } from 'react';

// The components read the safe area through `useSafeAreaInsets`; the real
// provider needs a native module, so every test gets zero insets instead.
jest.mock('react-native-safe-area-context', () => {
  const insets = { top: 0, right: 0, bottom: 0, left: 0 };
  const frame = { x: 0, y: 0, width: 390, height: 844 };
  const passThrough = ({ children }: { children?: ReactNode }) => children ?? null;
  return {
    __esModule: true,
    initialWindowMetrics: { insets, frame },
    useSafeAreaInsets: () => insets,
    useSafeAreaFrame: () => frame,
    SafeAreaProvider: passThrough,
    SafeAreaView: passThrough,
  };
});
