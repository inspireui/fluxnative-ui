// Draws one icon from the table as an SVG: a 2px round stroke on a 24-unit
// grid, scaled to `size`. `filled` paints the glyph instead (selected tabs,
// saved hearts). Colour defaults to the current foreground.

import React from 'react';
import { useColorScheme, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors } from '@fluxnative/tokens';
import { ICONS, type IconName, type IconSpec } from './table.ts';

export interface IconProps {
  name: IconName;
  /** Width and height in px. Default 24. */
  size?: number;
  /** Any colour value. Defaults to the scheme's `foreground`. */
  color?: string;
  /** Stroke width on the 24-unit grid. Default 2. */
  strokeWidth?: number;
  /** Paint the glyph instead of outlining it. */
  filled?: boolean;
  style?: StyleProp<ViewStyle>;
  /** Screen-reader name. Omit for decorative icons next to a label. */
  accessibilityLabel?: string;
}

export function Icon({ name, size = 24, color, strokeWidth = 2, filled = false, style, accessibilityLabel }: IconProps) {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const spec: IconSpec = ICONS[name];
  const paint = color ?? colors[scheme].foreground;
  const d = filled ? (spec.fillPath ?? spec.path) : spec.path;
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      style={style}
      accessible={accessibilityLabel !== undefined}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={accessibilityLabel !== undefined ? 'image' : undefined}
    >
      <Path
        d={d}
        fill={filled ? paint : 'none'}
        stroke={paint}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
