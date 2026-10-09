// A product grid card: a 4:5 image well (a `muted` placeholder while the
// photo loads), the name, the price in its currency with the old price
// struck through, and an optional heart. The card and the heart are
// siblings, so no pressable sits inside another. Text roles: `type.bodySm`
// (name) and `type.numeric` (price); the well is `shape.well`.

import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { shape, space, type } from '../../theme/tokens';
import { usePalette } from '../../theme/usePalette';
import Icon from '../Icon';
import IconButton, { iconButtonInk } from '../IconButton';
import Press from '../Press';

/** What the card shows of a product. */
export interface ProductCardItem {
  id: string;
  name: string;
  /** In currency units: 12.5 is $12.50. */
  price: number;
  /** ISO 4217 code. Default 'USD'. */
  currency?: string;
  /** Image URL. */
  image: string;
  /** The price before a discount; struck through when it is higher than `price`. */
  compareAt?: number;
  /** A short tag on the image ("New", "-20%"). */
  badge?: string;
}

export interface ProductCardProps {
  product: ProductCardItem;
  /** Card width in px; the image well is 1.25 × as tall. */
  width: number;
  onOpen: (product: ProductCardItem) => void;
  /** Shows the heart button. */
  onHeart?: (product: ProductCardItem) => void;
  /** Fills the heart (`tertiary`, the likes colour). */
  saved?: boolean;
  /** Below the price, outside the card's press area (a rating row, an add button). */
  footer?: React.ReactNode;
  /** Drawn on the image's top-left corner in place of the `product.badge` tag. */
  badgeSlot?: React.ReactNode;
}

/** Image well height per px of width (4:5). */
const IMAGE_RATIO = 5 / 4;

/** `formatPrice(12.5, 'EUR')` → "€12.50". Fixed to en-US so a screenshot doesn't depend on the device. */
export function formatPrice(value: number, currency = 'USD'): string {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(value);
  } catch {
    return `${currency} ${value.toFixed(2)}`;
  }
}

export default function ProductCard({ product, width, onOpen, onHeart, saved = false, footer, badgeSlot }: ProductCardProps) {
  const palette = usePalette();
  const price = formatPrice(product.price, product.currency);
  const was = product.compareAt !== undefined && product.compareAt > product.price ? formatPrice(product.compareAt, product.currency) : null;
  const tag = product.badge !== undefined && product.badge !== '' ? product.badge : null;
  // One name for the whole card: what it is and what it costs.
  const label = [product.name, price, was !== null ? `was ${was}` : null, tag].filter((part) => part !== null).join(', ');
  return (
    <View style={{ width }}>
      <Press onPress={() => onOpen(product)} accessibilityLabel={label} accessibilityRole="link">
        <View style={[styles.well, { height: Math.round(width * IMAGE_RATIO), borderRadius: shape.well, backgroundColor: palette.muted }]}>
          <Image source={{ uri: product.image }} style={styles.photo} resizeMode="cover" accessibilityIgnoresInvertColors />
        </View>
        <Text numberOfLines={2} style={[type.bodySm, styles.name, { color: palette.foreground }]}>
          {product.name}
        </Text>
        <View style={styles.prices}>
          <Text style={[type.numeric, { color: palette.foreground }]}>{price}</Text>
          {was !== null ? <Text style={[type.bodySm, styles.was, { color: palette['muted-foreground'] }]}>{was}</Text> : null}
        </View>
      </Press>
      {footer}
      {badgeSlot !== undefined ? (
        <View style={styles.badgeSlot}>{badgeSlot}</View>
      ) : tag !== null ? (
        // Already in the card's name, so screen readers skip it.
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={[styles.badgeSlot, styles.tag, { backgroundColor: palette.inverse, borderRadius: shape.chip }]}
        >
          <Text style={[type.caps, { color: palette['inverse-foreground'] }]}>{tag.toUpperCase()}</Text>
        </View>
      ) : null}
      {onHeart !== undefined ? (
        <View style={styles.heart}>
          <IconButton
            variant="translucent"
            size="sm"
            selected={saved}
            accessibilityLabel={saved ? `Remove ${product.name} from saved` : `Save ${product.name}`}
            onPress={() => onHeart(product)}
          >
            <Icon name="heart" size={18} filled={saved} color={saved ? palette.tertiary : iconButtonInk('translucent', palette)} />
          </IconButton>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  well: { overflow: 'hidden' },
  photo: { width: '100%', height: '100%' },
  name: { marginTop: space[2] },
  prices: { flexDirection: 'row', alignItems: 'baseline', marginTop: space[1] },
  was: { marginLeft: space[2], textDecorationLine: 'line-through' },
  badgeSlot: { position: 'absolute', top: space[2], left: space[2], pointerEvents: 'none' },
  tag: { paddingHorizontal: space[2], paddingVertical: space[0.5] },
  heart: { position: 'absolute', top: space[2], right: space[2] },
});
