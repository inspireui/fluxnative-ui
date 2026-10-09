// The primitives read their defaults from theme/tokens (the interaction
// profile, `type` roles, `shape` roles) instead of literals and ref scales.
// `__tests__/primitives-v0/` holds them as they were before that change.
// With the kit's tokens every primitive must render and behave exactly like
// its v0 source: same host views and styles, same hit slop and
// accessibility, same animations and haptics. With a brand's tokens they
// must follow the brand. Then the new props and recipes, one by one.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { FILES_DIR, listFiles } from './emit.ts';
import {
  component,
  dirLayer,
  el,
  findAll,
  fixtureLayer,
  loader,
  render,
  type Device,
  type Exports,
  type HostNode,
  type Loader,
  type Props,
  type View,
} from './__tests__/render.ts';

const V0 = join(import.meta.dirname, '__tests__', 'primitives-v0');
const current = dirLayer(FILES_DIR);
const kit = loader([current]);
const v0 = loader([fixtureLayer(V0), current]);

const tokens = kit('theme/tokens.ts') as {
  colors: Record<'light' | 'dark', Record<string, string>>;
  shape: Record<string, number>;
  type: Record<string, Props>;
};
const light = tokens.colors.light;
const noop = () => undefined;
const glyph = el('Glyph', { name: 'bag' });

const DEVICES: Device[] = [{}, { scheme: 'dark' }, { reduced: true }, { os: 'android' }];

/** Renders each case with the v0 source and with today's, on every device, and wants the same result; `adjust` edits v0's for an intended change. */
function same(file: string, cases: Props[], adjust: (old: ReturnType<typeof render>) => void = noop): void {
  for (const props of cases) {
    for (const device of DEVICES) {
      const before = render(v0, el(component(v0, file), props), device);
      adjust(before);
      const after = render(kit, el(component(kit, file), props), device);
      const where = `${file} ${JSON.stringify(props, (_key, value: unknown) => (typeof value === 'function' ? 'fn' : value))} ${JSON.stringify(device)}`;
      assert.deepEqual(after.view, before.view, `${where}: views`);
      assert.deepEqual(after.mount, before.mount, `${where}: mount`);
      assert.deepEqual(after.presses, before.presses, `${where}: presses`);
    }
  }
}

/** Every combination of the given prop values, laid over `base`. */
function matrix(base: Props, axes: Record<string, unknown[]>): Props[] {
  return Object.entries(axes).reduce<Props[]>((all, [key, values]) => all.flatMap((props) => values.map((value) => ({ ...props, [key]: value }))), [base]);
}

/** Every host view of `type`, in document order. */
const allOf = (nodes: Array<View | string>, type: string): View[] =>
  nodes.flatMap((node) => (typeof node === 'string' ? [] : [...(node.type === type ? [node] : []), ...allOf(node.children, type)]));
const firstOf = (nodes: Array<View | string>, type: string): View => {
  const hit = allOf(nodes, type)[0];
  if (hit === undefined) throw new Error(`no ${type}`);
  return hit;
};
const styleOf = (node: View) => node.props.style as Props;
const textOf = (node: View): string => node.children.map((child) => (typeof child === 'string' ? child : textOf(child))).join('');

// ------------------------------------------------- kit tokens: no change

test('with the kit tokens, Press renders and behaves as v0 (haptic, scale, spring, hit slop, disabled)', () => {
  same('components/Press.tsx', [
    { accessibilityLabel: 'Go', onPress: noop, children: glyph },
    {
      accessibilityLabel: 'Go',
      haptic: 'medium',
      activeScale: 0.9,
      hitSlop: 6,
      accessibilityRole: 'link',
      accessibilityHint: 'Opens it',
      testID: 'go',
      style: [{ flex: 1, marginTop: 4 }, { padding: 8, borderRadius: 4 }],
    },
    { accessibilityLabel: 'Go', disabled: true, activeScale: 1, accessibilityState: { selected: true }, style: { width: 120 } },
  ]);
});

