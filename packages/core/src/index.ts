import { GlassGroup, GlassSurface } from '@flux-ui/glass';

export { AppBar } from './AppBar.tsx';
export type { AppBarProps, AppBarActionProps } from './AppBar.tsx';
export { Screen, useScreen } from './Screen.tsx';
export type { ScreenProps, ScrollEdge } from './Screen.tsx';
export { TabBar, useTabBarInset } from './TabBar.tsx';
export type { TabBarProps, TabBarItem } from './TabBar.tsx';
export { FluxUIProvider, ChromeHostProvider, useChromeHost, usePalette, useScheme, useClassProps } from './provider.tsx';
export type { StyleEngine, NativeHeaderProps } from './provider.tsx';

/** `<Glass.Surface>` for custom glass, `<Glass.Group>` around neighbouring glass. */
export const Glass = { Surface: GlassSurface, Group: GlassGroup };
export { useGlassTier, registerGlassAdapter } from '@flux-ui/glass';
export type { GlassTier, GlassVariant } from '@flux-ui/glass';
