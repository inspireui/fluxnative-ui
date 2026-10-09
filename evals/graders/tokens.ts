// tokens: design values that bypass the theme. Colours must come from
// `usePalette()` and type/corner sizes from `theme/tokens`, so a palette or
// scale change is one file. Flags
//   - hex / rgb() / hsl() string literals anywhere in the screen (the
//     `HEX_RE` of check_templates.py, widened to rgb/hsl);
//   - CSS colour keywords (`'white'`) on a colour key inside a style
//     (StyleSheet.create, `style=`, a `*style*` const) or on a colour prop
//     (`color="white"`); mock data that names a product colour is content;
//   - number literals for fontSize, lineHeight, letterSpacing and the
//     border radii, directly or through a `const SIZE = 14` in the file.
// Zero is allowed (`borderRadius: 0` is "no rounding", not a design value).

import ts from 'typescript';
import { attributeName, forEachNode, lineOf, propertyName, unwrap, type Screen } from './source.ts';
import { countScore, type GradeResult } from './types.ts';

export type TokenRule = 'hex' | 'rgb' | 'hsl' | 'named-color' | 'type-literal' | 'radius-literal';

export interface TokenViolation {
  rule: TokenRule;
  line: number;
  text: string;
}

export interface TokensDetails {
  violations: TokenViolation[];
  colors: number;
  sizes: number;
}

