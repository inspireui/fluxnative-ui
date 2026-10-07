// A screen: content scrolls under the glass chrome. Screen lifts its
// <AppBar> out of the scroll view and floats it on top; a custom-tier bar
// reports its height so content starts below it, while a native bar
// reports 0 and iOS insets the content itself.

import React, {
  Children,
  createContext,
  isValidElement,
  useContext,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type ReactNode,
} from 'react';
import { Animated, Platform, StyleSheet, View, type ScrollViewProps, type ViewProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useClassProps, usePalette } from './provider.tsx';
import { FloatingTabBarContext, useTabBarInset } from './TabBar.tsx';

export type ScrollEdge = 'automatic' | 'soft' | 'hard' | 'none';

interface ScreenState {
  scrollY: Animated.Value;
  scrollEdge: ScrollEdge;
  setTopChromeHeight: (height: number) => void;
}

const ScreenContext = createContext<ScreenState | null>(null);
export const useScreen = () => useContext(ScreenContext);

/** Components that float above content mark themselves with this. */
export const TOP_CHROME = Symbol.for('fluxnative-ui.top-chrome');

const ClassView = View as ComponentType<ViewProps & { className?: string }>;

export interface ScreenProps {
  children?: ReactNode;
  /** Wrap content in a scroll view that runs under the bars. Default true. */
  scroll?: boolean;
  /** How chrome separates from content scrolled under it. */
  scrollEdge?: ScrollEdge;
  className?: string;
  contentContainerClassName?: string;
  scrollViewProps?: Omit<ScrollViewProps, 'children' | 'onScroll' | 'contentContainerStyle'>;
}

function isTopChrome(node: ReactNode): boolean {
  return isValidElement(node) && typeof node.type !== 'string' && TOP_CHROME in (node.type as object);
}

export function Screen({
  children,
  scroll = true,
  scrollEdge = 'automatic',
  className,
  contentContainerClassName,
  scrollViewProps,
}: ScreenProps) {
  const palette = usePalette();
  const scrollY = useRef(new Animated.Value(0)).current;
  const [topChrome, setTopChromeHeight] = useState(0);
  // Under a floating glass tab bar, content must scroll clear of it.
  const tabInset = useTabBarInset();
  const bottomChrome = useContext(FloatingTabBarContext) ? tabInset : 0;
  const state = useMemo(() => ({ scrollY, scrollEdge, setTopChromeHeight }), [scrollY, scrollEdge]);

  const all = Children.toArray(children);
  const chrome = all.filter(isTopChrome);
  const content = all.filter((node) => !isTopChrome(node));

  const root = useClassProps(className, [styles.root, { backgroundColor: palette.background }]);
  // Two layers: the scroll container clears the chrome, and an inner view
  // carries the caller's classes — so `pb-8` adds to the tab bar inset
  // instead of being overwritten by it.
  const inner = useClassProps(contentContainerClassName, scroll ? undefined : styles.root);
  // iOS scroll views already inset content by the safe area
  // (contentInsetAdjustmentBehavior="automatic"); the chrome heights include
  // it, so take it back out there or the gap doubles.
  const safe = useSafeAreaInsets();
  const ios = Platform.OS === 'ios' && scroll;
  const insets = {
    paddingTop: ios ? Math.max(0, topChrome - safe.top) : topChrome,
    paddingBottom: ios ? Math.max(0, bottomChrome - safe.bottom) : bottomChrome,
  };
  const body = <ClassView {...(inner as ViewProps)}>{content}</ClassView>;

  return (
    <ScreenContext.Provider value={state}>
      <ClassView {...(root as ViewProps)}>
        {scroll ? (
          <Animated.ScrollView
            {...scrollViewProps}
            contentContainerStyle={insets}
            scrollIndicatorInsets={{ top: insets.paddingTop, bottom: insets.paddingBottom }}
            // Under a native bar, iOS insets the content by the bar's height.
            contentInsetAdjustmentBehavior="automatic"
            scrollEventThrottle={16}
            onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
              useNativeDriver: true,
            })}
          >
            {body}
          </Animated.ScrollView>
        ) : (
          <View style={[styles.root, insets]}>{body}</View>
        )}
        {chrome}
      </ClassView>
    </ScreenContext.Provider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
