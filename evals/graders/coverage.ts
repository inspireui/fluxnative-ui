// coverage: how much of the catalog the screen actually uses for the brief.
// The score is the share of `expect.json` recipes rendered (the A3.3 bar is
// 80%). States are reported alongside: the screen must take a `previewState`
// prop and mention every expected state as a string literal.

import ts from 'typescript';
import type { Catalog } from './catalog.ts';
import { catalogTag, forEachNode, jsxTags, propertyName, type Screen } from './source.ts';
import type { GradeResult } from './types.ts';

/** A3.3: recipe coverage ≥ 80%. */
export const COVERAGE_BAR = 0.8;

export interface Expect {
  /** Catalog components a good screen for the brief renders. */
  recipes: string[];
  /** `previewState` values the screen must render. */
  states: string[];
}

export interface CoverageDetails {
  share: number;
  used: string[];
  missing: string[];
  /** Catalog components used beyond the expectation. */
  extra: string[];
  states: {
    share: number;
    previewStateProp: boolean;
    found: string[];
    missing: string[];
  };
}

export function gradeCoverage(screen: Screen, catalog: Catalog, expect: Expect): GradeResult<CoverageDetails> {
  const used = new Set<string>();
  for (const tag of jsxTags(screen.sf)) {
    const name = catalogTag(screen, tag);
    if (name !== null && catalog.components.has(name)) used.add(name);
  }
  const hit = expect.recipes.filter((r) => used.has(r));
  const share = expect.recipes.length === 0 ? 1 : hit.length / expect.recipes.length;

  // A state counts when its name is used as a value (`previewState === 'empty'`,
  // `case 'empty':`, `{ empty: … }[previewState]`), not when it only appears in
  // the prop's type, which the prompt spells out, or as a JSX string like `tone="error"`.
  const literals = new Set<string>();
  let previewStateProp = false;
  forEachNode(screen.sf, (node) => {
    if (ts.isStringLiteralLike(node)) {
      const parent = node.parent;
      if (ts.isLiteralTypeNode(parent) || ts.isJsxAttribute(parent) || ts.isImportDeclaration(parent)) return;
      literals.add(node.text);
    } else if (ts.isPropertyAssignment(node) || ts.isShorthandPropertyAssignment(node)) {
      const key = propertyName(node.name);
      if (key !== null) literals.add(key);
    } else if (ts.isIdentifier(node) && node.text === 'previewState') {
      previewStateProp = true;
    }
  });
  const found = expect.states.filter((s) => literals.has(s));
  const stateShare = !previewStateProp ? 0 : expect.states.length === 0 ? 1 : found.length / expect.states.length;

  return {
    pass: share >= COVERAGE_BAR,
    score: share,
    details: {
      share,
      used: [...used].sort(),
      missing: expect.recipes.filter((r) => !used.has(r)),
      extra: [...used].filter((u) => !expect.recipes.includes(u)).sort(),
      states: { share: stateShare, previewStateProp, found, missing: expect.states.filter((s) => !literals.has(s)) },
    },
  };
}
