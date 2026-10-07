// The top app bar. Always glass: on iOS under a native navigator it *is*
// the system navigation bar (Liquid Glass on iOS 26+); everywhere else it
// draws a GlassSurface that floats over content scrolled beneath it.
//
//   <Screen>
//     <AppBar title="Discover">
//       <AppBar.Trailing>
//         <AppBar.Action label="Search" icon={<SearchIcon />} onPress={openSearch} />
//       </AppBar.Trailing>
//     </AppBar>
//     ...content
//   </Screen>

import React, { Children, isValidElement, useEffect, type ReactElement, type ReactNode } from 'react';
import { Animated, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { chrome, text } from '@fluxnative/tokens';
import { GlassSurface, useGlassTier, type GlassTier, type GlassVariant } from '@fluxnative/glass';
import { useChromeHost, usePalette } from './provider.tsx';
import { TOP_CHROME, useScreen } from './Screen.tsx';

function Leading({ children }: { children?: ReactNode }) {
  return <>{children}</>;
}
function Trailing({ children }: { children?: ReactNode }) {
  return <>{children}</>;
}

export interface AppBarActionProps {
  /** Spoken by screen readers. Required: icon-only buttons have no other name. */
  label: string;
  icon: ReactNode;
  onPress: () => void;
  disabled?: boolean;
}

/** An icon button in the bar. */
function Action({ label, icon, onPress, disabled }: AppBarActionProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      disabled={disabled}
      hitSlop={6}
      style={({ pressed }) => [styles.action, pressed && styles.pressed, disabled && styles.disabled]}
    >
      {icon}
    </Pressable>
  );
}

function BackButton({ onPress, color, label }: { onPress: () => void; color: string; label: string }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [styles.action, pressed && styles.pressed]}
    >
      <View style={[styles.chevron, { borderColor: color }]} />
    </Pressable>
  );
}

export interface AppBarProps {
  title?: string;
  /**
   * Shows a back button on the drawn tiers. Under a native stack the system
   * back button (with its swipe gesture) is used instead, so pass this
   * unconditionally: `onBack={router.back}`.
   */
  onBack?: () => void;
  /** Screen-reader name of the drawn back button. Localise it; defaults to "Back". */
  backLabel?: string;
  /** iOS-style large title that collapses into the bar on scroll (native tier). */
  largeTitle?: boolean;
  /** `clear` only when the bar sits over a photo or video. */
  variant?: GlassVariant;
  /** Force a glass tier. For tests and screenshots only. */
  tier?: GlassTier;
  children?: ReactNode;
}

function slot(children: ReactNode, type: typeof Leading | typeof Trailing): ReactNode {
  const found = Children.toArray(children).find(
    (child): child is ReactElement<{ children?: ReactNode }> => isValidElement(child) && child.type === type,
  );
  return found?.props.children;
}

function AppBarRoot({
  title,
  onBack,
  backLabel = 'Back',
  largeTitle = false,
  variant = 'regular',
  tier: forced,
  children,
}: AppBarProps) {
  const tier = useGlassTier('bar', forced);
  const host = useChromeHost();
  const screen = useScreen();
  const insets = useSafeAreaInsets();
  const palette = usePalette();
  const leading = slot(children, Leading);
  const trailing = slot(children, Trailing);
  const native = tier === 'native-bar' && host.NativeHeader;
  const height = insets.top + chrome.appBarHeight;

  useEffect(() => {
    screen?.setTopChromeHeight(native ? 0 : height);
  }, [screen, native, height]);

  if (native && host.NativeHeader) {
    const NativeHeader = host.NativeHeader;
    return <NativeHeader title={title} largeTitle={largeTitle} leading={leading} trailing={trailing} />;
  }

  // Scroll-edge: a hairline fades in once content passes under the bar.
  // Only the hairline animates — never the glass's own opacity.
  const edge = screen?.scrollEdge ?? 'automatic';
  const hairline =
    edge === 'none' || !screen
      ? 0
      : edge === 'hard'
        ? 1
        : screen.scrollY.interpolate({ inputRange: [0, 12], outputRange: [0, 1], extrapolate: 'clamp' });

  return (
    <View style={[styles.bar, { height }]} pointerEvents="box-none">
      <GlassSurface role="bar" variant={variant} tier={tier} style={StyleSheet.absoluteFill} />
      <Animated.View
        style={[styles.hairline, { backgroundColor: palette.border, opacity: hairline }]}
        pointerEvents="none"
      />
      <View style={[styles.row, { marginTop: insets.top }]}>
        {/* The bar is the glass; its buttons sit on it, so plain Views here —
            a native GlassContainer only hosts glass surfaces. */}
        <View style={styles.side}>
          {onBack ? <BackButton onPress={onBack} color={palette.foreground} label={backLabel} /> : null}
          {leading}
        </View>
        {title ? (
          <Text
            accessibilityRole="header"
            numberOfLines={1}
            style={[styles.title, Platform.OS === 'android' && styles.titleStart, { color: palette.foreground }]}
          >
            {title}
          </Text>
        ) : (
          <View style={styles.titleSpacer} />
        )}
        <View style={[styles.side, styles.trailing]}>{trailing}</View>
      </View>
    </View>
  );
}

export const AppBar = Object.assign(AppBarRoot, {
  Leading,
  Trailing,
  Action,
  [TOP_CHROME]: true,
});

const styles = StyleSheet.create({
  bar: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 },
  hairline: { position: 'absolute', left: 0, right: 0, bottom: 0, height: StyleSheet.hairlineWidth },
  row: { height: chrome.appBarHeight, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8 },
  side: { minWidth: 44, flexDirection: 'row', alignItems: 'center', gap: 4 },
  trailing: { justifyContent: 'flex-end' },
  title: {
    flex: 1,
    textAlign: 'center',
    fontSize: text.lg.fontSize,
    lineHeight: text.lg.lineHeight,
    fontWeight: '600',
  },
  titleStart: { textAlign: 'left', paddingHorizontal: 8 },
  titleSpacer: { flex: 1 },
  action: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22 },
  pressed: { transform: [{ scale: 0.92 }] },
  chevron: { width: 11, height: 11, marginLeft: 4, borderLeftWidth: 2.5, borderBottomWidth: 2.5, transform: [{ rotate: '45deg' }] },
  disabled: { opacity: 0.4 },
});
