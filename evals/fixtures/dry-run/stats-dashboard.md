The dashboard draws its chart with plain views and takes every colour from the palette.

```tsx
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Chip from '../components/Chip';
import Icon, { type IconName } from '../components/Icon';
import Press from '../components/Press';
import Reveal from '../components/Reveal';
import SectionHeader from '../components/SectionHeader';
import Skeleton from '../components/Skeleton';
import StateView from '../components/StateView';
import { fontWeight, radius, space, text } from '../theme/tokens';
import { usePalette } from '../theme/usePalette';

type PreviewState = 'live' | 'loading' | 'empty' | 'error';
type Period = 'Week' | 'Month' | 'Year';

interface Category {
  name: string;
  amount: number;
  icon: IconName;
}

interface Transaction {
  id: string;
  merchant: string;
  category: string;
  date: string;
  amount: number;
  icon: IconName;
}

const PERIODS: Period[] = ['Week', 'Month', 'Year'];
const DAILY = [64, 112, 48, 150, 96, 210, 72];
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const CHART_HEIGHT = 120;
const SPENT = 1932;
const LAST_PERIOD = 2105;

const CATEGORIES: Category[] = [
  { name: 'Rent', amount: 900, icon: 'home' },
  { name: 'Groceries', amount: 412, icon: 'cart' },
  { name: 'Dining', amount: 238, icon: 'flame' },
  { name: 'Shopping', amount: 218, icon: 'bag' },
  { name: 'Transport', amount: 164, icon: 'truck' },
];

const TRANSACTIONS: Transaction[] = [
  { id: 't1', merchant: 'Fresh Market', category: 'Groceries', date: 'Today', amount: 54.2, icon: 'cart' },
  { id: 't2', merchant: 'Metro card', category: 'Transport', date: 'Today', amount: 20, icon: 'truck' },
  { id: 't3', merchant: 'Osteria Nove', category: 'Dining', date: 'Yesterday', amount: 68.5, icon: 'flame' },
  { id: 't4', merchant: 'Harbour Goods', category: 'Shopping', date: 'Mon', amount: 112, icon: 'bag' },
  { id: 't5', merchant: 'Corner Bakery', category: 'Groceries', date: 'Sun', amount: 9.8, icon: 'cart' },
];

function money(amount: number): string {
  return `$${amount.toLocaleString('en-US', { minimumFractionDigits: amount % 1 === 0 ? 0 : 2, maximumFractionDigits: 2 })}`;
}

function SpendChart() {
  const palette = usePalette();
  const max = Math.max(...DAILY);
  const peak = DAILY.indexOf(max);
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={`Daily spend this week. Highest: ${money(max)} on ${DAYS[peak] ?? 'one day'}.`}
      style={styles.chart}
    >
      {DAILY.map((value, index) => (
        <View key={DAYS[index] ?? index} style={styles.barColumn}>
          <View
            style={[
              styles.bar,
              { height: (value / max) * CHART_HEIGHT, backgroundColor: index === peak ? palette.primary : palette.secondary },
            ]}
          />
          <Text style={[styles.caption, { color: palette['muted-foreground'] }]}>{(DAYS[index] ?? '').charAt(0)}</Text>
        </View>
      ))}
    </View>
  );
}

function LoadingDashboard() {
  return (
    <View style={styles.stack}>
      <Skeleton height={112} radius={radius['2xl']} />
      <Skeleton height={CHART_HEIGHT + 32} radius={radius['2xl']} />
      {[0, 1, 2, 3].map((i) => (
        <Skeleton key={i} height={48} />
      ))}
    </View>
  );
}

export default function StatsDashboardScreen({ previewState = 'live' }: { previewState?: PreviewState }) {
  const palette = usePalette();
  const [period, setPeriod] = useState<Period>('Month');
  const total = CATEGORIES.reduce((sum, c) => sum + c.amount, 0);
  const change = Math.round(((LAST_PERIOD - SPENT) / LAST_PERIOD) * 100);

  let body: React.ReactNode;
  if (previewState === 'loading') {
    body = <LoadingDashboard />;
  } else if (previewState === 'error') {
    body = (
      <StateView
        tone="error"
        title="Couldn't load your spending"
        body="Pull to refresh, or try again in a moment."
        actionLabel="Try again"
        onAction={() => undefined}
        icon={<Icon name="alert" size={32} color={palette.destructive} />}
      />
    );
  } else if (previewState === 'empty') {
    body = (
      <StateView
        title={`No transactions this ${period.toLowerCase()}`}
        body="Add one by hand or connect an account."
        actionLabel="Add a transaction"
        onAction={() => undefined}
        icon={<Icon name="wallet" size={32} color={palette['muted-foreground']} />}
      />
    );
  } else {
    body = (
      <View style={styles.stack}>
        <Reveal index={0}>
          <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
            <Text style={[styles.caption, { color: palette['muted-foreground'] }]}>Balance</Text>
            <Text style={[styles.balance, { color: palette.foreground }]}>$4,218.40</Text>
            <View style={styles.inline}>
              <Icon name="arrow-down" size={16} color={palette.success} />
              <Text style={[styles.body, { color: palette.success }]}>
                {money(SPENT)} spent, {change}% less than last {period.toLowerCase()}
              </Text>
            </View>
          </View>
        </Reveal>
        <Reveal index={1}>
          <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
            <SpendChart />
          </View>
        </Reveal>
        <Reveal index={2}>
          <SectionHeader title="By category" />
          {CATEGORIES.map((category) => {
            const share = category.amount / total;
            return (
              <View key={category.name} style={styles.categoryRow}>
                <View style={[styles.iconWell, { backgroundColor: palette.secondary }]}>
                  <Icon name={category.icon} size={18} color={palette.foreground} />
                </View>
                <View style={styles.grow}>
                  <View style={styles.spread}>
                    <Text style={[styles.body, { color: palette.foreground }]}>{category.name}</Text>
                    <Text style={[styles.amount, { color: palette.foreground }]}>{money(category.amount)}</Text>
                  </View>
                  <View style={[styles.track, { backgroundColor: palette.muted }]}>
                    <View style={[styles.fill, { flex: share, backgroundColor: palette.primary }]} />
                    <View style={{ flex: 1 - share }} />
                  </View>
                </View>
              </View>
            );
          })}
        </Reveal>
        <Reveal index={3}>
          <SectionHeader title="Recent" action="See all" onAction={() => undefined} actionLabel="See all transactions" />
          {TRANSACTIONS.map((t) => (
            <Press key={t.id} onPress={() => undefined} accessibilityLabel={`${t.merchant}, ${t.category}, ${t.date}, ${money(t.amount)}`}>
              <View style={styles.categoryRow}>
                <View style={[styles.iconWell, { backgroundColor: palette.secondary }]}>
                  <Icon name={t.icon} size={18} color={palette.foreground} />
                </View>
                <View style={styles.grow}>
                  <Text style={[styles.body, { color: palette.foreground }]}>{t.merchant}</Text>
                  <Text style={[styles.caption, { color: palette['muted-foreground'] }]}>
                    {t.category} · {t.date}
                  </Text>
                </View>
                <Text style={[styles.amount, { color: palette.foreground }]}>−{money(t.amount)}</Text>
              </View>
            </Press>
          ))}
        </Reveal>
      </View>
    );
  }

  return (
    <ScrollView style={{ backgroundColor: palette.background }} contentContainerStyle={styles.content}>
      <Text accessibilityRole="header" style={[styles.title, { color: palette.foreground }]}>
        Spending
      </Text>
      <View style={styles.inline}>
        {PERIODS.map((p) => (
          <Chip key={p} label={p} selected={p === period} onPress={() => setPeriod(p)} accessibilityRole="radio" />
        ))}
      </View>
      {body}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: space[4], paddingBottom: space[12], gap: space[4] },
  stack: { gap: space[4] },
  title: { fontSize: text['3xl'].fontSize, lineHeight: text['3xl'].lineHeight, fontWeight: fontWeight.bold },
  card: { padding: space[4], gap: space[1], borderRadius: radius['2xl'], borderWidth: StyleSheet.hairlineWidth },
  balance: { fontSize: text['4xl'].fontSize, lineHeight: text['4xl'].lineHeight, fontWeight: fontWeight.bold },
  inline: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  body: { fontSize: text.sm.fontSize, lineHeight: text.sm.lineHeight, fontWeight: fontWeight.medium },
  amount: { fontSize: text.sm.fontSize, lineHeight: text.sm.lineHeight, fontWeight: fontWeight.semibold },
  caption: { fontSize: text.xs.fontSize, lineHeight: text.xs.lineHeight },
  chart: { height: CHART_HEIGHT + space[6], flexDirection: 'row', alignItems: 'flex-end', gap: space[2] },
  barColumn: { flex: 1, alignItems: 'center', gap: space[1] },
  bar: { alignSelf: 'stretch', borderRadius: radius.md },
  categoryRow: { flexDirection: 'row', alignItems: 'center', gap: space[3], paddingVertical: space[2] },
  iconWell: { width: space[9], height: space[9], borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  grow: { flex: 1, gap: space[1] },
  spread: { flexDirection: 'row', justifyContent: 'space-between' },
  track: { flexDirection: 'row', height: space[1.5], borderRadius: radius.full, overflow: 'hidden' },
  fill: { borderRadius: radius.full },
});
```
