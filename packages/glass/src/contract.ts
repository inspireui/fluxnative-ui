// The `flux/glass` host contract: what a host (the Flux WebView dashboard,
// the FluxNative importer runtime) must export so a template written against
// `@fluxnative/glass` runs there unchanged, and the exact palette the host
// draws with. `hosts/web/glass.tsx` and `hosts/expo/glass.tsx` implement it;
// `contract.test.ts` checks them against this file.

import { colors, glass } from '@fluxnative/tokens';
import { GLASS_TIERS } from './tiers.ts';

export const GLASS_CONTRACT_VERSION = 1;

/** The look every tier shares; the host files inline these numbers. */
export const GLASS_LOOK = {
  /** Alpha a `tint` is laid over the material with. */
  tintAlpha: { blur: 0.18, translucent: 0.14 },
  /** Opacity of the top-half sheen on the translucent tier. */
  sheenOpacity: { light: 0.16, dark: 0.08 },
} as const;

export interface GlassHostPalette {
  /** Translucent tier fill. */
  fill: string;
  /** Fill under a backdrop blur. */
  blurFill: string;
  /** Rim around blurred and translucent glass. */
  border: string;
  /** Sheen and top line. */
  highlight: string;
  /** Opaque tier fill. */
  opaque: string;
  /** Opaque tier rim. */
  opaqueBorder: string;
}

export function hostPalette(scheme: 'light' | 'dark'): GlassHostPalette {
  const c = colors[scheme];
  return {
    fill: c['glass-fill'],
    blurFill: c['glass-blur-fill'],
    border: c['glass-border'],
    highlight: c['glass-highlight'],
    opaque: c['glass-opaque'],
    opaqueBorder: c.border,
  };
}

export const GLASS_CONTRACT = {
  version: GLASS_CONTRACT_VERSION,
  module: 'flux/glass',
  exports: {
    values: ['GlassSurface', 'GlassGroup', 'useGlassTier'],
    types: ['GlassTier', 'GlassRole', 'GlassVariant', 'GlassSurfaceProps', 'GlassGroupProps'],
  },
  tiers: GLASS_TIERS,
  roles: ['bar', 'surface'],
  variants: ['regular', 'clear'],
  palette: { light: hostPalette('light'), dark: hostPalette('dark') },
  blur: { radius: glass.blurRadius, saturate: glass.saturate },
  look: GLASS_LOOK,
} as const;

export type GlassContract = typeof GLASS_CONTRACT;