test('with the kit tokens, Reveal and Skeleton animate as v0', () => {
  same('components/Reveal.tsx', [{ children: glyph }, { index: 3, delay: 20, offset: 30, style: { marginTop: 8 } }, { index: 12 }]);
  const stagger = (load: Loader) => load('components/Reveal.tsx').stagger as (index: number) => number;
  for (let index = 0; index < 12; index += 1) assert.equal(stagger(kit)(index), stagger(v0)(index), `stagger(${index})`);
  same('components/Skeleton.tsx', [{}, { width: 120, height: 20, radius: 4, style: { marginTop: 4 } }, { circle: true, height: 40 }]);
});

test('with the kit tokens, Button, Chip and IconButton render as v0', () => {
  same('components/Button.tsx', [
    ...matrix({ label: 'Add to bag', onPress: noop }, { variant: ['primary', 'secondary', 'outline', 'ghost', 'destructive'], size: ['sm', 'md', 'lg'] }),
    { label: 'Pay', loading: true },
    { label: 'Pay', disabled: true, block: false, haptic: 'none', accessibilityLabel: 'Pay now', leading: glyph, trailing: glyph, style: { marginTop: 8 } },
  ]);
  same('components/Chip.tsx', [
    ...matrix({ label: 'M', onPress: noop }, { selected: [false, true], size: ['sm', 'md'], round: [false, true] }),
    { label: 'Sold out', struck: true, leading: glyph, accessibilityRole: 'radio', disabled: true, style: { marginRight: 8 } },
  ]);
  same('components/IconButton.tsx', [
    ...matrix({ children: glyph, accessibilityLabel: 'Bag', onPress: noop }, { variant: ['plain', 'tonal', 'filled', 'translucent', 'outline'], size: ['sm', 'md', 'lg'] }),
    { children: glyph, accessibilityLabel: 'Saved', selected: true, haptic: 'selection', disabled: true, accessibilityHint: 'Toggles', style: { marginLeft: 4 } },
    { children: glyph, accessibilityLabel: 'Bag', badge: 0 },
    { children: glyph, accessibilityLabel: 'Bag', badge: '' },
  ]);
});

test('with the kit tokens, a badge draws as v0; only the screen-reader name gains the count', () => {
  for (const badge of [3, 'New', 120]) {
    same('components/IconButton.tsx', matrix({ children: glyph, accessibilityLabel: 'Bag', badge }, { size: ['sm', 'md', 'lg'] }), (old) => {
      const pressable = firstOf(old.view, 'Pressable');
      pressable.props.accessibilityLabel = `Bag, ${badge}`;
    });
  }
});

test('with the kit tokens, Sheet, StateView and SectionHeader render as v0', () => {
  same('components/Sheet.tsx', [
    {
      open: true,
      onClose: noop,
      title: 'Filters',
      trailing: glyph,
      footer: glyph,
      height: 400,
      children: glyph,
      contentStyle: { padding: 4 },
      closeLabel: 'Close filters',
    },
    { open: true, onClose: noop, children: glyph },
    { open: false, onClose: noop },
  ]);
  same('components/StateView.tsx', [
    ...matrix(
      { title: 'Nothing here', body: 'Try again later', actionLabel: 'Retry', onAction: noop, icon: glyph },
      { tone: ['neutral', 'error'], inline: [false, true] },
    ),
    { title: 'Nothing here' },
    { title: 'Nothing here', inline: true, style: { margin: 4 } },
    { title: 'Nothing here', actionLabel: 'Retry' },
  ]);
  same('components/SectionHeader.tsx', [
    { title: 'Trending' },
    { title: 'Trending', eyebrow: 'New in', action: 'See all', onAction: noop, actionLabel: 'See all trending', style: { marginTop: 8 } },
  ]);
});

// --------------------------------------------------- a brand's tokens

