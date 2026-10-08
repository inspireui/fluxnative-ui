import { describe, expect, it, jest } from '@jest/globals';
import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { chrome } from '@fluxnative/tokens';
import { TabBar, defaultTabBarShape, useTabBarInset, type TabBarItem, type TabBarShape } from '../index.ts';

const items: TabBarItem[] = [
  { key: 'home', label: 'Home', icon: ({ color }) => <View testID="icon-home" style={{ backgroundColor: color }} /> },
  { key: 'search', label: 'Search', icon: () => <View testID="icon-search" />, badge: 3 },
  { key: 'inbox', label: 'Inbox', icon: () => <View testID="icon-inbox" />, badge: true },
];

/** Flattened style of the rendered root (the tab bar's dock view). */
function rootStyle(json: unknown): ViewStyle {
  const root = json as { props: { style?: StyleProp<ViewStyle> } } | null;
  return StyleSheet.flatten(root?.props.style) as ViewStyle;
}

describe('TabBar', () => {
  it('renders one tab per item, with the active one selected', () => {
    render(<TabBar items={items} activeKey="home" onSelect={jest.fn()} />);
    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(items.length);
    expect(tabs.map((tab) => tab.props.accessibilityLabel)).toEqual(['Home', 'Search', 'Inbox']);
    expect(screen.getByRole('tab', { name: 'Home' }).props.accessibilityState).toEqual(
      expect.objectContaining({ selected: true }),
    );
    expect(screen.getByRole('tab', { name: 'Search' }).props.accessibilityState).toEqual(
      expect.objectContaining({ selected: false }),
    );
  });

  it('calls onSelect with the pressed tab key', () => {
    const onSelect = jest.fn();
    render(<TabBar items={items} activeKey="home" onSelect={onSelect} />);
    fireEvent.press(screen.getByRole('tab', { name: 'Search' }));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith('search');
  });

  it('renders badge text and the item icons', () => {
    render(<TabBar items={items} activeKey="home" onSelect={jest.fn()} />);
    expect(screen.getByText('3')).toBeTruthy();
    expect(screen.getByTestId('icon-home')).toBeTruthy();
    expect(screen.getByTestId('icon-search')).toBeTruthy();
    expect(screen.getByTestId('icon-inbox')).toBeTruthy();
  });

  it('docks edge-to-edge as a bar and inset as a floating pill', () => {
    const bar = rootStyle(render(<TabBar items={items} activeKey="home" onSelect={jest.fn()} shape="bar" />).toJSON());
    expect(bar).toEqual(expect.objectContaining({ position: 'absolute', bottom: 0, left: 0, right: 0 }));

    const floating = rootStyle(
      render(<TabBar items={items} activeKey="home" onSelect={jest.fn()} shape="floating" />).toJSON(),
    );
    expect(floating).toEqual(
      expect.objectContaining({ position: 'absolute', left: chrome.tabBarInset, right: chrome.tabBarInset }),
    );
    expect(floating.bottom).toBeGreaterThan(0);
    expect(floating).not.toEqual(bar);
  });

  it('useTabBarInset returns different heights for bar and floating shapes', () => {
    const seen: Partial<Record<TabBarShape, number>> = {};
    function Probe({ shape }: { shape: TabBarShape }) {
      seen[shape] = useTabBarInset(shape);
      return null;
    }
    render(
      <>
        <Probe shape="bar" />
        <Probe shape="floating" />
      </>,
    );
    expect(seen.bar).toBeGreaterThan(chrome.tabBarHeight);
    expect(seen.floating).toBeGreaterThan(chrome.tabBarHeight);
    expect(seen.bar).not.toBe(seen.floating);
  });

  it('defaults to the floating pill on iOS', () => {
    expect(defaultTabBarShape()).toBe('floating');
  });
});
