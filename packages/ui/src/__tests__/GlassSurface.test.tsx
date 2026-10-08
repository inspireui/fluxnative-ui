import { describe, expect, it } from '@jest/globals';
import React from 'react';
import { AccessibilityInfo, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';
import { act, render, screen } from '@testing-library/react-native';
import { colors } from '@fluxnative/tokens';
import { getGlassAdapter } from '@fluxnative/glass';
import { Glass, useGlassTier, type GlassTier } from '../index.ts';

type Json = { type: string; props: { style?: StyleProp<ViewStyle> }; children?: Json[] | null } | null;

const flat = (node: Json): ViewStyle => StyleSheet.flatten(node?.props.style) as ViewStyle;
const asJson = (json: unknown): Json => json as Json;

function TierProbe({ onTier }: { onTier: (tier: GlassTier) => void }) {
  onTier(useGlassTier());
  return null;
}

describe('GlassSurface', () => {
  it('lands on the translucent tier with no adapter registered', () => {
    expect(getGlassAdapter().name).toBe('none');
    let tier: GlassTier | undefined;
    render(
      <TierProbe
        onTier={(t) => {
          tier = t;
        }}
      />,
    );
    expect(tier).toBe('translucent');

    const { toJSON } = render(
      <Glass.Surface>
        <Text>Inside</Text>
      </Glass.Surface>,
    );
    const root = asJson(toJSON());
    expect(flat(root).backgroundColor).toBeUndefined();
    expect(flat(root?.children?.[0] ?? null).backgroundColor).toBe(colors.light['glass-fill']);
    expect(screen.getByText('Inside')).toBeTruthy();
  });

  it('renders children on the opaque token colour when forced to the opaque tier', () => {
    const { toJSON } = render(
      <Glass.Surface tier="opaque">
        <Text>Inside</Text>
      </Glass.Surface>,
    );
    expect(screen.getByText('Inside')).toBeTruthy();
    expect(flat(asJson(toJSON()))).toEqual(
      expect.objectContaining({ backgroundColor: colors.light['glass-opaque'], borderColor: colors.light.border }),
    );
  });

  it('drops to the opaque tier while Reduce Transparency is on', () => {
    const { toJSON } = render(
      <Glass.Surface>
        <Text>Inside</Text>
      </Glass.Surface>,
    );
    expect(flat(asJson(toJSON())).backgroundColor).toBeUndefined();

    // The environment subscribes to AccessibilityInfo once per module, so
    // drive it through the listener it registered on the preset's mock.
    type Listener = (on: boolean) => void;
    const calls = (AccessibilityInfo.addEventListener as unknown as { mock: { calls: [string, Listener][] } }).mock.calls;
    const onReduceTransparency = calls.find(([event]) => event === 'reduceTransparencyChanged')?.[1];
    expect(onReduceTransparency).toBeDefined();

    act(() => onReduceTransparency?.(true));
    expect(flat(asJson(toJSON())).backgroundColor).toBe(colors.light['glass-opaque']);
    expect(screen.getByText('Inside')).toBeTruthy();

    act(() => onReduceTransparency?.(false));
    expect(flat(asJson(toJSON())).backgroundColor).toBeUndefined();
  });
});

describe('GlassGroup', () => {
  it('renders its children', () => {
    const { toJSON } = render(
      <Glass.Group>
        <Glass.Surface tier="opaque">
          <Text>One</Text>
        </Glass.Surface>
        <Glass.Surface tier="opaque">
          <Text>Two</Text>
        </Glass.Surface>
      </Glass.Group>,
    );
    expect(screen.getByText('One')).toBeTruthy();
    expect(screen.getByText('Two')).toBeTruthy();
    expect(asJson(toJSON())?.type).toBe('View');
  });
});