/** A brand that moves every sys token the primitives read. */
function branded(): Loader {
  const font = { fontFamily: 'Georgia' };
  return loader([current], {
    'theme/tokens.ts': {
      ...(tokens as unknown as Exports),
      shape: { ...tokens.shape, control: 12, chip: 6, card: 20, sheet: 28, well: 4 },
      type: {
        ...tokens.type,
        title: { ...tokens.type.title, ...font, fontSize: 22 },
        label: { ...tokens.type.label, ...font, fontWeight: '600', letterSpacing: 0.2 },
        caps: { ...tokens.type.caps, ...font, fontSize: 12 },
        bodySm: { ...tokens.type.bodySm, ...font, fontSize: 15 },
      },
      interaction: {
        press: { haptic: 'light', activeScale: 0.95, hitSlop: 12, spring: { speed: 26, bounciness: 2 } },
        reveal: { offset: 20, duration: 500, stagger: 40 },
        skeleton: { mode: 'color', base: 'muted', highlight: 'card', pulse: 700, minOpacity: 0.4, reducedOpacity: 0.9 },
      },
    },
  });
}

test('with a brand, Press takes its haptic, scale, spring and hit slop; props still win', () => {
  const brand = branded();
  const Press = component(brand, 'components/Press.tsx');
  const pressed = render(brand, el(Press, { accessibilityLabel: 'Go', onPress: noop }));
  assert.equal(firstOf(pressed.view, 'Pressable').props.hitSlop, 12);
  assert.deepEqual(pressed.presses, [
    [
      ['start', { spring: { toValue: 0.95, useNativeDriver: true, speed: 26, bounciness: 2 } }],
      ['start', { spring: { toValue: 1, useNativeDriver: true, speed: 26, bounciness: 2 } }],
      ['haptic', 'light'],
    ],
  ]);
  const own = render(brand, el(Press, { accessibilityLabel: 'Go', haptic: 'none', activeScale: 1, hitSlop: 2 }));
  assert.equal(firstOf(own.view, 'Pressable').props.hitSlop, 2);
  assert.deepEqual(own.presses, [[]]);
});

test('with a brand, Reveal rises, lasts and staggers by the profile; Skeleton breathes between two palette roles', () => {
  const brand = branded();
  const reveal = render(brand, el(component(brand, 'components/Reveal.tsx'), { index: 3 }));
  const transform = styleOf(firstOf(reveal.view, 'Animated.View')).transform as Array<{ translateY: { interpolate: { outputRange: number[] } } }>;
  assert.deepEqual(transform[0]?.translateY.interpolate.outputRange, [20, 0]);
  assert.deepEqual(reveal.mount, [['start', { timing: { toValue: 1, duration: 500, delay: 120, easing: { bezier: [0.16, 1, 0.3, 1] }, useNativeDriver: true } }]]);
  assert.equal((brand('components/Reveal.tsx').stagger as (index: number) => number)(20), 7 * 40);

  const Skeleton = component(brand, 'components/Skeleton.tsx');
  const skeleton = render(brand, el(Skeleton, {}));
  const block = styleOf(firstOf(skeleton.view, 'Animated.View'));
  assert.equal(block.borderRadius, 4, 'shape.well');
  assert.equal(block.opacity, undefined);
  assert.deepEqual(block.backgroundColor, { interpolate: { inputRange: [0, 1], outputRange: [light.muted, light.card] }, of: { animated: 0 } });
  const pulse = (toValue: number) => ({ timing: { toValue, duration: 700, useNativeDriver: false } });
  assert.deepEqual(skeleton.mount, [['start', { loop: { sequence: [pulse(1), pulse(0)] } }]]);
  assert.deepEqual(render(brand, el(Skeleton, {}), { reduced: true }).mount, [['setValue', 0]]);
  // The kit's opacity mode, held still under Reduce Motion.
  assert.deepEqual(render(kit, el(component(kit, 'components/Skeleton.tsx'), {}), { reduced: true }).mount, [['setValue', 0.8]]);
});

