// What the catalog layer offers a screen, read from its sources with the
// TypeScript parser: the files a relative import may reach, and for every
// primitive the props its `export interface <Name>Props` declares.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import ts from 'typescript';
import { CATALOG_FILES } from '../paths.ts';

export interface CatalogComponent {
  name: string;
  /** Declared props: the interface's own members plus the catalog interfaces it extends. */
  props: ReadonlySet<string>;
  required: ReadonlySet<string>;
  /** True when the props can't be listed (no interface, or it extends a type from outside the catalog). */
  open: boolean;
}

export interface Catalog {
  /** Every file the layer ships, relative to `files/` (`components/Button.tsx`, `theme/tokens.ts`). */
  files: string[];
  /** The primitives: default-exported components in `components/*.tsx` and one folder down (`components/commerce/ProductCard.tsx`). */
  components: Map<string, CatalogComponent>;
}

const memo = new Map<string, Catalog>();

export function loadCatalog(dir: string = CATALOG_FILES): Catalog {
  const hit = memo.get(dir);
  if (hit) return hit;
  const files = walk(dir).map((file) => relative(dir, file).split('\\').join('/'));
  const sources = files
    .filter((rel) => /^components\/(?:[^/]+\/)?[^/]+\.tsx$/.test(rel))
    .map((rel) => ts.createSourceFile(rel, readFileSync(join(dir, rel), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX));

  const interfaces = new Map<string, ts.InterfaceDeclaration>();
  for (const sf of sources) {
    for (const stmt of sf.statements) if (ts.isInterfaceDeclaration(stmt)) interfaces.set(stmt.name.text, stmt);
  }

  const components = new Map<string, CatalogComponent>();
  for (const sf of sources) {
    const name = defaultFunctionName(sf);
    if (name === null || !/^[A-Z]/.test(name)) continue;
    const props = new Set<string>();
    const required = new Set<string>();
    const open = !collect(`${name}Props`, interfaces, props, required, new Set());
    components.set(name, { name, props, required, open });
  }

  const catalog = { files, components };
  memo.set(dir, catalog);
  return catalog;
}

/** Adds the interface's members to `props`; false when part of it can't be resolved. */
function collect(
  name: string,
  interfaces: Map<string, ts.InterfaceDeclaration>,
  props: Set<string>,
  required: Set<string>,
  seen: Set<string>,
): boolean {
  const decl = interfaces.get(name);
  if (decl === undefined || seen.has(name)) return decl !== undefined;
  seen.add(name);
  let closed = true;
  for (const member of decl.members) {
    if ((ts.isPropertySignature(member) || ts.isMethodSignature(member)) && memberName(member.name) !== null) {
      const key = memberName(member.name) as string;
      props.add(key);
      if (member.questionToken === undefined) required.add(key);
    } else {
      closed = false; // index signature or computed key: anything goes
    }
  }
  for (const clause of decl.heritageClauses ?? []) {
    for (const type of clause.types) {
      const base = ts.isIdentifier(type.expression) ? type.expression.text : null;
      if (base === null || !collect(base, interfaces, props, required, seen)) closed = false;
    }
  }
  return closed;
}

function memberName(name: ts.PropertyName): string | null {
  return ts.isIdentifier(name) || ts.isStringLiteral(name) ? name.text : null;
}

function defaultFunctionName(sf: ts.SourceFile): string | null {
  for (const stmt of sf.statements) {
    if (!ts.isFunctionDeclaration(stmt) || stmt.name === undefined) continue;
    const modifiers = ts.getModifiers(stmt) ?? [];
    if (modifiers.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword)) return stmt.name.text;
  }
  return null;
}

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir).sort()) {
    if (entry.startsWith('.')) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}
