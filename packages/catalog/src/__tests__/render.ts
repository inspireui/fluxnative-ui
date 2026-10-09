// A stand-in React and react-native, just enough to render the catalog's
// primitives in node: each file is transpiled with the TypeScript compiler
// and run against stubs, function components are called with their props
// (hooks are plain functions), and the tree is expanded down to host views
// (View, Text, Pressable…). What a host view receives (flattened style,
// accessibility props, hit slop) is what a device would draw, so two
// renders that agree here look and behave the same. Animations and haptics
// are recorded, not run.

import { existsSync, readFileSync, statSync } from 'node:fs';
import { join, posix } from 'node:path';
import ts from 'typescript';

export type Exports = Record<string, unknown>;
export type Props = Record<string, unknown>;
export type Component = (props: Props) => unknown;
export interface Element {
  type: unknown;
  props: Props;
}
export interface HostNode {
  type: string;
  props: Props;
  children: Array<HostNode | string>;
}

export const FRAGMENT = Symbol('Fragment');

/** Side effects, in order: animations started, values set, haptics, announcements. */
export const log: unknown[][] = [];
let effects: Array<() => unknown> = [];

/** What the stubs report about the device. */
export const env = { scheme: 'light' as 'light' | 'dark', os: 'ios' as 'ios' | 'android' };

export function el(type: unknown, props: Props = {}, ...children: unknown[]): Element {
  const all: Props = { ...props };
  if (children.length === 1) all.children = children[0];
  else if (children.length > 1) all.children = children;
  return { type, props: all };
}

const react = {
  createElement: (type: unknown, props: Props | null, ...children: unknown[]) => el(type, props ?? {}, ...children),
  Fragment: FRAGMENT,
  useRef: (current: unknown) => ({ current }),
  useState: (initial: unknown) => [typeof initial === 'function' ? (initial as () => unknown)() : initial, () => undefined],
  useEffect: (effect: () => unknown) => {
    effects.push(effect);
  },
  useMemo: (make: () => unknown) => make(),
  useCallback: (fn: unknown) => fn,
};

export class AnimatedValue {
  value: number;
  constructor(value: number) {
    this.value = value;
  }
  setValue(value: number): void {
    this.value = value;
    log.push(['setValue', value]);
  }
  interpolate(config: unknown): { interpolate: unknown; of: AnimatedValue } {
    return { interpolate: config, of: this };
  }
  addListener(): string {
    return 'listener';
  }
  removeListener(): void {}
  stopAnimation(): void {}
}

interface Animation {
  describe: () => unknown;
  start: () => void;
  stop: () => void;
}

function animation(describe: () => unknown): Animation {
  return {
    describe,
    start: () => {
      log.push(['start', describe()]);
    },
    stop: () => undefined,
  };
}

const flatten = (style: unknown): Props => {
  if (Array.isArray(style)) return Object.assign({}, ...style.map(flatten)) as Props;
  if (style === null || typeof style !== 'object') return {};
  return { ...(style as Props) };
};

const absoluteFill = { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 };

const reactNative = {
  View: 'View',
  Text: 'Text',
  Pressable: 'Pressable',
  Image: 'Image',
  ActivityIndicator: 'ActivityIndicator',
  ScrollView: 'ScrollView',
  StyleSheet: { create: (styles: unknown) => styles, flatten, hairlineWidth: 0.5, absoluteFill, absoluteFillObject: absoluteFill },
  Animated: {
    Value: AnimatedValue,
    View: 'Animated.View',
    Text: 'Animated.Text',
    timing: (_value: AnimatedValue, config: unknown) => animation(() => ({ timing: config })),
    spring: (_value: AnimatedValue, config: unknown) => animation(() => ({ spring: config })),
    sequence: (parts: Animation[]) => animation(() => ({ sequence: parts.map((part) => part.describe()) })),
    loop: (part: Animation) => animation(() => ({ loop: part.describe() })),
    add: (a: unknown, b: unknown) => ({ add: [a, b] }),
  },
  Easing: {
    bezier: (...points: number[]) => ({ bezier: points }),
    out: (curve: unknown) => ({ out: curve }),
    in: (curve: unknown) => ({ in: curve }),
    inOut: (curve: unknown) => ({ inOut: curve }),
    cubic: 'cubic',
    quad: 'quad',
    linear: 'linear',
    ease: 'ease',
  },
  Platform: {
    get OS() {
      return env.os;
    },
    select: (options: Props) => options[env.os] ?? options.default,
  },
  AccessibilityInfo: {
    // Never settles: the tests set Reduce Motion through the bridge instead.
    isReduceMotionEnabled: () => new Promise<boolean>(() => undefined),
    addEventListener: () => ({ remove: () => undefined }),
    announceForAccessibility: (message: string) => {
      log.push(['announce', message]);
    },
    getRecommendedTimeoutMillis: (ms: number) => Promise.resolve(ms),
  },
  PanResponder: { create: () => ({ panHandlers: { panHandlers: true } }) },
  useColorScheme: () => env.scheme,
};

const STUBS: Record<string, unknown> = {
  react,
  'react-native': reactNative,
  'react-native-svg': { __esModule: true, default: 'Svg', Path: 'Path' },
};

/** Returns a file's source under a `files/`-relative path, or undefined. */
export type Layer = (rel: string) => string | undefined;

export function dirLayer(dir: string): Layer {
  return (rel) => {
    const file = join(dir, rel);
    return existsSync(file) && statSync(file).isFile() ? readFileSync(file, 'utf8') : undefined;
  };
}

