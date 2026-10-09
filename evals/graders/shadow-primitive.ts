// shadow-primitive: a screen that re-implements a catalog primitive instead
// of using it. This is the duplication the template audit found (A1.3:
// local Press, SkeletonShimmer, StateBlock, CtaButton, CircleButton, Icons…).
// Heuristics, so every finding names its rule and line:
//   - name: a local component named like a primitive (`CtaButton`,
//     `FilterChip`, `EmptyState`, `HeartIcon`) that doesn't render that
//     primitive. Rendering it makes the wrapper a composition, which is fine.
//   - scale-press: a raw Pressable/Touchable with onPressIn/onPressOut in a
//     file that springs or times a `scale` (Press re-implemented).
//   - modal: a react-native `<Modal>` (Sheet draws inside the screen, never Modal).
//   - icon-svg: an `<Svg viewBox="0 0 24 24">` (an icon drawn by hand; Icon has the table).

import ts from 'typescript';
import { catalogTag, defaultExportName, forEachNode, jsxTags, lineOf, tagName, unwrap, type JsxTag, type Screen } from './source.ts';
import { countScore, type GradeResult } from './types.ts';

export type ShadowRule = 'name' | 'scale-press' | 'modal' | 'icon-svg';

export interface ShadowFinding {
  rule: ShadowRule;
  primitive: string;
  line: number;
  message: string;
}

export interface Composition {
  name: string;
  wraps: string;
}

export interface ShadowDetails {
  findings: ShadowFinding[];
  /** Local components that wrap a primitive (allowed: the kit's backlog, not duplication). */
  compositions: Composition[];
  /** Raw Pressable / Touchable* elements: not a finding, but each one skips Press (haptics, label, scale). */
  rawPressables: number;
}

interface NameRule {
  primitive: string;
  name: RegExp;
  /** Rendering one of these makes the local component a composition. */
  via: readonly string[];
}

/** First match wins, so the specific button shapes come before `*Button`. */
const NAME_RULES: readonly NameRule[] = [
  { primitive: 'IconButton', name: /^(?:Icon|Circle|Round|Fab|Floating)[A-Za-z]*Button$|^Fab$/, via: ['IconButton'] },
  { primitive: 'Button', name: /^(?:[A-Z][A-Za-z]*)?Button$|^Cta$/, via: ['Button', 'IconButton', 'Chip'] },
  { primitive: 'Chip', name: /^(?:[A-Z][A-Za-z]*)?(?:Chip|Pill)$/, via: ['Chip'] },
  { primitive: 'Skeleton', name: /Skeleton|Shimmer|Placeholder/, via: ['Skeleton'] },
  {
    primitive: 'StateView',
    name: /^(?:State(?:Block|Notice|View)|(?:Empty|Error|Offline)(?:State|View|Block|Notice|Banner|Message|Card)?)$/,
    via: ['StateView'],
  },
  { primitive: 'Sheet', name: /(?:Sheet|Drawer|Modal|Dialog)$/, via: ['Sheet'] },
  { primitive: 'Reveal', name: /^(?:Reveal|FadeIn|Appear|Stagger|Entrance)[A-Za-z]*$/, via: ['Reveal'] },
  { primitive: 'SectionHeader', name: /^Section(?:Header|Title|Heading)$/, via: ['SectionHeader'] },
  { primitive: 'Scrim', name: /^(?:Scrim|Backdrop|Overlay)$/, via: ['Scrim', 'Sheet'] },
  { primitive: 'Press', name: /^(?:Press|Pressable|Touchable|Tappable|ScalePress|PressScale|Bounce)[A-Za-z]*$/, via: ['Press'] },
  { primitive: 'Icon', name: /^(?:Glyph[A-Za-z]*|(?:[A-Z][A-Za-z]*)?Icons?)$/, via: ['Icon'] },
];

const RAW_PRESSABLES = new Set(['Pressable', 'TouchableOpacity', 'TouchableHighlight', 'TouchableWithoutFeedback', 'TouchableNativeFeedback']);

interface LocalComponent {
  name: string;
  node: ts.Node;
  line: number;
}

