// Color helpers shared by the library and the generated host files. Glass
// tints come from a palette value, which may be any form React Native takes.

const HEX = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const RGB = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*[\d.]+\s*)?\)$/i;

/**
 * `color` at `alpha`, for `#rgb`, `#rgba`, `#rrggbb`, `#rrggbbaa`, `rgb()`
 * and `rgba()`. An existing alpha is replaced, not multiplied. Any other
 * form (named colors, hsl) is returned unchanged.
 */
export function withAlpha(color: string, alpha: number): string {
  const hex = HEX.exec(color)?.[1];
  if (hex) {
    const digits = hex.length <= 4 ? [...hex].map((c) => c + c).join('') : hex;
    const n = parseInt(digits.slice(0, 6), 16);
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
  }
  const rgb = RGB.exec(color);
  if (rgb) return `rgba(${rgb[1]}, ${rgb[2]}, ${rgb[3]}, ${alpha})`;
  return color;
}
