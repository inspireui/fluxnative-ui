// Parsing helpers shared by the AST graders. A screen is parsed once (TSX,
// parent pointers set) and every grader walks the same tree.

import { posix } from 'node:path';
import ts from 'typescript';

/** Where the screen sits inside a template's `files/`; relative imports resolve from here. */
export const SCREEN_DIR = 'screens';

export interface Screen {
  code: string;
  sf: ts.SourceFile;
  /** Local name → catalog module (`Btn` → `Button`) for every import of `../components/<X>`. */
  componentImports: Map<string, string>;
}

export type JsxTag = ts.JsxOpeningElement | ts.JsxSelfClosingElement;

export function parseScreen(code: string): Screen {
  const sf = ts.createSourceFile('screen.tsx', code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const componentImports = new Map<string, string>();
  for (const stmt of sf.statements) {
    if (!ts.isImportDeclaration(stmt) || !ts.isStringLiteral(stmt.moduleSpecifier)) continue;
    const base = componentModule(stmt.moduleSpecifier.text);
    const clause = stmt.importClause;
    if (base === null || clause === undefined) continue;
    if (clause.name) componentImports.set(clause.name.text, base);
    const bindings = clause.namedBindings;
    if (bindings && ts.isNamedImports(bindings)) {
      // `import { Button } from '../components/Button'` is a type error (the
      // primitives are default exports), but the element is still a Button.
      for (const el of bindings.elements) {
        if ((el.propertyName ?? el.name).text === base) componentImports.set(el.name.text, base);
      }
    }
  }
  return { code, sf, componentImports };
}

/** `../components/Button` (seen from `screens/`) → `Button`; anything else → null. */
export function componentModule(spec: string): string | null {
  if (!spec.startsWith('.')) return null;
  const rel = posix.normalize(posix.join(SCREEN_DIR, spec));
  const match = /^components\/(?:[^/]+\/)?([^/]+?)(?:\.[jt]sx?)?$/.exec(rel);
  return match?.[1] ?? null;
}

export function lineOf(sf: ts.SourceFile, pos: number): number {
  return sf.getLineAndCharacterOfPosition(pos).line + 1;
}

/** Depth-first walk over every node under `root`, `root` included. */
export function forEachNode(root: ts.Node, visit: (node: ts.Node) => void): void {
  visit(root);
  root.forEachChild((child) => {
    forEachNode(child, visit);
  });
}

export function jsxTags(root: ts.Node): JsxTag[] {
  const out: JsxTag[] = [];
  forEachNode(root, (node) => {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) out.push(node);
  });
  return out;
}

/** `View`, `Glass.Surface`, `div`. */
export function tagName(tag: JsxTag): string {
  return ts.isIdentifier(tag.tagName) ? tag.tagName.text : tag.tagName.getText();
}

/** The catalog module a JSX tag renders, through the screen's imports (`<Btn>` → `Button`). */
export function catalogTag(screen: Screen, tag: JsxTag): string | null {
  return ts.isIdentifier(tag.tagName) ? (screen.componentImports.get(tag.tagName.text) ?? null) : null;
}

export function attributeName(attr: ts.JsxAttribute): string {
  return ts.isIdentifier(attr.name) ? attr.name.text : `${attr.name.namespace.text}:${attr.name.name.text}`;
}

/** Strips `( )`, `as`, `satisfies` and `!` around an expression. */
export function unwrap(expr: ts.Expression): ts.Expression {
  let current = expr;
  while (
    ts.isParenthesizedExpression(current) ||
    ts.isAsExpression(current) ||
    ts.isSatisfiesExpression(current) ||
    ts.isNonNullExpression(current)
  ) {
    current = current.expression;
  }
  return current;
}

/** The name of a property in an object literal or a JSX attribute, when it is static. */
export function propertyName(name: ts.PropertyName): string | null {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) return name.text;
  if (ts.isNoSubstitutionTemplateLiteral(name)) return name.text;
  return null;
}

/** Name of the screen's default export, when it is a named function or identifier. */
export function defaultExportName(sf: ts.SourceFile): string | null {
  for (const stmt of sf.statements) {
    if (ts.isExportAssignment(stmt) && !stmt.isExportEquals && ts.isIdentifier(stmt.expression)) return stmt.expression.text;
    if ((ts.isFunctionDeclaration(stmt) || ts.isClassDeclaration(stmt)) && hasModifier(stmt, ts.SyntaxKind.DefaultKeyword)) {
      return stmt.name?.text ?? null;
    }
  }
  return null;
}

export function hasDefaultExport(sf: ts.SourceFile): boolean {
  return sf.statements.some((stmt) => {
    if (ts.isExportAssignment(stmt)) return !stmt.isExportEquals;
    if (ts.isExportDeclaration(stmt) && stmt.exportClause && ts.isNamedExports(stmt.exportClause)) {
      return stmt.exportClause.elements.some((el) => el.name.text === 'default');
    }
    return hasModifier(stmt, ts.SyntaxKind.DefaultKeyword) && hasModifier(stmt, ts.SyntaxKind.ExportKeyword);
  });
}

function hasModifier(node: ts.Node, kind: ts.SyntaxKind): boolean {
  return ts.canHaveModifiers(node) && (ts.getModifiers(node)?.some((m) => m.kind === kind) ?? false);
}