test('with a brand, corners follow shape roles and text follows type roles', () => {
  const brand = branded();
  const inner = (view: Array<View | string>) => styleOf(firstOf(view, 'Animated.View'));
  const label = (view: Array<View | string>) => styleOf(firstOf(view, 'Text'));

  const button = render(brand, el(component(brand, 'components/Button.tsx'), { label: 'Pay' })).view;
  assert.equal(inner(button).borderRadius, 12);
  assert.deepEqual(
    { ...label(button), color: undefined },
    { fontFamily: 'Georgia', fontSize: 16, lineHeight: 24, fontWeight: '600', letterSpacing: 0.2, color: undefined },
    'the default label keeps its size and weight and takes the role’s family and tracking',
  );
  const titled = render(brand, el(component(brand, 'components/Button.tsx'), { label: 'Pay', labelRole: 'title' })).view;
  assert.equal(label(titled).fontSize, 22);

  const chip = render(brand, el(component(brand, 'components/Chip.tsx'), { label: 'M', round: true })).view;
  assert.equal(inner(chip).borderRadius, 6);
  assert.equal(label(chip).fontFamily, 'Georgia');

  const iconButton = (size: string) => render(brand, el(component(brand, 'components/IconButton.tsx'), { children: glyph, accessibilityLabel: 'Bag', size, badge: 2 })).view;
  assert.equal(inner(iconButton('md')).borderRadius, 12);
  assert.equal(inner(iconButton('sm')).borderRadius, 12);
  assert.equal(firstOf(iconButton('sm'), 'Pressable').props.hitSlop, 12, 'the profile’s hit slop when it is larger');
  assert.equal(label(iconButton('md')).fontSize, 12, 'the badge count is the caps role');

  const sheet = render(brand, el(component(brand, 'components/Sheet.tsx'), { open: true, onClose: noop, title: 'Filters' })).view;
  assert.equal(styleOf(allOf(sheet, 'Animated.View')[1] as View).borderTopLeftRadius, 28);
  assert.equal(label(sheet).fontSize, 22);

  const banner = render(brand, el(component(brand, 'components/StateView.tsx'), { title: 'Offline', variant: 'inline' })).view;
  assert.equal(styleOf(firstOf(banner, 'View')).borderRadius, 20);
  assert.equal(label(banner).fontFamily, 'Georgia');
  assert.equal(label(banner).fontSize, 16, 'the banner title keeps its size');

  const header = render(brand, el(component(brand, 'components/SectionHeader.tsx'), { title: 'New', eyebrow: 'Edit', action: 'All', onAction: noop })).view;
  const [eyebrow, title, action] = allOf(header, 'Text');
  assert.equal(eyebrow && styleOf(eyebrow).fontSize, 12);
  assert.equal(title && styleOf(title).fontSize, 22);
  assert.equal(action && styleOf(action).fontFamily, 'Georgia');
  assert.equal(firstOf(header, 'Pressable').props.hitSlop, 12);
});

// --------------------------------------------------------- new props

test('Button size xl is 60 px; buttonHeight is the comp table; labelRole uses a role as it is', () => {
  const Button = component(kit, 'components/Button.tsx');
  assert.deepEqual(kit('components/Button.tsx').buttonHeight, { sm: 36, md: 44, lg: 56, xl: 60 });
  const xl = render(kit, el(Button, { label: 'Checkout', size: 'xl' })).view;
  const box = styleOf(firstOf(xl, 'Animated.View'));
  assert.equal(box.height, 60);
  assert.equal(box.paddingHorizontal, 24);
  assert.deepEqual({ ...styleOf(firstOf(xl, 'Text')), color: undefined }, { fontSize: 16, lineHeight: 24, fontWeight: '600', color: undefined });
  const titled = render(kit, el(Button, { label: 'Checkout', size: 'xl', labelRole: 'title' })).view;
  assert.deepEqual({ ...styleOf(firstOf(titled, 'Text')), color: undefined }, { ...tokens.type.title, color: undefined });
  const small = render(kit, el(Button, { label: 'Add', size: 'sm', labelRole: 'caps' })).view;
  assert.deepEqual({ ...styleOf(firstOf(small, 'Text')), color: undefined }, { ...tokens.type.caps, color: undefined });
});