const HEX = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const RGB = /\brgba?\s*\(/i;
const HSL = /\bhsla?\s*\(/i;

const TYPE_KEYS = new Set(['fontSize', 'lineHeight', 'letterSpacing']);
const RADIUS_KEY = /^border(?:(?:Top|Bottom)(?:Left|Right|Start|End)|(?:Start|End)(?:Start|End))?Radius$/;
/** Props that take a radius or type size directly (`<Skeleton radius={12}>`). */
const JSX_RADIUS_ATTRS = new Set(['radius', 'borderRadius']);
/** Where a colour keyword is a colour: `color`, `*Color`, and SVG paint. */
const COLOR_KEY = /^(?:color|tint|fill|stroke|[a-zA-Z]+Color)$/;

// CSS Color Module Level 4 named colours ('transparent' and 'currentColor' are fine).
const NAMED_COLORS = new Set(
  (
    'aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue blueviolet brown burlywood ' +
    'cadetblue chartreuse chocolate coral cornflowerblue cornsilk crimson cyan darkblue darkcyan darkgoldenrod darkgray ' +
    'darkgreen darkgrey darkkhaki darkmagenta darkolivegreen darkorange darkorchid darkred darksalmon darkseagreen ' +
    'darkslateblue darkslategray darkslategrey darkturquoise darkviolet deeppink deepskyblue dimgray dimgrey dodgerblue ' +
    'firebrick floralwhite forestgreen fuchsia gainsboro ghostwhite gold goldenrod gray green greenyellow grey honeydew ' +
    'hotpink indianred indigo ivory khaki lavender lavenderblush lawngreen lemonchiffon lightblue lightcoral lightcyan ' +
    'lightgoldenrodyellow lightgray lightgreen lightgrey lightpink lightsalmon lightseagreen lightskyblue lightslategray ' +
    'lightslategrey lightsteelblue lightyellow lime limegreen linen magenta maroon mediumaquamarine mediumblue ' +
    'mediumorchid mediumpurple mediumseagreen mediumslateblue mediumspringgreen mediumturquoise mediumvioletred ' +
    'midnightblue mintcream mistyrose moccasin navajowhite navy oldlace olive olivedrab orange orangered orchid ' +
    'palegoldenrod palegreen paleturquoise palevioletred papayawhip peachpuff peru pink plum powderblue purple ' +
    'rebeccapurple red rosybrown royalblue saddlebrown salmon sandybrown seagreen seashell sienna silver skyblue ' +
    'slateblue slategray slategrey snow springgreen steelblue tan teal thistle tomato turquoise violet wheat white ' +
    'whitesmoke yellow yellowgreen'
  ).split(' '),
);

export function gradeTokens(screen: Screen): GradeResult<TokensDetails> {
  const { sf } = screen;
  const violations: TokenViolation[] = [];
  const numericConsts = collectNumericConsts(sf);
  const push = (rule: TokenRule, node: ts.Node, text = node.getText()) => {
    violations.push({ rule, line: lineOf(sf, node.getStart()), text: text.length > 80 ? `${text.slice(0, 80)}…` : text });
  };

  /** A number literal (or a const bound to one) other than 0. */
  const literalNumber = (expr: ts.Expression): boolean => {
    const inner = unwrap(expr);
    if (ts.isNumericLiteral(inner)) return Number(inner.text) !== 0;
    if (ts.isPrefixUnaryExpression(inner) && inner.operator === ts.SyntaxKind.MinusToken && ts.isNumericLiteral(inner.operand)) {
      return Number(inner.operand.text) !== 0;
    }
    if (ts.isIdentifier(inner)) {
      const value = numericConsts.get(inner.text);
      return value !== undefined && value !== 0;
    }
    return false;
  };

  const checkSize = (key: string, value: ts.Expression, at: ts.Node) => {
    if (!literalNumber(value)) return;
    if (TYPE_KEYS.has(key)) push('type-literal', at);
    else if (RADIUS_KEY.test(key) || JSX_RADIUS_ATTRS.has(key)) push('radius-literal', at);
  };

  const checkNamedColor = (key: string, value: ts.Expression, at: ts.Node) => {
    const inner = unwrap(value);
    if (COLOR_KEY.test(key) && ts.isStringLiteralLike(inner) && NAMED_COLORS.has(inner.text.toLowerCase())) push('named-color', at);
  };

  forEachNode(sf, (node) => {
    if (ts.isStringLiteralLike(node) || ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) {
      if (isModuleSpecifier(node)) return;
      const text = node.text.trim();
      if (HEX.test(text)) push('hex', node);
      else if (RGB.test(text)) push('rgb', node);
      else if (HSL.test(text)) push('hsl', node);
      return;
    }
    if (ts.isPropertyAssignment(node)) {
      const key = propertyName(node.name);
      if (key === null) return;
      checkSize(key, node.initializer, node);
      // Mock data may name a product colour (`{ color: 'Olive' }`); only styles paint with it.
      if (inStyle(node)) checkNamedColor(key, node.initializer, node);
      return;
    }
    if (ts.isShorthandPropertyAssignment(node)) {
      checkSize(node.name.text, node.name, node);
      return;
    }
    if (ts.isJsxAttribute(node) && node.initializer !== undefined) {
      const key = attributeName(node);
      const init = node.initializer;
      const value = ts.isJsxExpression(init) ? init.expression : ts.isStringLiteral(init) ? init : undefined;
      if (value === undefined) return;
      if (TYPE_KEYS.has(key) || JSX_RADIUS_ATTRS.has(key)) checkSize(key, value, node);
      checkNamedColor(key, value, node);
    }
  });

  const colors = violations.filter((v) => v.rule === 'hex' || v.rule === 'rgb' || v.rule === 'hsl' || v.rule === 'named-color').length;
  violations.sort((a, b) => a.line - b.line);
  return {
    pass: violations.length === 0,
    score: countScore(violations.length),
    details: { violations, colors, sizes: violations.length - colors },
  };
}

/** `const SIZE = 14` anywhere in the file (any scope): name → value. */
function collectNumericConsts(sf: ts.SourceFile): Map<string, number> {
  const out = new Map<string, number>();
  forEachNode(sf, (node) => {
    if (!ts.isVariableDeclaration(node) || !ts.isIdentifier(node.name) || node.initializer === undefined) return;
    const list = node.parent;
    if (!ts.isVariableDeclarationList(list) || (list.flags & ts.NodeFlags.Const) === 0) return;
    const init = unwrap(node.initializer);
    if (ts.isNumericLiteral(init)) out.set(node.name.text, Number(init.text));
    else if (ts.isPrefixUnaryExpression(init) && init.operator === ts.SyntaxKind.MinusToken && ts.isNumericLiteral(init.operand)) {
      out.set(node.name.text, -Number(init.operand.text));
    }
  });
  return out;
}

/** Inside `StyleSheet.create/compose/flatten(…)`, a `style` / `*Style` prop, or a `const *style* = …`. */
function inStyle(node: ts.Node): boolean {
  for (let current = node.parent; current !== undefined; current = current.parent) {
    if (ts.isJsxAttribute(current)) return /(?:^s|S)tyle$/.test(attributeName(current));
    if (ts.isCallExpression(current) && /^StyleSheet\.(?:create|compose|flatten)$/.test(current.expression.getText())) return true;
    if (ts.isVariableDeclaration(current) && ts.isIdentifier(current.name)) return /style/i.test(current.name.text);
  }
  return false;
}

function isModuleSpecifier(node: ts.Node): boolean {
  const parent = node.parent;
  return parent !== undefined && (ts.isImportDeclaration(parent) || ts.isExportDeclaration(parent) || ts.isExternalModuleReference(parent));
}
