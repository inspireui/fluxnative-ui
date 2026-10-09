// dialect: the template contract of fluxbuilder-template's
// `tool/check_templates.py`, re-implemented for one screen file: the import
// allowlist, relative imports that must land on a shipped file, and the
// web-only constructs (`DOM_RE`). Plus the prompt's "one default export".

import { posix } from 'node:path';
import ts from 'typescript';
import type { Catalog } from './catalog.ts';
import { SCREEN_DIR, forEachNode, hasDefaultExport, lineOf, type Screen } from './source.ts';
import { countScore, type GradeResult } from './types.ts';

/** Bare modules a screen in this eval may import: what the prompt allows and the scaffold can resolve. */
export const EVAL_IMPORTS: readonly string[] = ['react', 'react-native', 'react-native-svg'];

/**
 * `ALLOWED_BARE` in check_templates.py: the full template contract. The extra
 * modules are host features (flux bridge, glass, Skia, the reanimated shim)
 * that this eval's prompt doesn't offer, so importing one is still a miss here.
 */
export const TEMPLATE_IMPORTS: readonly string[] = [
  ...EVAL_IMPORTS,
  'flux',
  'flux/navigation',
  'flux/glass',
  '@shopify/react-native-skia',
  'react-native-reanimated',
];

// Ported from check_templates.py unchanged, so a screen fails here exactly
// when the template gate would fail it (the gate reads raw text, comments too).
const IMPORT_RE = /^\s*import\s+(?:[^'"]*?\sfrom\s+)?['"]([^'"]+)['"]/gm;
const REQUIRE_RE = /\brequire\(\s*['"]([^'"]+)['"]\s*\)/g;
const DOM_RE = /className=|<div[\s>]|<span[\s>]|document\.|window\.location/g;

const RESOLVE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.json'];

export type DialectRule = 'import' | 'relative' | 'web' | 'default-export';

export interface DialectViolation {
  rule: DialectRule;
  line: number;
  message: string;
}

export interface DialectDetails {
  violations: DialectViolation[];
  imports: string[];
}

export function gradeDialect(screen: Screen, catalog: Catalog, screenFile = `${SCREEN_DIR}/Screen.tsx`): GradeResult<DialectDetails> {
  const violations: DialectViolation[] = [];
  const specs = importSpecifiers(screen);
  const shipped = new Set([...catalog.files, screenFile]);

  for (const [spec, line] of specs) {
    if (spec.startsWith('.')) {
      const where = resolveRelative(spec, shipped);
      if (where === 'escape') violations.push({ rule: 'relative', line, message: `'${spec}' escapes files/; it is not in the shipped map` });
      if (where === 'missing') violations.push({ rule: 'relative', line, message: `relative import '${spec}' resolves to nothing in the catalog layer` });
    } else if (!EVAL_IMPORTS.includes(spec)) {
      const why = TEMPLATE_IMPORTS.includes(spec)
        ? 'is a host module this eval does not offer'
        : `is not on the allowlist (${EVAL_IMPORTS.join(', ')}, relative files)`;
      violations.push({ rule: 'import', line, message: `import '${spec}' ${why}` });
    }
  }

  for (const match of screen.code.matchAll(DOM_RE)) {
    violations.push({ rule: 'web', line: lineOf(screen.sf, match.index), message: `web-only construct '${match[0].trim()}': this is React Native, not HTML` });
  }

  if (!hasDefaultExport(screen.sf)) violations.push({ rule: 'default-export', line: 1, message: 'no default export: the screen must be the default export' });

  violations.sort((a, b) => a.line - b.line);
  return { pass: violations.length === 0, score: countScore(violations.length), details: { violations, imports: [...specs.keys()] } };
}

/** Every module specifier with the line it first appears on: the AST's view plus the contract's regexes. */
function importSpecifiers(screen: Screen): Map<string, number> {
  const found = new Map<string, number>();
  const add = (spec: string, pos: number) => {
    if (!found.has(spec)) found.set(spec, lineOf(screen.sf, pos));
  };
  forEachNode(screen.sf, (node) => {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      add(node.moduleSpecifier.text, node.getStart());
    } else if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)) {
      const expr = node.moduleReference.expression;
      if (ts.isStringLiteral(expr)) add(expr.text, node.getStart());
    } else if (ts.isCallExpression(node) && node.arguments.length > 0) {
      const callee = node.expression;
      const arg = node.arguments[0];
      const isRequire = ts.isIdentifier(callee) && callee.text === 'require';
      const isDynamicImport = callee.kind === ts.SyntaxKind.ImportKeyword;
      if ((isRequire || isDynamicImport) && arg !== undefined && ts.isStringLiteralLike(arg)) add(arg.text, node.getStart());
    }
  });
  for (const re of [IMPORT_RE, REQUIRE_RE]) {
    for (const match of screen.code.matchAll(re)) {
      const spec = match[1];
      if (spec !== undefined) add(spec, match.index + match[0].indexOf(spec));
    }
  }
  return found;
}

function resolveRelative(spec: string, shipped: Set<string>): 'ok' | 'escape' | 'missing' {
  if (spec.startsWith('../../')) return 'escape';
  const target = posix.normalize(posix.join(SCREEN_DIR, spec));
  if (target.startsWith('..')) return 'escape';
  const candidates = [target, ...RESOLVE_EXTENSIONS.map((ext) => target + ext), ...RESOLVE_EXTENSIONS.map((ext) => `${target}/index${ext}`)];
  return candidates.some((file) => shipped.has(file)) ? 'ok' : 'missing';
}
