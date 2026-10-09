Here is the catalog grid screen.

```tsx
import React, { useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Chip from '../components/Chip';
import Icon from '../components/Icon';
import IconButton from '../components/IconButton';
import Press from '../components/Press';
import Reveal from '../components/Reveal';
import SectionHeader from '../components/SectionHeader';
import Skeleton from '../components/Skeleton';
import StateView from '../components/StateView';
import { fontWeight, radius, space, text } from '../theme/tokens';
import { usePalette } from '../theme/usePalette';

type PreviewState = 'live' | 'loading' | 'empty' | 'error';
type Category = 'All' | 'Tops' | 'Bottoms' | 'Shoes' | 'Accessories';

interface Product {
  id: string;
  name: string;
  brand: string;
  price: number;
  image: string;
  category: Category;
  saved: boolean;
}

const CATEGORIES: Category[] = ['All', 'Tops', 'Bottoms', 'Shoes', 'Accessories'];
const ACTIVE_FILTERS = 2;

const PRODUCTS: Product[] = [
  { id: 'p1', name: 'Linen overshirt', brand: 'Atelier Nord', price: 89, image: 'https://images.example.com/p1.jpg', category: 'Tops', saved: true },
  { id: 'p2', name: 'Pleated trousers', brand: 'Common Field', price: 120, image: 'https://images.example.com/p2.jpg', category: 'Bottoms', saved: false },
  { id: 'p3', name: 'Suede loafers', brand: 'Marlow', price: 210, image: 'https://images.example.com/p3.jpg', category: 'Shoes', saved: false },
  { id: 'p4', name: 'Canvas tote', brand: 'Harbour', price: 45, image: 'https://images.example.com/p4.jpg', category: 'Accessories', saved: true },
  { id: 'p5', name: 'Merino crewneck', brand: 'Atelier Nord', price: 135, image: 'https://images.example.com/p5.jpg', category: 'Tops', saved: false },
  { id: 'p6', name: 'Wide-leg denim', brand: 'Common Field', price: 98, image: 'https://images.example.com/p6.jpg', category: 'Bottoms', saved: false },
  { id: 'p7', name: 'Court sneakers', brand: 'Marlow', price: 150, image: 'https://images.example.com/p7.jpg', category: 'Shoes', saved: false },
  { id: 'p8', name: 'Leather belt', brand: 'Harbour', price: 60, image: 'https://images.example.com/p8.jpg', category: 'Accessories', saved: false },
];

interface ProductCardProps {
  product: Product;
  index: number;
  width: number;
  saved: boolean;
  onToggleSaved: () => void;
}

function ProductCard({ product, index, width, saved, onToggleSaved }: ProductCardProps) {
  const palette = usePalette();
  return (
    <Reveal index={index} style={{ width }}>
      <Press onPress={() => undefined} haptic="light" accessibilityLabel={`${product.name} by ${product.brand}, $${product.price}`}>
        <View style={styles.card}>
          <Image source={{ uri: product.image }} style={[styles.image, { backgroundColor: palette.muted }]} />
          <View style={styles.heart}>
            <IconButton
              variant="translucent"
              size="sm"
              selected={saved}
              onPress={onToggleSaved}
              accessibilityLabel={saved ? `Remove ${product.name} from saved` : `Save ${product.name}`}
            >
              <Icon name="heart" size={18} filled={saved} color={saved ? palette.destructive : palette.foreground} />
            </IconButton>
          </View>
          <Text numberOfLines={1} style={[styles.brand, { color: palette['muted-foreground'] }]}>
            {product.brand}
          </Text>
          <Text numberOfLines={1} style={[styles.name, { color: palette.foreground }]}>
            {product.name}
          </Text>
          <Text style={[styles.price, { color: palette.foreground }]}>${product.price}</Text>
        </View>
      </Press>
    </Reveal>
  );
}

function LoadingGrid({ cardWidth }: { cardWidth: number }) {
  return (
    <View style={styles.grid}>
      {[0, 1, 2, 3].map((i) => (
        <View key={i} style={[styles.card, { width: cardWidth }]}>
          <Skeleton height={(cardWidth * 4) / 3} radius={radius['2xl']} />
          <Skeleton width="50%" height={12} />
          <Skeleton width="80%" height={16} />
        </View>
      ))}
    </View>
  );
}

export default function CatalogGridScreen({ previewState = 'live' }: { previewState?: PreviewState }) {
  const palette = usePalette();
  const { width } = useWindowDimensions();
  const [category, setCategory] = useState<Category>('All');
  const [saved, setSaved] = useState<Record<string, boolean>>(() => Object.fromEntries(PRODUCTS.map((p) => [p.id, p.saved])));
  const cardWidth = (width - space[4] * 2 - space[3]) / 2;
  const products =
    previewState === 'empty' ? [] : category === 'All' ? PRODUCTS : PRODUCTS.filter((p) => p.category === category);

  const toggleSaved = (id: string) => setSaved((current) => ({ ...current, [id]: !(current[id] ?? false) }));

  let body: React.ReactNode;
  if (previewState === 'loading') {
    body = <LoadingGrid cardWidth={cardWidth} />;
  } else if (previewState === 'error') {
    body = (
      <StateView
        tone="error"
        title="Couldn't load new arrivals"
        body="Check your connection and try again."
        actionLabel="Try again"
        onAction={() => undefined}
        icon={<Icon name="alert" size={32} color={palette.destructive} />}
      />
    );
  } else if (products.length === 0) {
    body = (
      <StateView
        title={category === 'All' ? 'Nothing new yet' : `No ${category.toLowerCase()} yet`}
        body="New pieces land every week."
        actionLabel="Clear filters"
        onAction={() => setCategory('All')}
        icon={<Icon name="bag" size={32} color={palette['muted-foreground']} />}
      />
    );
  } else {
    body = (
      <>
        <SectionHeader title="Trending" action="See all" onAction={() => undefined} actionLabel="See all trending products" />
        <View style={styles.grid}>
          {products.map((product, index) => (
            <ProductCard
              key={product.id}
              product={product}
              index={index}
              width={cardWidth}
              saved={saved[product.id] ?? false}
              onToggleSaved={() => toggleSaved(product.id)}
            />
          ))}
        </View>
      </>
    );
  }

  return (
    <ScrollView style={{ backgroundColor: palette.background }} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text accessibilityRole="header" style={[styles.title, { color: palette.foreground }]}>
            New in
          </Text>
          <Text style={[styles.count, { color: palette['muted-foreground'] }]}>
            {previewState === 'loading' ? 'Loading…' : `${products.length} items`}
          </Text>
        </View>
        <IconButton variant="tonal" badge={ACTIVE_FILTERS} onPress={() => undefined} accessibilityLabel={`Filters, ${ACTIVE_FILTERS} active`}>
          <Icon name="sliders" size={20} color={palette.foreground} />
        </IconButton>
      </View>
      {previewState === 'loading' ? (
        <View style={styles.chips}>
          {CATEGORIES.map((c) => (
            <Skeleton key={c} width={88} height={36} radius={radius.full} />
          ))}
        </View>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {CATEGORIES.map((c) => (
            <Chip key={c} label={c} selected={c === category} onPress={() => setCategory(c)} accessibilityRole="radio" />
          ))}
        </ScrollView>
      )}
      {body}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: space[4], paddingTop: space[6], paddingBottom: space[12], gap: space[4] },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerText: { flex: 1 },
  title: { fontSize: text['3xl'].fontSize, lineHeight: text['3xl'].lineHeight, fontWeight: fontWeight.bold },
  count: { fontSize: text.sm.fontSize, lineHeight: text.sm.lineHeight },
  chips: { flexDirection: 'row', gap: space[2] },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space[3] },
  card: { gap: space[1] },
  image: { width: '100%', aspectRatio: 3 / 4, borderRadius: radius['2xl'] },
  heart: { position: 'absolute', top: space[2], right: space[2] },
  brand: { marginTop: space[2], fontSize: text.xs.fontSize, lineHeight: text.xs.lineHeight, fontWeight: fontWeight.medium },
  name: { fontSize: text.sm.fontSize, lineHeight: text.sm.lineHeight, fontWeight: fontWeight.semibold },
  price: { fontSize: text.sm.fontSize, lineHeight: text.sm.lineHeight },
});
```

Each state is driven by `previewState`; the grid uses the catalog primitives throughout.