test('IconButton outline-on-surface: a card face with a ring, ink on card, ringed marks', () => {
  const IconButton = component(kit, 'components/IconButton.tsx');
  const ink = kit('components/IconButton.tsx').iconButtonInk as (variant: string, palette: Record<string, string>) => string;
  assert.equal(ink('outline-on-surface', light), light['card-foreground']);
  const face = render(kit, el(IconButton, { children: glyph, accessibilityLabel: 'Bag', variant: 'outline-on-surface', size: 'lg', badge: 4 })).view;
  const box = styleOf(firstOf(face, 'Animated.View'));
  assert.deepEqual([box.backgroundColor, box.borderWidth, box.borderColor, box.borderRadius], [light.card, 1, light.border, 26]);
  const badge = styleOf(allOf(face, 'View')[1] as View);
  assert.deepEqual([badge.top, badge.minWidth, badge.height, badge.borderWidth, badge.borderColor], [0, 22, 22, 2, light.card]);
});

test('IconButton badge and dot: true or dot draw a dot, a count wins over the dot, the count joins the name once', () => {
  const IconButton = component(kit, 'components/IconButton.tsx');
  const draw = (props: Props) => render(kit, el(IconButton, { children: glyph, accessibilityLabel: 'Bag', ...props })).view;
  const marks = (view: Array<View | string>) => allOf(view, 'View').slice(1);
  const dot = (props: Props) => styleOf(marks(draw(props))[0] as View);
  assert.deepEqual(dot({ badge: true }), { position: 'absolute', top: 10, right: 10, width: 8, height: 8, borderRadius: 4, backgroundColor: light.destructive });
  assert.deepEqual(dot({ dot: true }), dot({ badge: true }));
  assert.deepEqual(dot({ dot: true, size: 'lg', variant: 'outline-on-surface' }), {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: light.destructive,
    borderWidth: 2,
    borderColor: light.card,
  });
  for (const hidden of [false, 0, '']) assert.equal(marks(draw({ badge: hidden })).length, 0, String(hidden));
  const counted = draw({ badge: 2, dot: true });
  assert.equal(marks(counted).length, 1);
  assert.equal(textOf(marks(counted)[0] as View), '2');
  assert.equal(firstOf(draw({ dot: true }), 'Pressable').props.accessibilityLabel, 'Bag', 'a dot adds no words');
  assert.equal(firstOf(draw({ badge: 'New' }), 'Pressable').props.accessibilityLabel, 'Bag, New');
  assert.equal(firstOf(draw({ badge: 3, accessibilityLabel: 'Bag, 3 items' }), 'Pressable').props.accessibilityLabel, 'Bag, 3 items');
  assert.equal(firstOf(draw({ badge: 3, accessibilityLabel: 'Top 30' }), 'Pressable').props.accessibilityLabel, 'Top 30, 3');
});

test('StateView variant: inline equals the inline prop, card is the block on a card surface, badge is a tinted circle', () => {
  const StateView = component(kit, 'components/StateView.tsx');
  const base = { title: 'Nothing saved', body: 'Tap the heart on a product.', actionLabel: 'Browse', onAction: noop, icon: glyph };
  const draw = (props: Props) => render(kit, el(StateView, { ...base, ...props })).view;
  assert.deepEqual(draw({ variant: 'inline' }), draw({ inline: true }));
  const card = draw({ variant: 'card', inline: true });
  const root = styleOf(firstOf(card, 'View'));
  assert.deepEqual(
    [root.alignItems, root.borderRadius, root.backgroundColor, root.borderColor, root.borderWidth, root.paddingVertical, root.paddingHorizontal],
    ['center', tokens.shape.card, light.card, light.border, 0.5, 32, 24],
  );
  assert.deepEqual(styleOf(allOf(card, 'Text')[0] as View), styleOf(allOf(draw({}), 'Text')[0] as View), 'the same title as the block');
  const badged = draw({ variant: 'card', badge: el('Mark') });
  const circle = allOf(badged, 'View')[2] as View;
  assert.deepEqual(styleOf(circle), { alignItems: 'center', justifyContent: 'center', width: 76, height: 76, borderRadius: 38, backgroundColor: light.accent });
  assert.equal((circle.children[0] as View).type, 'Mark');
  assert.equal(allOf(badged, 'Glyph').length, 0, 'the badge takes the icon’s place');
  const inlineBadge = allOf(draw({ variant: 'inline', badge: el('Mark') }), 'View')[2] as View;
  assert.deepEqual([styleOf(inlineBadge).width, styleOf(inlineBadge).borderRadius], [40, 20]);
});

