// Shows which glass tier each kind of surface resolves to on this device.
// Toggle Reduce Transparency or Increase Contrast in system settings and
// watch the tiers change live.

import React from 'react';
import { Platform, Text, View } from 'react-native';
import { AppBar, Glass, Screen, useGlassTier, usePalette, type GlassTier } from '@fluxnative/ui';

/** The tiers a custom surface can take (native-bar belongs to navigators). */
const SURFACE_TIERS: GlassTier[] = ['native-glass', 'blur', 'translucent', 'opaque'];

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-center justify-between border-b border-border py-3">
      <Text className="text-base text-card-foreground">{label}</Text>
      <Text className="text-base font-semibold text-muted-foreground">{value}</Text>
    </View>
  );
}

export default function Settings() {
  const palette = usePalette();
  const bar = useGlassTier('bar');
  const surface = useGlassTier('surface');
  return (
    <Screen contentContainerClassName="gap-6 px-4 pb-8">
      <AppBar title="Settings" />

      <View className="rounded-2xl bg-card px-4">
        <Row label="Platform" value={`${Platform.OS} ${String(Platform.Version)}`} />
        <Row label="App bar tier" value={bar} />
        <Row label="Surface tier" value={surface} />
      </View>

      <Text className="text-sm font-semibold uppercase text-muted-foreground">Every tier, forced</Text>
      {SURFACE_TIERS.map((tier) => (
        <View key={tier} className="overflow-hidden rounded-3xl bg-primary p-4">
          <Glass.Surface tier={tier} radius={20} tint={tier === 'translucent' ? palette.primary : undefined}>
            <View className="px-4 py-5">
              <Text className="text-lg font-semibold text-foreground">{tier}</Text>
              <Text className="text-sm text-muted-foreground">Glass.Surface tier=&quot;{tier}&quot;</Text>
            </View>
          </Glass.Surface>
        </View>
      ))}
    </Screen>
  );
}
