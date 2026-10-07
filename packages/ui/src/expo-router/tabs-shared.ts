import { Children, isValidElement, type ReactNode } from 'react';

export type SFSymbolName = string;

export interface FluxTabProps {
  /** The route file name inside the tabs folder (`index`, `settings`). */
  name: string;
  label: string;
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

export interface FluxTabsProps {
  children?: ReactNode;
  /**
   * iOS 26+ only: how the native tab bar shrinks while content scrolls.
   * Android and web draw the floating `TabBar`, which ignores it.
   */
  minimize?: 'automatic' | 'never' | 'onScrollDown' | 'onScrollUp';
}