// -------------------------------------------------------- new recipes

test('useCountUp counts from 0 to the target; enabled: false and Reduce Motion show the target at once', () => {
  const useCountUp = kit('components/useCountUp.ts').default as (target: number, options?: Props) => number;
  const probe = (target: number, options?: Props) => el((props: Props) => el('Value', { value: useCountUp(props.target as number, props.options as Props | undefined) }), { target, options });
  const shown = (rendered: ReturnType<typeof render>) => firstOf(rendered.view, 'Value').props.value;

  const counting = render(kit, probe(42));
  assert.equal(shown(counting), 0);
  assert.deepEqual(counting.mount, [['start', { timing: { toValue: 42, duration: 900, delay: 0, easing: { out: 'cubic' }, useNativeDriver: false } }]]);
  assert.deepEqual(render(kit, probe(42, { duration: 500, delay: 120 })).mount[0], ['start', { timing: { toValue: 42, duration: 500, delay: 120, easing: { out: 'cubic' }, useNativeDriver: false } }]);
  for (const [options, device] of [[{ enabled: false }, {}], [undefined, { reduced: true }]] as const) {
    const still = render(kit, probe(42, options), device);
    assert.equal(shown(still), 42);
    assert.deepEqual(still.mount, [['setValue', 42]]);
  }
});

test('Toggle: a switch on Press with its size, track, knob, 44 px target and the profile haptic', () => {
  const Toggle = component(kit, 'components/Toggle.tsx');
  const changes: boolean[] = [];
  const off = render(kit, el(Toggle, { value: false, onValueChange: (next: boolean) => changes.push(next), accessibilityLabel: 'Notifications' }));
  const pressable = firstOf(off.view, 'Pressable');
  assert.deepEqual(
    [pressable.props.accessibilityRole, pressable.props.accessibilityLabel, pressable.props.accessibilityState, pressable.props.hitSlop],
    ['switch', 'Notifications', { disabled: false, checked: false }, 7],
  );
  assert.deepEqual(changes, [true]);
  assert.deepEqual(off.presses[0]?.filter((event) => event[0] === 'haptic'), [], 'the kit profile has no haptic');
  const track = styleOf(allOf(off.view, 'View')[0] as View);
  assert.deepEqual([track.width, track.height, track.padding, track.borderRadius, track.backgroundColor], [50, 30, 3, 15, light.border]);
  const [fill, knob] = allOf(off.view, 'Animated.View').slice(1);
  assert.deepEqual(styleOf(fill as View).backgroundColor, light.primary);
  const knobStyle = styleOf(knob as View);
  assert.deepEqual([knobStyle.width, knobStyle.borderRadius, knobStyle.backgroundColor, knobStyle.shadowOpacity], [24, 12, light['primary-foreground'], 0.08]);
  assert.deepEqual((knobStyle.transform as Array<{ translateX: { interpolate: { outputRange: number[] } } }>)[0]?.translateX.interpolate.outputRange, [0, 20]);
  assert.deepEqual(off.mount, [['start', { spring: { toValue: 0, useNativeDriver: true, speed: 20, bounciness: 6 } }]]);

  const small = render(kit, el(Toggle, { value: true, onValueChange: noop, accessibilityLabel: 'Wi-Fi', size: 'sm', haptic: 'selection' }));
  assert.equal(firstOf(small.view, 'Pressable').props.hitSlop, 8);
  assert.deepEqual([styleOf(allOf(small.view, 'View')[0] as View).width, styleOf(allOf(small.view, 'Animated.View')[2] as View).width], [48, 22]);
  assert.deepEqual(small.presses[0]?.filter((event) => event[0] === 'haptic'), [['haptic', 'selection']]);
  const disabled = render(kit, el(Toggle, { value: true, onValueChange: noop, accessibilityLabel: 'Wi-Fi', disabled: true })).view;
  assert.deepEqual(firstOf(disabled, 'Pressable').props.accessibilityState, { disabled: true, checked: true });
  assert.equal(styleOf(firstOf(disabled, 'Animated.View')).opacity, 0.45);
  assert.deepEqual(render(kit, el(Toggle, { value: true, onValueChange: noop, accessibilityLabel: 'Wi-Fi' }), { reduced: true }).mount, [['setValue', 1]]);
});

