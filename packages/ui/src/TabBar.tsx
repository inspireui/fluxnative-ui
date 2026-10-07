// The floating glass tab bar drawn on every tier below `native-bar` (Android,
// web, the Flux WebView, iOS without a native tab navigator). On iOS with
// `FluxTabs` from `@fluxnative/ui/expo-router`, the system tab bar is used
// instead and this component never renders.

import React, { createContext, type ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { chrome, text } from '@fluxnative/tokens';
import { GlassSurface, type GlassTier, type GlassVariant } from '@fluxnative/glass';
import { usePalette } from './provider.tsx';

export interface TabBarItem {
  key: string;
  label: string;
  icon: (state: { focused: boolean; color: string }) => ReactNode;
  /** Small count or dot; `true` shows a dot. */
  badge?: number | string | true;
}

/**
 * `floating`: an inset glass pill (iOS and web). `bar`: an edge-to-edge glass
 * bar in the Material 3 navigation-bar shape, the default on Android.
 */
export type TabBarShape = 'floating' | 'bar';

/** The shape `TabBar` and `useTabBarInset` use when none is passed. */
export function defaultTabBarShape(): TabBarShape {
  return Platform.OS === 'android' ? 'bar' : 'floating';
}

/** Extra height of the Material 3 bar over the floating pill. */
const BAR_EXTRA = 24;

export interface TabBarProps {
  items: TabBarItem[];
  activeKey: string;
  onSelect: (key: string) => void;
  variant?: GlassVariant;
  shape?: TabBarShape;
  /** Force a glass tier. For tests and screenshots only. */
  tier?: GlassTier;
}

/** True under a navigator that floats a TabBar over its screens. */
export const FloatingTabBarContext = createContext(false);

/** Total height the tab bar covers, for content that must clear it. */
export function useTabBarInset(shape: TabBarShape = defaultTabBarShape()): number {
  const insets = useSafeAreaInsets();
  if (shape === 'bar') return chrome.tabBarHeight + BAR_EXTRA + insets.bottom;
  return chrome.tabBarHeight + Math.max(insets.bottom, 12) + 8;
}

export function TabBar({ items, activeKey, onSelect, variant = 'regular', shape = defaultTabBarShape(), tier }: TabBarProps) {
  const insets = useSafeAreaInsets();
  const palette = usePalette();
  const bar = shape === 'bar';
  const height = bar ? chrome.tabBarHeight + BAR_EXTRA : chrome.tabBarHeight;
  const dock = bar
    ? { bottom: 0, left: 0, right: 0 }
    : { bottom: Math.max(insets.bottom, 12), left: chrome.tabBarInset, right: chrome.tabBarInset };

  return (
    <View style={[styles.dock, dock]} pointerEvents="box-none">
      <GlassSurface
        role="surface"
        variant={variant}
        tier={tier}
        radius={bar ? 0 : height / 2}
        // Shadow color carries the scrim token's alpha, so the opacity here is a multiplier.
        style={[bar ? styles.bar : styles.pill, { height: bar ? height + insets.bottom : height, shadowColor: palette.scrim }]}
      >
        <View style={[styles.row, bar && { paddingBottom: insets.bottom, paddingHorizontal: 8 }]} accessibilityRole="tablist">
          {items.map((item) => {
            const focused = item.key === activeKey;
            const color = focused ? palette.primary : palette['muted-foreground'];
            return (
              <Pressable
                key={item.key}
                accessibilityRole="tab"
                accessibilityState={{ selected: focused }}
                accessibilityLabel={item.label}
                onPress={() => onSelect(item.key)}
                style={({ pressed }) => [styles.item, pressed && styles.pressed]}
              >
                <View style={styles.indicator}>
                  {/* M3 bar: the active indicator is a pill behind the icon; pill: the whole item. */}
                  <View
                    style={[
                      bar ? styles.iconWell : StyleSheet.absoluteFill,
                      bar ? null : { borderRadius: (height - 8) / 2 },
                      focused && { backgroundColor: palette.accent },
                    ]}
                    pointerEvents="none"
                  />
                  <View>
                    {item.icon({ focused, color })}
                    {item.badge !== undefined ? (
                      <View style={[styles.badge, { backgroundColor: palette.destructive }]}>
                        {item.badge === true ? null : (
                          <Text style={[styles.badgeText, { color: palette['destructive-foreground'] }]} numberOfLines={1}>
                            {item.badge}
                          </Text>
                        )}
                      </View>
                    ) : null}
                  </View>
                  <Text style={[styles.label, { color }]} numberOfLines={1}>
                    {item.label}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      </GlassSurface>
    </View>
  );
}

const styles = StyleSheet.create({
  dock: { position: 'absolute', zIndex: 10 },
  pill: {
    shadowOpacity: 0.3,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  bar: {
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: -2 },
    elevation: 8,
  },
  iconWell: { position: 'absolute', top: 4, width: 64, height: 32, borderRadius: 16 },
  row: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4 },
  item: { flex: 1, height: '100%', padding: 4 },
  indicator: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2 },
  pressed: { transform: [{ scale: 0.94 }] },
  label: { fontSize: text.xs.fontSize - 1, lineHeight: text.xs.lineHeight - 2, fontWeight: '600' },
  badge: {
    position: 'absolute',
    top: -3,
    right: -8,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 4,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontSize: 10, fontWeight: '700' },
});