/** `components/X.tsx` read from `<dir>/X.tsx.txt`: sources kept as fixtures. */
export function fixtureLayer(dir: string): Layer {
  return (rel) => {
    if (!rel.startsWith('components/')) return undefined;
    const file = join(dir, `${posix.basename(rel)}.txt`);
    return existsSync(file) ? readFileSync(file, 'utf8') : undefined;
  };
}

export type Loader = (rel: string) => Exports;

/**
 * Loads `files/`-relative modules from the first layer that has them.
 * `overrides` replaces whole modules (a brand's `theme/tokens.ts`).
 */
export function loader(layers: Layer[], overrides: Record<string, Exports> = {}): Loader {
  const cache = new Map<string, Exports>();
  const sourceOf = (path: string) => layers.map((layer) => layer(path)).find((text) => text !== undefined);
  const find = (rel: string): string => {
    const hit = [rel, `${rel}.ts`, `${rel}.tsx`].find((path) => path in overrides || sourceOf(path) !== undefined);
    if (hit === undefined) throw new Error(`no module ${rel}`);
    return hit;
  };
  const load = (path: string): Exports => {
    const replaced = overrides[path];
    if (replaced !== undefined) return replaced;
    const cached = cache.get(path);
    if (cached !== undefined) return cached;
    const source = sourceOf(path) ?? '';
    const exports: Exports = {};
    cache.set(path, exports);
    const { outputText } = ts.transpileModule(source, {
      fileName: path,
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React, esModuleInterop: true },
    });
    const require = (specifier: string): unknown => {
      if (specifier in STUBS) return STUBS[specifier];
      if (!specifier.startsWith('.')) throw new Error(`${path} imports ${specifier}`);
      return load(find(posix.normalize(posix.join(posix.dirname(path), specifier))));
    };
    new Function('require', 'exports', 'module', outputText)(require, exports, { exports });
    return exports;
  };
  return (rel) => load(find(rel));
}

/** Expands elements down to host views, calling every function component. */
export function expand(node: unknown): Array<HostNode | string> {
  if (node === null || node === undefined || typeof node === 'boolean') return [];
  if (typeof node === 'string' || typeof node === 'number') return [String(node)];
  if (Array.isArray(node)) return node.flatMap(expand);
  const { type, props } = node as Element;
  if (type === FRAGMENT) return expand(props.children);
  if (typeof type === 'function') return expand((type as Component)(props));
  const { children, ...rest } = props;
  return [{ type: String(type), props: rest, children: expand(children) }];
}

/** Data only: functions become a marker, animated values their current value. */
export function plain(value: unknown): unknown {
  if (typeof value === 'function') return '[function]';
  if (value instanceof AnimatedValue) return { animated: value.value };
  if (Array.isArray(value)) return value.map(plain);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).flatMap(([key, inner]) => (inner === undefined ? [] : [[key, plain(inner)]])));
  }
  return value;
}

/**
 * A style as the device applies it. `letterSpacing: 0` and `fontWeight: '400'`
 * are what an unset style already is: a `type` role spells them out.
 */
export function drawn(style: unknown): Props {
  const out = plain(flatten(style)) as Props;
  if (out.letterSpacing === 0) delete out.letterSpacing;
  if (out.fontWeight === '400' || out.fontWeight === 'normal') delete out.fontWeight;
  return out;
}

export interface View {
  type: string;
  props: Props;
  children: Array<View | string>;
}

export function snapshot(nodes: Array<HostNode | string>): Array<View | string> {
  return nodes.map((node) =>
    typeof node === 'string'
      ? node
      : {
          type: node.type,
          props: Object.fromEntries(
            Object.entries(node.props).flatMap(([key, value]) => (value === undefined ? [] : [[key, key === 'style' ? drawn(value) : plain(value)]])),
          ),
          children: snapshot(node.children),
        },
  );
}

export function findAll(nodes: Array<HostNode | string>, type: string): HostNode[] {
  return nodes.flatMap((node) => (typeof node === 'string' ? [] : [...(node.type === type ? [node] : []), ...findAll(node.children, type)]));
}

export interface Rendered {
  /** The host views, as data. */
  view: Array<View | string>;
  /** What mounting did: effects run once, in render order. */
  mount: unknown[][];
  /** Per Pressable, what press-in, press-out and press did. */
  presses: unknown[][][];
  tree: Array<HostNode | string>;
}

export interface Device {
  scheme?: 'light' | 'dark';
  os?: 'ios' | 'android';
  reduced?: boolean;
}

/** Renders `element` with `load`'s modules on a device, mounts it, then presses every Pressable. */
export function render(load: Loader, element: Element, device: Device = {}): Rendered {
  env.scheme = device.scheme ?? 'light';
  env.os = device.os ?? 'ios';
  (load('components/bridge.ts').setReducedMotion as (value: boolean) => void)(device.reduced ?? false);
  const host = globalThis as { flux?: unknown };
  host.flux = { ui: { haptic: (kind: string) => log.push(['haptic', kind]) } };
  log.length = 0;
  effects = [];
  try {
    const tree = expand(element);
    const view = snapshot(tree);
    for (const effect of effects.splice(0)) effect();
    const mount = log.splice(0);
    const presses = findAll(tree, 'Pressable').map((node) => {
      for (const handler of ['onPressIn', 'onPressOut', 'onPress']) (node.props[handler] as ((event?: unknown) => void) | undefined)?.({});
      return log.splice(0);
    });
    return { view, mount, presses, tree };
  } finally {
    delete host.flux;
  }
}

/** The default export of a layer file, as a component. */
export function component(load: Loader, rel: string): Component {
  return load(rel).default as Component;
}