test('Snackbar: hidden draws nothing; shown it rises in, is announced, and the action runs then dismisses', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const Snackbar = component(kit, 'components/Snackbar.tsx');
  assert.deepEqual(render(kit, el(Snackbar, { visible: false, message: 'Removed', onDismiss: noop })).view, []);
  const calls: string[] = [];
  const props = { visible: true, message: 'Removed from bag', actionLabel: 'Undo', onAction: () => calls.push('action'), onDismiss: () => calls.push('dismiss') };
  const shown = render(kit, el(Snackbar, props));
  const layer = styleOf(firstOf(shown.view, 'Animated.View'));
  assert.deepEqual([layer.position, layer.left, layer.right, layer.bottom, layer.pointerEvents], ['absolute', 16, 16, 16, 'box-none']);
  const bar = firstOf(shown.view, 'View');
  assert.equal(bar.props.accessibilityLiveRegion, 'polite');
  assert.deepEqual([styleOf(bar).backgroundColor, styleOf(bar).borderRadius, styleOf(bar).paddingRight], [light.inverse, tokens.shape.control, 8]);
  assert.deepEqual(
    allOf(shown.view, 'Text').map((text) => [textOf(text), styleOf(text).color]),
    [
      ['Removed from bag', light['inverse-foreground']],
      ['Undo', light['inverse-foreground']],
    ],
  );
  assert.deepEqual(shown.mount.slice(0, 2), [
    ['start', { timing: { toValue: 1, duration: 250, easing: { bezier: [0.2, 0, 0, 1] }, useNativeDriver: true } }],
    ['announce', 'Removed from bag'],
  ]);
  assert.equal(firstOf(shown.view, 'Pressable').props.accessibilityLabel, 'Undo');
  assert.deepEqual(calls, ['action', 'dismiss']);
  // Android and the web read the live region: no second announcement.
  assert.deepEqual(render(kit, el(Snackbar, props), { os: 'android' }).mount.filter((event) => event[0] === 'announce'), []);
  // Reduce Motion: it appears where it ends.
  const still = render(kit, el(Snackbar, props), { reduced: true });
  assert.deepEqual(still.mount[0], ['setValue', 1]);
  const rise = styleOf(firstOf(still.view, 'Animated.View')).transform as Array<{ translateY: { interpolate: { outputRange: number[] } } }>;
  assert.deepEqual(rise[0]?.translateY.interpolate.outputRange, [0, 0]);
  // No action: no button, even padding.
  const plainBar = render(kit, el(Snackbar, { visible: true, message: 'Saved', onDismiss: noop, bottom: 96 }));
  assert.equal(findAll(plainBar.tree, 'Pressable').length, 0);
  assert.equal(styleOf(firstOf(plainBar.view, 'Animated.View')).bottom, 96);
  const plainStyle = styleOf(firstOf(plainBar.view, 'View'));
  assert.deepEqual([plainStyle.paddingHorizontal, plainStyle.paddingRight], [20, undefined]);
});

test('Snackbar asks to close after its duration; 0 keeps it up', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const Snackbar = component(kit, 'components/Snackbar.tsx');
  let dismissed = 0;
  render(kit, el(Snackbar, { visible: true, message: 'Saved', onDismiss: () => (dismissed += 1) }));
  render(kit, el(Snackbar, { visible: true, message: 'Kept', duration: 0, onDismiss: () => (dismissed += 100) }));
  // The timeout waits on the platform's recommended length (a promise).
  await new Promise((resolve) => setImmediate(resolve));
  t.mock.timers.tick(3999);
  assert.equal(dismissed, 0);
  t.mock.timers.tick(1);
  assert.equal(dismissed, 1);
  t.mock.timers.tick(60_000);
  assert.equal(dismissed, 1);
});

