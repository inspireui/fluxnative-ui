// Android and web: FluxNative UI's floating glass TabBar over the JS tab
// navigator. (iOS resolves FluxTabs.ios.tsx and uses the system tab bar.)

import React from 'react';
import { Tabs, type BottomTabBarProps } from 'expo-router/js-tabs';
import { Icon, type IconName } from '@fluxnative/icons';
import { FloatingTabBarContext, TabBar } from '../TabBar.tsx';
import { Tab, collectTabs, type FluxTabProps, type FluxTabsProps } from './tabs-shared.ts';

const NO_ICON = () => null;

/** The glyph for a tab without a custom `icon`: the table entry for `iconName`, filled when focused. */
function tabIcon(spec: FluxTabProps | undefined): NonNullable<FluxTabProps['icon']> {
  if (spec?.icon) return spec.icon;
  const name: IconName | undefined = spec?.iconName;
  if (name === undefined) return NO_ICON;
  return ({ focused, color }) => <Icon name={name} color={color} filled={focused} size={22} />;
}

function RouterTabBar({ state, navigation, tabs }: BottomTabBarProps & { tabs: FluxTabProps[] }) {
  const routes = state.routes.filter((route) => tabs.some((t) => t.name === route.name));
  const activeKey = state.routes[state.index]?.key ?? '';
  const items = routes.map((route) => {
    const spec = tabs.find((t) => t.name === route.name);
    return {
      key: route.key,
      label: spec?.label ?? route.name,
      icon: tabIcon(spec),
      badge: spec?.badge,
    };
  });

  return (
    <TabBar
      items={items}
      activeKey={activeKey}
      onSelect={(key) => {
        const route = routes.find((r) => r.key === key);
        if (!route) return;
        const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
        if (key !== activeKey && !event.defaultPrevented) {
          (navigation.navigate as (name: string, params?: object) => void)(route.name, route.params);
        }
      }}
    />
  );
}

function FluxTabsRoot({ children }: FluxTabsProps) {
  const tabs = collectTabs(children);
  return (
    <FloatingTabBarContext.Provider value>
      <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <RouterTabBar {...props} tabs={tabs} />}>
        {tabs.map((tab) => (
          <Tabs.Screen key={tab.name} name={tab.name} options={{ title: tab.label }} />
        ))}
      </Tabs>
    </FloatingTabBarContext.Provider>
  );
}

export const FluxTabs = Object.assign(FluxTabsRoot, { Tab });
