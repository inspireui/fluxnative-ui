import { Children, isValidElement, type ReactNode } from 'react';
import { ICONS, type IconName, type IconSpec } from '@fluxnative/icons/table';

export type SFSymbolName = string;

export interface FluxTabProps {
  /** The route file name inside the tabs folder (`index`, `settings`). */
  name: string;
  label: string;
  /**
   * One name from the `@fluxnative/icons` table: the SF Symbol on iOS, the
   * SVG glyph on Android and web. `sf` and `icon` override it per platform.
   */
  iconName?: IconName;
  /** SF Symbol for the native iOS tab bar: `'house'` or `{ default: 'house', selected: 'house.fill' }`. */
  sf?: SFSymbolName | { default: SFSymbolName; selected: SFSymbolName };
  /** Icon for the glass tab bar drawn on Android and web. */
  icon?: (state: { focused: boolean; color: string }) => ReactNode;
  /** `search` gives the tab the system search role on iOS 26+. */
  role?: 'search';
  badge?: number | string;
}

/** Declares one tab. Renders nothing itself; `FluxTabs` reads its props. */
export function Tab(_props: FluxTabProps): null {
  return null;
}

export function collectTabs(children: ReactNode): FluxTabProps[] {
  return Children.toArray(children)
    .filter((child) => isValidElement(child) && child.type === Tab)
    .map((child) => (child as { props: FluxTabProps }).props);
}

/** The SF Symbol(s) a tab shows on iOS: `sf`, else the table entry for `iconName`. */
export function tabSymbol(tab: FluxTabProps): FluxTabProps['sf'] {
  if (tab.sf !== undefined) return tab.sf;
  if (tab.iconName === undefined) return undefined;
  const spec: IconSpec = ICONS[tab.iconName];
  return { default: spec.sf, selected: spec.sfSelected ?? spec.sf };
}

export interface FluxTabsProps {
  children?: ReactNode;
  /**
   * iOS 26+ only: how the native tab bar shrinks while content scrolls.
   * Android and web draw the floating `TabBar`, which ignores it.
   */
  minimize?: 'automatic' | 'never' | 'onScrollDown' | 'onScrollUp';
}
