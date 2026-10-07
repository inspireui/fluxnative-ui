import React from 'react';
import { FluxTabs } from '@fluxnative/ui/expo-router';
import { Glyph } from '../../components/Glyph';

export default function TabsLayout() {
  return (
    <FluxTabs minimize="onScrollDown">
      <FluxTabs.Tab
        name="index"
        label="Discover"
        sf={{ default: 'sparkles', selected: 'sparkles' }}
        icon={({ color }) => <Glyph name="discover" color={color} />}
      />
      <FluxTabs.Tab
        name="library"
        label="Library"
        sf={{ default: 'square.stack', selected: 'square.stack.fill' }}
        icon={({ color }) => <Glyph name="library" color={color} />}
        badge={3}
      />
      <FluxTabs.Tab
        name="settings"
        label="Settings"
        sf="gearshape"
        icon={({ color }) => <Glyph name="settings" color={color} />}
      />
    </FluxTabs>
  );
}
