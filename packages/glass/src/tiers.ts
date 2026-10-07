// The glass ladder. Flux UI chrome is always glass by intent; what the
// device can actually draw decides the tier. There is deliberately no
// "glass off" input: only the platform and the user's accessibility
// settings move a surface down the ladder.
//
//   native-bar    the system bar itself (UINavigationBar / UITabBar on iOS 26+);
//                 Flux UI draws no background and the OS owns glass + a11y
//   native-glass  a custom surface rendered with UIGlassEffect
//   blur          a blur view (iOS < 26, web backdrop-filter, Android 12+)
//   translucent   a tinted fill with a rim and a specular highlight
//   opaque        a solid surface for Reduce Transparency / Increase Contrast

export type GlassTier = 'native-bar' | 'native-glass' | 'blur' | 'translucent' | 'opaque';

export const GLASS_TIERS: readonly GlassTier[] = ['native-bar', 'native-glass', 'blur', 'translucent', 'opaque'];

/** `bar` = navigation chrome a navigator can host natively; `surface` = anything else. */
export type GlassRole = 'bar' | 'surface';

export interface GlassEnvironment {
  /** The navigator can render this bar as a native system bar with Liquid Glass. */
  nativeBarAvailable: boolean;
  /** UIGlassEffect is present (iOS 26+, built with Xcode 26+). */
  liquidGlassAvailable: boolean;
  /** A blur view adapter is registered and works on this device. */
  blurAvailable: boolean;
  reduceTransparency: boolean;
  increaseContrast: boolean;
}

export interface ResolveTierInput extends GlassEnvironment {
  role: GlassRole;
  /** Force a tier, for tests and screenshots only. */
  forced?: GlassTier;
}

export function resolveGlassTier(input: ResolveTierInput): GlassTier {
  if (input.forced) return input.forced;
  // A native bar adapts to Reduce Transparency, Increase Contrast and the
  // Clear/Tinted setting on its own, so it wins even when those are on.
  if (input.role === 'bar' && input.nativeBarAvailable) return 'native-bar';
  if (input.increaseContrast || input.reduceTransparency) return 'opaque';
  if (input.liquidGlassAvailable) return 'native-glass';
  if (input.blurAvailable) return 'blur';
  return 'translucent';
}