test('ProductCard: image well, price in its currency, struck old price, one name for the card, heart and slots', () => {
  const card = kit('components/commerce/ProductCard.tsx');
  const formatPrice = card.formatPrice as (value: number, currency?: string) => string;
  assert.equal(formatPrice(12.5), '$12.50');
  assert.equal(formatPrice(1234, 'EUR'), '€1,234.00');
  assert.equal(formatPrice(3, 'nope'), 'nope 3.00');

  const ProductCard = card.default as (props: Props) => unknown;
  const product = { id: 'p1', name: 'Linen shirt', price: 89, compareAt: 120, image: 'https://example.com/p1.jpg', badge: 'New' };
  const opened: unknown[] = [];
  const hearted: unknown[] = [];
  const drawn = render(kit, el(ProductCard, { product, width: 160, onOpen: (p: unknown) => opened.push(p), onHeart: (p: unknown) => hearted.push(p), saved: true, footer: el('Footer') }));
  const [open, heart] = findAll(drawn.tree, 'Pressable') as [HostNode, HostNode];
  assert.equal(open.props.accessibilityLabel, 'Linen shirt, $89.00, was $120.00, New');
  assert.equal(open.props.accessibilityRole, 'link');
  assert.equal(heart.props.accessibilityLabel, 'Remove Linen shirt from saved');
  assert.deepEqual(heart.props.accessibilityState, { disabled: false, selected: true });
  assert.deepEqual([opened, hearted], [[product], [product]]);

  const well = styleOf(allOf(drawn.view, 'View')[1] as View);
  assert.deepEqual([well.height, well.borderRadius, well.backgroundColor, well.overflow], [200, tokens.shape.well, light.muted, 'hidden']);
  assert.deepEqual(firstOf(drawn.view, 'Image').props.source, { uri: product.image });
  const [name, price, was, tag] = allOf(drawn.view, 'Text');
  assert.deepEqual([name && textOf(name), price && textOf(price), was && textOf(was), tag && textOf(tag)], ['Linen shirt', '$89.00', '$120.00', 'NEW']);
  assert.deepEqual(price && styleOf(price).fontVariant, ['tabular-nums'], 'the price is the numeric role');
  assert.equal(was && styleOf(was).textDecorationLine, 'line-through');
  assert.equal(firstOf(drawn.view, 'Path').props.fill, light.tertiary, 'a saved heart is filled with the likes colour');
  const root = drawn.view[0] as View;
  assert.deepEqual(
    root.children.map((child) => (typeof child === 'string' ? child : child.type)),
    ['Pressable', 'Footer', 'View', 'View'],
    'footer and heart sit outside the card’s press area',
  );

  const bare = render(kit, el(ProductCard, { product: { ...product, compareAt: 80, badge: undefined }, width: 100, onOpen: noop, badgeSlot: el('Sale') }));
  assert.equal(findAll(bare.tree, 'Pressable').length, 1, 'no heart without onHeart');
  assert.equal(allOf(bare.view, 'Text').length, 2, 'no struck price when compareAt is not higher');
  assert.equal(allOf(bare.view, 'Sale').length, 1);
  assert.equal(styleOf(allOf(bare.view, 'View')[1] as View).height, 125);
});

test('every catalog file imports only react, react-native, react-native-svg and relative paths without an extension', () => {
  const allowed = ['react', 'react-native', 'react-native-svg'];
  for (const rel of listFiles().filter((path) => /\.tsx?$/.test(path))) {
    const text = readFileSync(join(FILES_DIR, rel), 'utf8');
    for (const match of text.matchAll(/^[ \t]*(?:import|export)\s+(?:[^'"`;]*?\s+from\s+)?['"]([^'"]+)['"]/gm)) {
      const specifier = match[1] ?? '';
      if (specifier.startsWith('.')) assert.doesNotMatch(specifier, /\.[cm]?[jt]sx?$/, `${rel}: ${specifier}`);
      else assert.ok(allowed.includes(specifier), `${rel}: ${specifier}`);
    }
  }
});
