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
      {/* One name from the icon table covers iOS (SF Symbol) and Android/web (SVG). */}
      <FluxTabs.Tab name="settings" label="Settings" iconName="settings" />
    </FluxTabs>
  );
}
