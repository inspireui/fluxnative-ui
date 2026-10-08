import { describe, expect, it, jest } from '@jest/globals';
import React from 'react';
import { View } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { AppBar } from '../index.ts';

describe('AppBar', () => {
  it('renders the title as a header and no back button without onBack', () => {
    render(<AppBar title="Settings" />);
    expect(screen.getByRole('header', { name: 'Settings' })).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('shows a back button labelled "Back" that calls onBack', () => {
    const onBack = jest.fn();
    render(<AppBar title="Settings" onBack={onBack} />);
    fireEvent.press(screen.getByRole('button', { name: 'Back' }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('uses backLabel as the back button accessibility label', () => {
    const onBack = jest.fn();
    render(<AppBar title="Einstellungen" onBack={onBack} backLabel="Zurück" />);
    expect(screen.queryByLabelText('Back')).toBeNull();
    fireEvent.press(screen.getByRole('button', { name: 'Zurück' }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('AppBar.Action uses its label as the accessibility label and calls onPress', () => {
    const onPress = jest.fn();
    render(
      <AppBar title="Discover">
        <AppBar.Trailing>
          <AppBar.Action label="Search" icon={<View testID="search-icon" />} onPress={onPress} />
        </AppBar.Trailing>
      </AppBar>,
    );
    expect(screen.getByTestId('search-icon')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Search' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('a disabled AppBar.Action does not call onPress', () => {
    const onPress = jest.fn();
    render(
      <AppBar>
        <AppBar.Leading>
          <AppBar.Action label="Menu" icon={<View />} onPress={onPress} disabled />
        </AppBar.Leading>
      </AppBar>,
    );
    fireEvent.press(screen.getByLabelText('Menu'));
    expect(onPress).not.toHaveBeenCalled();
  });
});
