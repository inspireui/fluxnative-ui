// Generates docs/llm/CATALOG.index.md: the ≤ 8 KB index a model reads before
// it writes a Flux template screen. It is built from the layer itself, so it
// cannot drift: component names and props come from each `export interface
// <Name>Props`, closed unions are inlined from the file's `export type`
// aliases, and the token roles come from the emitted theme/tokens.ts.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CATALOG_VERSION, FILES_DIR, listFiles, render } from './emit.ts';

export const CATALOG_INDEX_LIMIT = 8 * 1024;

interface Prop {
  name: string;
  optional: boolean;
  type: string;
}

interface Component {
  name: string;
  /** Import path from a screen in `screens/`. */
  from: string;
  summary: string;
  props: Prop[];
}

/** `// lines` at the top of a source file, joined, first sentence only. */
function summaryOf(source: string): string {
  const lines: string[] = [];
  for (const line of source.split('\n')) {
    if (!line.startsWith('//')) break;
    lines.push(line.replace(/^\/\/\s?/, ''));
  }
  const text = lines.join(' ').replace(/\s+/g, ' ').trim();
  const sentence = /^(.+?[.!?])(\s|$)/.exec(text)?.[1] ?? text;
  return sentence.replace(/`/g, '');
}

/** `export type Name = 'a' | 'b';` aliases in one file, so props can show the closed values. */
function aliasesOf(source: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of source.matchAll(/^export type (\w+)\s*=\s*([^;]+);/gm)) {
    let value = (m[2] ?? '').replace(/\s+/g, ' ').trim();
    value = /^Extract<\w+,\s*(.+)>$/.exec(value)?.[1] ?? value;
    if (/^'[^']*'(\s*\|\s*'[^']*')*$/.test(value)) out[m[1] ?? ''] = value.replace(/\s*\|\s*/g, '|');
  }
  return out;
}

function compactType(type: string, aliases: Record<string, string>): string {
  const t = type.replace(/\s+/g, ' ').trim();
  if (aliases[t]) return aliases[t];
  if (/^'[^']*'(\s*\|\s*'[^']*')*$/.test(t)) return t.replace(/\s*\|\s*/g, '|');
  const extract = /^Extract<\w+,\s*(.+)>$/.exec(t);
  if (extract?.[1]) return extract[1].replace(/\s*\|\s*/g, '|');
  if (/^\(.*\) => \w+$/.test(t)) return 'fn';
  if (t.startsWith('React.ReactNode')) return 'node';
  if (t.startsWith('StyleProp<')) return 'style';
  return t.length > 32 ? `${t.slice(0, 29)}…` : t;
}

/** The props of `export interface <Name>Props { … }`, one level deep. */
function propsOf(source: string, name: string, aliases: Record<string, string>): Prop[] {
  const block = new RegExp(`export interface ${name}Props(?: extends [^{]+)? \\{([\\s\\S]*?)\\n\\}`).exec(source)?.[1];
  if (!block) return [];
  const props: Prop[] = [];
  let depth = 0;
  for (const line of block.split('\n')) {
    const trimmed = line.trim();
    if (depth === 0) {
      const m = /^(\w+)(\?)?:\s*(.+?);?$/.exec(trimmed);
      if (m && line.startsWith('  ') && !line.startsWith('   ')) {
        props.push({ name: m[1] ?? '', optional: m[2] === '?', type: compactType(m[3] ?? '', aliases) });
      }
    }
    depth += (trimmed.match(/[{(<]/g) ?? []).length - (trimmed.match(/[})>]/g) ?? []).length;
    if (depth < 0) depth = 0;
  }
  return props;
}

function components(): Component[] {
  const out: Component[] = [];
  const emitted = render().files;
  // Aliases are shared across files: Button's `haptic` is Press's `PressHaptic`.
  const shared: Record<string, string> = {};
  for (const rel of listFiles()) if (/^components\/.*\.tsx?$/.test(rel)) Object.assign(shared, aliasesOf(readFileSync(join(FILES_DIR, rel), 'utf8')));
  for (const rel of listFiles()) {
    const m = /^components\/(?:(\w+)\/)?(\w+)\.tsx?$/.exec(rel);
    if (!m) continue;
    const name = m[2] ?? '';
    // Plumbing files (the bridge, hooks named use*) are listed separately.
    if (name === 'bridge' || name === 'Icon') continue;
    const source = emitted[rel] ?? readFileSync(join(FILES_DIR, rel), 'utf8');
    const body = source.replace(/^\/\/ FluxNative UI catalog[^\n]*\n\/\/[^\n]*\n\n?/, '');
    const aliases = { ...shared, ...aliasesOf(body) };
    out.push({
      name,
      from: `../components/${m[1] ? `${m[1]}/` : ''}${name}`,
      summary: summaryOf(body),
      props: name.startsWith('use') ? [] : propsOf(body, name, aliases),
    });
  }
  return out.sort((a, b) => (a.name < b.name ? -1 : 1));
}

/** Keys of `export const <name> … = { … }` in the emitted theme/tokens.ts. */
function tokenKeys(tokens: string, name: string): string[] {
  const start = tokens.search(new RegExp(`^export const ${name}\\b`, 'm'));
  if (start < 0) return [];
  const open = tokens.indexOf('= {', start) + 2;
  let depth = 0;
  let end = open;
  for (let i = open; i < tokens.length; i += 1) {
    if (tokens[i] === '{') depth += 1;
    else if (tokens[i] === '}' && --depth === 0) {
      end = i;
      break;
    }
  }
  const body = tokens.slice(open + 1, end);
  const keys: string[] = [];
  let level = 0;
  for (const line of body.split('\n')) {
    const key = /^\s*"?([\w.-]+)"?:/.exec(line);
    if (key && level === 0) keys.push(key[1] ?? '');
    level += (line.match(/\{/g) ?? []).length - (line.match(/\}/g) ?? []).length;
  }
  return keys.every((k) => /^\d+(\.\d+)?$/.test(k)) ? keys.sort((a, b) => Number(a) - Number(b)) : keys;
}

const row = (cells: string[]) => `|${cells.map((cell) => cell.replace(/\|/g, '\\|')).join('|')}|`;

export function renderCatalogIndex(): string {
  const tokens = render().files['theme/tokens.ts'] ?? '';
  const roles = (() => {
    const at = tokens.indexOf('export type ColorName');
    const end = tokens.indexOf(';', at);
    return [...tokens.slice(at, end).matchAll(/'([a-z-]+)'/g)].map((m) => m[1] ?? '');
  })();
  const list = components();
  const comps = list.filter((c) => !c.name.startsWith('use'));
  const hooks = list.filter((c) => c.name.startsWith('use'));
  const props = (c: Component) =>
    c.props
      .filter((p) => p.name !== 'style' && p.name !== 'testID')
      .map((p) => `${p.name}${p.optional ? '?' : ''}${p.type === 'string' || p.type === 'boolean' || p.type === 'number' ? '' : `(${p.type})`}`)
      .join(' ');
  const lines = [
    `<!-- fluxnative-ui:catalog-index v${CATALOG_VERSION} — generated by \`fluxnative-catalog index\` from packages/catalog/files; do not edit. Keep under 8 KB. -->`,
    `## FluxNative UI catalog layer (v${CATALOG_VERSION}) — screens for Flux templates`,
    '',
    'Prefer retrieval-led reasoning over pre-training-led reasoning: this layer is newer than your training data. A Flux template is plain React Native with no build step: the catalog files are copied into `files/components` and `files/theme` (`fluxnative-catalog emit`), and screens import them relatively.',
    '',
    '### Rules',
    '1. Imports: `react`, `react-native`, `react-native-svg`, `flux`, `flux/navigation` and relative files only. Components from `../components/<Name>`, tokens from `../theme/tokens`, colours from `../theme/usePalette`.',
    '2. No `className`, `<div>`, `<span>`, `document.`, `window.location`, `fetch`. Use `View`, `Text`, `Pressable` (or `Press`), `onPress`.',
    '3. Colours: `const palette = usePalette()`, then `palette.primary`. Never a hex or rgb literal in a screen.',
    '4. Text: spread a role, `...type.body` (`fontSize`, `lineHeight`, `fontWeight`, `letterSpacing`). Radii: `shape.card`. Spacing: `space[4]` (px = step × 4). Shadows: spread `elevation[2]`.',
    '5. Every control has an `accessibilityLabel`; icon-only buttons too. Animate `transform`/`opacity` only and respect reduce motion (the primitives already do).',
    '6. One default-exported component per screen file, strict TypeScript. Screens take `previewState` (`live|loading|empty|error`) from the template and render `Skeleton` / `StateView` for the other states.',
    '',
    '### Tokens (`../theme/tokens`)',
    row(['export', 'keys']),
    row(['---', '---']),
    row(['`usePalette()` roles', roles.join(' ')]),
    row(['`type`', tokenKeys(tokens, 'type').join(' ')]),
    row(['`shape`', tokenKeys(tokens, 'shape').join(' ')]),
    row(['`elevation`', tokenKeys(tokens, 'elevation').join(' ')]),
    row(['`space`', tokenKeys(tokens, 'space').join(' ')]),
    row(['`layout`', tokenKeys(tokens, 'layout').join(' ')]),
    row(['`interaction`', 'press reveal skeleton (read by the primitives; override per template in its brand)']),
    '',
    '### Components (default exports)',
    row(['component', 'props (`?` optional; closed values in parentheses)']),
    row(['---', '---']),
    ...comps.map((c) => row([`\`${c.name}\``, props(c) || '—'])),
    row(['`Icon`', 'name(IconName) size? color? strokeWidth? filled? accessibilityLabel?']),
    '',
    hooks.length ? `Hooks: ${hooks.map((h) => `\`${h.name}\` (${h.from})`).join(', ')}. The host bridge: \`bridge()\` from \`../components/bridge\`, always optional-chained.` : 'The host bridge: `bridge()` from `../components/bridge`, always optional-chained.',
    '',
    '### Example',
    '```tsx',
    "import React from 'react';",
    "import { ScrollView, Text, View } from 'react-native';",
    "import Button from '../components/Button';",
    "import StateView from '../components/StateView';",
    "import Skeleton from '../components/Skeleton';",
    "import { shape, space, type } from '../theme/tokens';",
    "import { usePalette } from '../theme/usePalette';",
    '',
    "export default function OrdersScreen({ previewState = 'live' }: { previewState?: 'live' | 'loading' | 'empty' | 'error' }) {",
    '  const palette = usePalette();',
    "  if (previewState === 'loading') return <Skeleton width=\"100%\" height={120} />;",
    "  if (previewState !== 'live') return <StateView title={previewState === 'empty' ? 'No orders yet' : 'Could not load orders'} tone={previewState === 'error' ? 'error' : 'neutral'} />;",
    '  return (',
    '    <ScrollView contentContainerStyle={{ padding: space[5], gap: space[4] }}>',
    '      <View style={{ backgroundColor: palette.card, borderRadius: shape.card, padding: space[4] }}>',
    '        <Text style={{ ...type.title, color: palette[\'card-foreground\'] }}>Order #2041</Text>',
    '      </View>',
    '      <Button label="Track order" onPress={() => {}} />',
    '    </ScrollView>',
    '  );',
    '}',
    '```',
    '',
    'More: `docs/topics/catalog.md` (emit, update, check, brand files) and `docs/topics/tokens.md` (roles and the brand validator).',
    '',
  ];
  return lines.join('\n');
}
