// The floating glass tab bar drawn on every tier below `native-bar` (Android,
// web, the Flux WebView, iOS without a native tab navigator). On iOS with
// `FluxTabs` from `@flux-ui/core/expo-router`, the system tab bar is used
// instead and this component never renders.

import React, { createContext, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { chrome, text } from '@flux-ui/tokens';
import { GlassSurface, type GlassTier, type GlassVariant } from '@flux-ui/glass';
import { usePalette } from './provider.tsx';

export interface TabBarItem {
  key: string;
  label: string;
  icon: (state: { focused: boolean; color: string }) => ReactNode;
  /** Small count or dot; `true` shows a dot. */
  badge?: number | string | true;
}

export interface TabBarProps {
  items: TabBarItem[];
  activeKey: string;
  onSelect: (key: string) => void;
  variant?: GlassVariant;
  /** Force a glass tier. For tests and screenshots only. */
  tier?: GlassTier;
}

/** True under a navigator that floats a TabBar over its screens. */
export const FloatingTabBarContext = createContext(false);

/** Total height the tab bar covers, for content that must clear it. */
export function useTabBarInset(): number {
  const insets = useSafeAreaInsets();
  return chrome.tabBarHeight + Math.max(insets.bottom, 12) + 8;
}

export function TabBar({ items, activeKey, onSelect, variant = 'regular', tier }: TabBarProps) {
  const insets = useSafeAreaInsets();
  const palette = usePalette();
  const height = chrome.tabBarHeight;

  return (
    <View
      style={[styles.dock, { bottom: Math.max(insets.bottom, 12), left: chrome.tabBarInset, right: chrome.tabBarInset }]}
      pointerEvents="box-none"
    >
      <GlassSurface role="surface" variant={variant} tier={tier} radius={height / 2} style={[styles.pill, { height }]}>
        <View style={styles.row} accessibilityRole="tablist">
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
                <View
                  style={[styles.indicator, { borderRadius: (height - 8) / 2 }, focused && { backgroundColor: palette.accent }]}
                >
                  <View>
                    {item.icon({ focused, color })}
                    {item.badge !== undefined ? (
                      <View style={[styles.badge, { backgroundColor: palette.destructive }]}>
                        {item.badge === true ? null : (
                          <Text style={styles.badgeText} numberOfLines={1}>
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
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
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
  badgeText: { color: '#ffffff', fontSize: 10, fontWeight: '700' },
});
