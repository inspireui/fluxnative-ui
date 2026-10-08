import { describe, expect, it } from '@jest/globals';
import React from 'react';
import { ScrollView, Text } from 'react-native';
import { render, screen, within } from '@testing-library/react-native';
import { AppBar, Screen } from '../index.ts';

describe('Screen', () => {
  it('renders its children', () => {
    render(
      <Screen>
        <Text>Body</Text>
      </Screen>,
    );
    expect(screen.getByText('Body')).toBeTruthy();
  });

  it('lifts an <AppBar> out of the scroll content and still renders it', () => {
    render(
      <Screen>
        <AppBar title="Discover" />
        <Text>Body</Text>
      </Screen>,
    );
    const scroll = screen.UNSAFE_getByType(ScrollView);
    expect(within(scroll).getByText('Body')).toBeTruthy();
    expect(within(scroll).queryByText('Discover')).toBeNull();
    expect(screen.getByRole('header', { name: 'Discover' })).toBeTruthy();
  });

  it('renders a plain View container with scroll={false}', () => {
    const { toJSON } = render(
      <Screen scroll={false}>
        <Text>Body</Text>
      </Screen>,
    );
    expect(screen.UNSAFE_queryByType(ScrollView)).toBeNull();
    expect(screen.getByText('Body')).toBeTruthy();
    const root = toJSON() as unknown as { type: string } | null;
    expect(root?.type).toBe('View');
  });
});