export function gradeShadowPrimitive(screen: Screen): GradeResult<ShadowDetails> {
  const { sf } = screen;
  const findings: ShadowFinding[] = [];
  const compositions: Composition[] = [];
  const flagged: ts.Node[] = [];
  const screenName = defaultExportName(sf);

  for (const local of localComponents(sf)) {
    if (local.name === screenName) continue;
    const rule = NAME_RULES.find((r) => r.name.test(local.name));
    if (rule === undefined) continue;
    const rendered = new Set(jsxTags(local.node).map((tag) => catalogTag(screen, tag)).filter((name) => name !== null));
    const wraps = rule.via.find((primitive) => rendered.has(primitive));
    if (wraps !== undefined) {
      compositions.push({ name: local.name, wraps });
      continue;
    }
    flagged.push(local.node);
    findings.push({ rule: 'name', primitive: rule.primitive, line: local.line, message: `local ${local.name} re-implements ${rule.primitive}` });
  }

  const inFlagged = (node: ts.Node) => flagged.some((f) => node.pos >= f.pos && node.end <= f.end);
  const reactNativeImports = importedFrom(sf, 'react-native');
  const animatesScale = /\bAnimated\.(?:spring|timing)\s*\(/.test(screen.code) && /\bscale\b/.test(screen.code);
  let rawPressables = 0;

  for (const tag of jsxTags(sf)) {
    const name = tagName(tag);
    if (RAW_PRESSABLES.has(name) && reactNativeImports.has(name)) {
      rawPressables += 1;
      if (animatesScale && hasAttribute(tag, ['onPressIn', 'onPressOut']) && !inFlagged(tag)) {
        findings.push({ rule: 'scale-press', primitive: 'Press', line: lineOf(sf, tag.getStart()), message: `${name} with a scale animation re-implements Press` });
      }
    } else if (name === 'Modal' && reactNativeImports.has('Modal') && !inFlagged(tag)) {
      findings.push({ rule: 'modal', primitive: 'Sheet', line: lineOf(sf, tag.getStart()), message: 'react-native Modal: use Sheet, which draws inside the screen' });
    } else if (name === 'Svg' && attributeText(tag, 'viewBox')?.trim() === '0 0 24 24' && !inFlagged(tag)) {
      findings.push({ rule: 'icon-svg', primitive: 'Icon', line: lineOf(sf, tag.getStart()), message: 'hand-drawn 24-unit icon: use Icon with a name from its table' });
    }
  }

  findings.sort((a, b) => a.line - b.line);
  return { pass: findings.length === 0, score: countScore(findings.length), details: { findings, compositions, rawPressables } };
}

/** Function components declared anywhere in the file: `function Name()` and `const Name = () =>` (memo/forwardRef too). */
function localComponents(sf: ts.SourceFile): LocalComponent[] {
  const out: LocalComponent[] = [];
  forEachNode(sf, (node) => {
    if (ts.isFunctionDeclaration(node) && node.name !== undefined && /^[A-Z]/.test(node.name.text)) {
      out.push({ name: node.name.text, node, line: lineOf(sf, node.getStart()) });
    } else if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && /^[A-Z]/.test(node.name.text) && node.initializer !== undefined) {
      if (isFunctionLike(node.initializer)) out.push({ name: node.name.text, node, line: lineOf(sf, node.getStart()) });
    }
  });
  return out;
}

function isFunctionLike(expr: ts.Expression): boolean {
  const inner = unwrap(expr);
  if (ts.isArrowFunction(inner) || ts.isFunctionExpression(inner)) return true;
  // React.memo(() => …), forwardRef(function X() {…})
  return ts.isCallExpression(inner) && inner.arguments.some((arg) => isFunctionLike(arg));
}

function importedFrom(sf: ts.SourceFile, module: string): Set<string> {
  const names = new Set<string>();
  for (const stmt of sf.statements) {
    if (!ts.isImportDeclaration(stmt) || !ts.isStringLiteral(stmt.moduleSpecifier) || stmt.moduleSpecifier.text !== module) continue;
    const bindings = stmt.importClause?.namedBindings;
    if (bindings && ts.isNamedImports(bindings)) for (const el of bindings.elements) names.add(el.name.text);
  }
  return names;
}

function hasAttribute(tag: JsxTag, names: readonly string[]): boolean {
  return tag.attributes.properties.some((attr) => ts.isJsxAttribute(attr) && ts.isIdentifier(attr.name) && names.includes(attr.name.text));
}

function attributeText(tag: JsxTag, name: string): string | undefined {
  for (const attr of tag.attributes.properties) {
    if (!ts.isJsxAttribute(attr) || !ts.isIdentifier(attr.name) || attr.name.text !== name || attr.initializer === undefined) continue;
    const init = attr.initializer;
    if (ts.isStringLiteral(init)) return init.text;
    if (ts.isJsxExpression(init) && init.expression !== undefined && ts.isStringLiteralLike(init.expression)) return init.expression.text;
  }
  return undefined;
}
