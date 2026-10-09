Here's the settings screen. It groups rows by section and confirms sign-out in a sheet.

```tsx
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import Button from '../components/Button';
import Chip from '../components/Chip';
import Icon, { type IconName } from '../components/Icon';
import Press from '../components/Press';
import SectionHeader from '../components/SectionHeader';
import Sheet from '../components/Sheet';
import Skeleton from '../components/Skeleton';
import StateView from '../components/StateView';
import { fontWeight, space, text } from '../theme/tokens';
import { usePalette } from '../theme/usePalette';

type PreviewState = 'live' | 'loading' | 'empty' | 'error';
type Appearance = 'Light' | 'Dark' | 'System';

interface Row {
  icon: IconName;
  label: string;
  value?: string;
}

const ACCOUNT: Row[] = [
  { icon: 'person', label: 'Profile' },
  { icon: 'credit-card', label: 'Subscription', value: 'Pro' },
  { icon: 'grid', label: 'Devices', value: '3' },
];
const SUPPORT: Row[] = [
  { icon: 'help', label: 'Help center' },
  { icon: 'chat', label: 'Send feedback' },
];

export default function SettingsScreen({ previewState = 'live' }: { previewState?: PreviewState }) {
  const palette = usePalette();
  const [notifications, setNotifications] = useState(true);
  const [cellular, setCellular] = useState(false);
  const [appearance, setAppearance] = useState<Appearance>('System');
  const [confirmOpen, setConfirmOpen] = useState(false);

  const row = (item: Row) => (
    <Press key={item.label} onPress={() => undefined} accessibilityLabel={item.value ? `${item.label}, ${item.value}` : item.label}>
      <View style={styles.row}>
        <Icon name={item.icon} size={20} color={palette.foreground} />
        <Text style={[styles.label, { color: palette.foreground }]}>{item.label}</Text>
        {item.value ? <Text style={{ color: palette['muted-foreground'] }}>{item.value}</Text> : null}
        <Icon name="chevron-right" size={18} color={palette['muted-foreground']} />
      </View>
    </Press>
  );

  if (previewState === 'loading') {
    return (
      <View style={[styles.screen, { backgroundColor: palette.background }]}>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} height={44} />
        ))}
      </View>
    );
  }

  if (previewState === 'empty') {
    return (
      <StateView title="You're signed out" body="Sign in to sync your notes and settings." actionLabel="Sign in" onAction={() => undefined} />
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: palette.background }]}>
      <ScrollView contentContainerStyle={styles.content}>
        {previewState === 'error' ? (
          <StateView inline tone="error" title="Settings didn't sync" actionLabel="Retry" onAction={() => undefined} />
        ) : null}
        <Press onPress={() => undefined} accessibilityLabel="Mai Tran, mai@example.com, open profile">
          <View style={styles.row}>
            <View style={styles.avatar}>
              <Text style={styles.initials}>MT</Text>
            </View>
            <View style={styles.grow}>
              <Text style={[styles.label, { color: palette.foreground }]}>Mai Tran</Text>
              <Text style={{ color: palette['muted-foreground'] }}>mai@example.com</Text>
            </View>
            <Icon name="chevron-right" size={18} color={palette['muted-foreground']} />
          </View>
        </Press>

        <SectionHeader title="Account" subtitle="Plan and devices" />
        {ACCOUNT.map(row)}

        <SectionHeader title="Preferences" />
        <View style={styles.row}>
          <Icon name="bell" size={20} color={palette.foreground} />
          <Text style={[styles.label, { color: palette.foreground }]}>Notifications</Text>
          <Switch value={notifications} onValueChange={setNotifications} accessibilityLabel="Notifications" />
        </View>
        <View style={styles.row}>
          <Icon name="globe" size={20} color={palette.foreground} />
          <Text style={[styles.label, { color: palette.foreground }]}>Sync over cellular</Text>
          <Switch value={cellular} onValueChange={setCellular} accessibilityLabel="Sync over cellular" />
        </View>
        {row({ icon: 'globe', label: 'Language', value: 'English' })}

        <SectionHeader title="Appearance" />
        <View style={styles.chips}>
          {(['Light', 'Dark', 'System'] as const).map((option) => (
            <Chip key={option} label={option} selected={appearance === option} onPress={() => setAppearance(option)} accessibilityRole="radio" />
          ))}
        </View>

        <SectionHeader title="Support" />
        {SUPPORT.map(row)}

        <Button label="Sign out" variant="destructive" fullWidth onPress={() => setConfirmOpen(true)} />
      </ScrollView>

      <Sheet visible={confirmOpen} onClose={() => setConfirmOpen(false)} title="Sign out?">
        <Text style={{ color: palette['muted-foreground'] }}>Unsynced notes stay on this device.</Text>
        <Button label="Sign out" variant="destructive" onPress={() => setConfirmOpen(false)} />
        <Button label="Cancel" variant="ghost" onPress={() => setConfirmOpen(false)} />
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: space[4], gap: space[3] },
  content: { gap: space[2], paddingBottom: space[12] },
  row: { flexDirection: 'row', alignItems: 'center', gap: space[3], paddingVertical: space[3] },
  grow: { flex: 1 },
  label: { flex: 1, fontSize: text.base.fontSize, fontWeight: fontWeight.medium },
  avatar: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E8E1FF' },
  initials: { fontSize: 17, fontWeight: fontWeight.semibold },
  chips: { flexDirection: 'row', gap: space[2] },
});
```
