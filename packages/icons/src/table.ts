// The closed icon set. One name maps to the three ways a FluxNative surface
// draws it: an SF Symbol (iOS native tab bar, expo-symbols), a Material
// Symbol (Android native surfaces) and an inline SVG path on a 24×24 grid
// (what <Icon> draws everywhere, including Flux templates and the web).
//
// Adding an icon means adding one row here. Names are closed on purpose:
// `tsc` rejects a typo, and the catalog layer emits a template-side copy
// (`files/components/Icon.tsx`) from this same table.

export interface IconSpec {
  /** SF Symbol name; `sfSelected` is the filled variant a selected tab uses. */
  sf: string;
  sfSelected?: string;
  /** Material Symbols name. */
  material: string;
  /** SVG path data on a 24×24 grid, drawn as a 2px round stroke. */
  path: string;
  /** Path data to fill when the icon is drawn `filled`. Defaults to `path`. */
  fillPath?: string;
}

const CIRCLE = 'M12 3a9 9 0 1 0 0 18a9 9 0 0 0 0-18z';

export const ICONS = {
  'chevron-left': { sf: 'chevron.left', material: 'chevron_left', path: 'M15 6l-6 6 6 6' },
  'chevron-right': { sf: 'chevron.right', material: 'chevron_right', path: 'M9 6l6 6-6 6' },
  'chevron-up': { sf: 'chevron.up', material: 'expand_less', path: 'M6 15l6-6 6 6' },
  'chevron-down': { sf: 'chevron.down', material: 'expand_more', path: 'M6 9l6 6 6-6' },
  'arrow-left': { sf: 'arrow.left', material: 'arrow_back', path: 'M19 12H5M11 6l-6 6 6 6' },
  'arrow-right': { sf: 'arrow.right', material: 'arrow_forward', path: 'M5 12h14M13 6l6 6-6 6' },
  'arrow-up': { sf: 'arrow.up', material: 'arrow_upward', path: 'M12 19V5M6 11l6-6 6 6' },
  'arrow-down': { sf: 'arrow.down', material: 'arrow_downward', path: 'M12 5v14M6 13l6 6 6-6' },
  'arrow-up-right': { sf: 'arrow.up.right', material: 'north_east', path: 'M7 17L17 7M8 7h9v9' },
  close: { sf: 'xmark', material: 'close', path: 'M6 6l12 12M18 6L6 18' },
  check: { sf: 'checkmark', material: 'check', path: 'M5 12l5 5L20 7' },
  plus: { sf: 'plus', material: 'add', path: 'M12 5v14M5 12h14' },
  minus: { sf: 'minus', material: 'remove', path: 'M5 12h14' },
  search: { sf: 'magnifyingglass', material: 'search', path: 'M11 4a7 7 0 1 0 0 14a7 7 0 0 0 0-14zM20 20l-4-4' },
  home: {
    sf: 'house',
    sfSelected: 'house.fill',
    material: 'home',
    path: 'M4 11l8-7 8 7v9a1 1 0 0 1-1 1h-4v-6h-6v6H5a1 1 0 0 1-1-1z',
  },
  bag: {
    sf: 'bag',
    sfSelected: 'bag.fill',
    material: 'shopping_bag',
    path: 'M6 8h12l1 12H5L6 8zM9 8V6a3 3 0 0 1 6 0v2',
    fillPath: 'M6 8h12l1 12H5L6 8z',
  },
  cart: {
    sf: 'cart',
    sfSelected: 'cart.fill',
    material: 'shopping_cart',
    path: 'M3 4h2l2.5 11h10l2-7H6.5M9 20a1 1 0 1 0 0-2a1 1 0 0 0 0 2M17 20a1 1 0 1 0 0-2a1 1 0 0 0 0 2',
  },
  heart: {
    sf: 'heart',
    sfSelected: 'heart.fill',
    material: 'favorite',
    path: 'M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10z',
  },
  star: {
    sf: 'star',
    sfSelected: 'star.fill',
    material: 'star',
    path: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z',
  },
  bell: {
    sf: 'bell',
    sfSelected: 'bell.fill',
    material: 'notifications',
    path: 'M6 16v-5a6 6 0 0 1 12 0v5l1.5 2h-15zM10 20a2 2 0 0 0 4 0',
    fillPath: 'M6 16v-5a6 6 0 0 1 12 0v5l1.5 2h-15z',
  },
  menu: { sf: 'line.3.horizontal', material: 'menu', path: 'M4 7h16M4 12h16M4 17h16' },
  dots: {
    sf: 'ellipsis',
    material: 'more_horiz',
    path: 'M5 11a1 1 0 1 0 0 2a1 1 0 0 0 0-2zM12 11a1 1 0 1 0 0 2a1 1 0 0 0 0-2zM19 11a1 1 0 1 0 0 2a1 1 0 0 0 0-2z',
  },
  'dots-vertical': {
    sf: 'ellipsis',
    material: 'more_vert',
    path: 'M11 5a1 1 0 1 0 2 0a1 1 0 0 0-2 0zM11 12a1 1 0 1 0 2 0a1 1 0 0 0-2 0zM11 19a1 1 0 1 0 2 0a1 1 0 0 0-2 0z',
  },
  filter: { sf: 'line.3.horizontal.decrease', material: 'filter_list', path: 'M4 6h16M7 12h10M10 18h4' },
  sliders: {
    sf: 'slider.horizontal.3',
    material: 'tune',
    path: 'M4 7h10M18 7h2M4 17h4M12 17h8M14 5v4M8 15v4',
  },
  share: {
    sf: 'square.and.arrow.up',
    material: 'share',
    path: 'M12 15V4M8 8l4-4 4 4M5 13v6a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-6',
  },
  person: {
    sf: 'person',
    sfSelected: 'person.fill',
    material: 'person',
    path: 'M12 12a4 4 0 1 0 0-8a4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0',
  },
  people: {
    sf: 'person.2',
    sfSelected: 'person.2.fill',
    material: 'group',
    path: 'M9 12a3.5 3.5 0 1 0 0-7a3.5 3.5 0 0 0 0 7zM2 20a7 7 0 0 1 14 0M16 5.5a3.5 3.5 0 0 1 0 6.5M18 13.5a6 6 0 0 1 4 6.5',
  },
  bookmark: {
    sf: 'bookmark',
    sfSelected: 'bookmark.fill',
    material: 'bookmark',
    path: 'M6 4h12v17l-6-4-6 4z',
  },
  clock: { sf: 'clock', material: 'schedule', path: `${CIRCLE}M12 7v5l3 2` },
  calendar: { sf: 'calendar', material: 'calendar_today', path: 'M5 6h14v14H5zM5 10h14M8 3v4M16 3v4' },
  pin: {
    sf: 'mappin.and.ellipse',
    material: 'location_on',
    path: 'M12 21s-6-5.5-6-11a6 6 0 0 1 12 0c0 5.5-6 11-6 11zM12 12a2 2 0 1 0 0-4a2 2 0 0 0 0 4z',
  },
  grid: {
    sf: 'square.grid.2x2',
    sfSelected: 'square.grid.2x2.fill',
    material: 'grid_view',
    path: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  },
  list: { sf: 'list.bullet', material: 'list', path: 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01' },
  mail: {
    sf: 'envelope',
    sfSelected: 'envelope.fill',
    material: 'mail',
    path: 'M4 6h16v12H4zM4 7l8 6 8-6',
    fillPath: 'M4 6h16v12H4z',
  },
  eye: {
    sf: 'eye',
    material: 'visibility',
    path: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7zM12 15a3 3 0 1 0 0-6a3 3 0 0 0 0 6z',
  },
  'eye-off': {
    sf: 'eye.slash',
    material: 'visibility_off',
    path: 'M3 3l18 18M10 6.2A10 10 0 0 1 12 6c6 0 10 6 10 6a17 17 0 0 1-3.6 4M6.3 7.6A16 16 0 0 0 2 12s4 7 10 7a9 9 0 0 0 3.4-.7M9.9 9.9a3 3 0 0 0 4.2 4.2',
  },
  camera: {
    sf: 'camera',
    sfSelected: 'camera.fill',
    material: 'photo_camera',
    path: 'M4 8h3l2-3h6l2 3h3v11H4zM12 16a3 3 0 1 0 0-6a3 3 0 0 0 0 6z',
  },
  scan: { sf: 'qrcode.viewfinder', material: 'qr_code_scanner', path: 'M4 8V4h4M16 4h4v4M20 16v4h-4M8 20H4v-4M4 12h16' },
  trash: { sf: 'trash', material: 'delete', path: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6' },
  pencil: { sf: 'pencil', material: 'edit', path: 'M4 20l4-1L19 8l-3-3L5 16zM14 7l3 3' },
  info: { sf: 'info.circle', material: 'info', path: `${CIRCLE}M12 11v5M12 8h.01` },
  alert: { sf: 'exclamationmark.triangle', material: 'warning', path: 'M12 3l10 18H2zM12 10v4M12 17h.01' },
  settings: {
    sf: 'gearshape',
    sfSelected: 'gearshape.fill',
    material: 'settings',
    path: 'M12 8.5a3.5 3.5 0 1 0 0 7a3.5 3.5 0 0 0 0-7zM10 3h4l.6 2.4 2.1 1.2 2.3-.8 2 3.4-1.8 1.7v2.2l1.8 1.7-2 3.4-2.3-.8-2.1 1.2L14 21h-4l-.6-2.4-2.1-1.2-2.3.8-2-3.4 1.8-1.7v-2.2L3 9.2l2-3.4 2.3.8 2.1-1.2z',
  },
  tag: { sf: 'tag', sfSelected: 'tag.fill', material: 'sell', path: 'M3 12V4h8l9 9-8 8zM7 8h.01' },
  truck: {
    sf: 'shippingbox',
    material: 'local_shipping',
    path: 'M2 7h12v9H2zM14 10h4l3 3v3h-7zM6 19a2 2 0 1 0 0-4a2 2 0 0 0 0 4zM17 19a2 2 0 1 0 0-4a2 2 0 0 0 0 4z',
  },
  box: { sf: 'shippingbox', material: 'inventory_2', path: 'M12 3l8 4.5v9L12 21l-8-4.5v-9zM4 7.5l8 4.5 8-4.5M12 12v9' },
  refresh: { sf: 'arrow.clockwise', material: 'refresh', path: 'M20 12a8 8 0 1 1-2.3-5.7M20 4v5h-5' },
  play: { sf: 'play', sfSelected: 'play.fill', material: 'play_arrow', path: 'M7 4l13 8-13 8z' },
  pause: { sf: 'pause', sfSelected: 'pause.fill', material: 'pause', path: 'M7 5h4v14H7zM13 5h4v14h-4z' },
  globe: { sf: 'globe', material: 'public', path: `${CIRCLE}M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18` },
  sun: {
    sf: 'sun.max',
    material: 'light_mode',
    path: 'M12 16a4 4 0 1 0 0-8a4 4 0 0 0 0 8zM12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
  },
  moon: { sf: 'moon', sfSelected: 'moon.fill', material: 'dark_mode', path: 'M20 15A8 8 0 0 1 9 4a8 8 0 1 0 11 11z' },
  lock: { sf: 'lock', sfSelected: 'lock.fill', material: 'lock', path: 'M6 11h12v10H6zM9 11V7a3 3 0 0 1 6 0v4', fillPath: 'M6 11h12v10H6z' },
  gift: {
    sf: 'gift',
    sfSelected: 'gift.fill',
    material: 'card_giftcard',
    path: 'M3 9h18v4H3zM5 13h14v8H5zM12 9v12M12 9c-2-4-6-4-6-1s4 1 6 1M12 9c2-4 6-4 6-1s-4 1-6 1',
  },
  percent: { sf: 'percent', material: 'percent', path: 'M19 5L5 19M7 9a2 2 0 1 0 0-4a2 2 0 0 0 0 4zM17 19a2 2 0 1 0 0-4a2 2 0 0 0 0 4z' },
  'credit-card': { sf: 'creditcard', sfSelected: 'creditcard.fill', material: 'credit_card', path: 'M3 6h18v12H3zM3 10h18M7 15h3' },
  wallet: { sf: 'wallet.pass', material: 'account_balance_wallet', path: 'M3 7h18v12H3zM3 7V5h14v2M16 12h5v3h-5z' },
  chat: { sf: 'bubble.left', sfSelected: 'bubble.left.fill', material: 'chat_bubble', path: 'M4 5h16v11H9l-5 4z' },
  send: { sf: 'paperplane', sfSelected: 'paperplane.fill', material: 'send', path: 'M21 3L3 10l8 2 2 8zM11 12l10-9' },
  copy: { sf: 'doc.on.doc', material: 'content_copy', path: 'M9 9h11v11H9zM5 15H4V4h11v1' },
  link: { sf: 'link', material: 'link', path: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1' },
  mic: { sf: 'mic', sfSelected: 'mic.fill', material: 'mic', path: 'M12 15a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3zM6 11a6 6 0 0 0 12 0M12 17v4' },
  image: { sf: 'photo', material: 'image', path: 'M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4M9 9h.01' },
  sparkle: { sf: 'sparkles', material: 'auto_awesome', path: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.8 2.2 2.2.8-2.2.8L19 22l-.8-2.2-2.2-.8 2.2-.8z' },
  shirt: { sf: 'tshirt', sfSelected: 'tshirt.fill', material: 'checkroom', path: 'M8 4l4 2 4-2 4 3-2 3-2-1v12H8V9L6 10 4 7z' },
  diamond: { sf: 'diamond', material: 'diamond', path: 'M3 9l4-5h10l4 5-9 12zM3 9h18M9 4l3 5 3-5M7 9l5 12M17 9l-5 12' },
  store: { sf: 'storefront', material: 'storefront', path: 'M4 10l1-5h14l1 5M4 10v10h16V10M9 20v-6h6v6M4 10a2.5 2.5 0 0 0 5 0a2.5 2.5 0 0 0 5 0a2.5 2.5 0 0 0 5 0' },
  ticket: { sf: 'ticket', sfSelected: 'ticket.fill', material: 'confirmation_number', path: 'M3 8a2 2 0 0 0 2-2h14a2 2 0 0 0 2 2v3a2 2 0 0 0 0 2v3a2 2 0 0 0-2 2H5a2 2 0 0 0-2-2v-3a2 2 0 0 0 0-2zM12 8v1M12 11.5v1M12 15v1' },
  receipt: { sf: 'doc.text', material: 'receipt', path: 'M5 3h14v18l-2-1.5L15 21l-2-1.5L11 21l-2-1.5L7 21l-2-1.5zM8 8h8M8 12h8M8 16h5' },
  help: { sf: 'questionmark.circle', material: 'help', path: `${CIRCLE}M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 1-1 1.7M12 17h.01` },
  logout: { sf: 'rectangle.portrait.and.arrow.right', material: 'logout', path: 'M10 4H5v16h5M14 8l4 4-4 4M18 12H9' },
  zap: { sf: 'bolt', sfSelected: 'bolt.fill', material: 'bolt', path: 'M13 3L4 14h7l-1 7 9-11h-7z' },
  leaf: { sf: 'leaf', sfSelected: 'leaf.fill', material: 'eco', path: 'M5 20c0-9 5-14 14-15-1 9-6 14-14 15zM5 20l8-8' },
  droplet: { sf: 'drop', sfSelected: 'drop.fill', material: 'water_drop', path: 'M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z' },
  flame: { sf: 'flame', sfSelected: 'flame.fill', material: 'local_fire_department', path: 'M12 3c1 4 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3 1-5 1-9z' },
  location: { sf: 'location', sfSelected: 'location.fill', material: 'navigation', path: 'M3 11l18-8-8 18-2-8z' },
  'minus-circle': { sf: 'minus.circle', material: 'remove_circle', path: `${CIRCLE}M8 12h8` },
  'plus-circle': { sf: 'plus.circle', material: 'add_circle', path: `${CIRCLE}M12 8v8M8 12h8` },
  'check-circle': { sf: 'checkmark.circle', sfSelected: 'checkmark.circle.fill', material: 'check_circle', path: `${CIRCLE}M8 12l3 3 5-6` },
  'x-circle': { sf: 'xmark.circle', material: 'cancel', path: `${CIRCLE}M9 9l6 6M15 9l-6 6` },
  ruler: { sf: 'ruler', material: 'straighten', path: 'M3 17L17 3l4 4L7 21zM7 13l2 2M10 10l2 2M13 7l2 2' },
  repeat: { sf: 'repeat', material: 'repeat', path: 'M17 3l3 3-3 3M20 6H8a4 4 0 0 0-4 4v1M7 21l-3-3 3-3M4 18h12a4 4 0 0 0 4-4v-1' },
  shuffle: { sf: 'shuffle', material: 'shuffle', path: 'M16 4h4v4M4 20l16-16M4 4l5 5M15 15l5 5M20 16v4h-4' },
  volume: { sf: 'speaker.wave.2', material: 'volume_up', path: 'M4 9h4l5-4v14l-5-4H4zM16 9a4 4 0 0 1 0 6M19 6a8 8 0 0 1 0 12' },
  download: { sf: 'arrow.down.to.line', material: 'download', path: 'M12 4v12M7 11l5 5 5-5M4 20h16' },
  upload: { sf: 'arrow.up.to.line', material: 'upload', path: 'M12 16V4M7 9l5-5 5 5M4 20h16' },
  timer: { sf: 'timer', material: 'timer', path: 'M12 5a8 8 0 1 0 0 16a8 8 0 0 0 0-16zM12 9v4l2 2M9 2h6' },
  trophy: { sf: 'trophy', sfSelected: 'trophy.fill', material: 'emoji_events', path: 'M7 4h10v5a5 5 0 0 1-10 0zM7 6H4v2a3 3 0 0 0 3 3M17 6h3v2a3 3 0 0 1-3 3M12 14v4M8 21h8M9 18h6' },
  compass: { sf: 'safari', material: 'explore', path: `${CIRCLE}M15.5 8.5l-2 5-5 2 2-5z` },
} as const satisfies Record<string, IconSpec>;

export type IconName = keyof typeof ICONS;

export const ICON_NAMES = Object.keys(ICONS) as IconName[];

export function isIconName(name: string): name is IconName {
  return Object.prototype.hasOwnProperty.call(ICONS, name);
}
