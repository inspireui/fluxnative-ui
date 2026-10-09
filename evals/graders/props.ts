// props: JSX attributes on catalog elements that the component's
// `export interface <Name>Props` doesn't declare. A hallucinated prop is the
// clearest sign a model is guessing the API instead of reading it; the
// headline number is hallucinated props per 100 catalog elements.

import ts from 'typescript';
import type { Catalog } from './catalog.ts';
import { attributeName, catalogTag, jsxTags, lineOf, tagName, type Screen } from './source.ts';
import type { GradeResult } from './types.ts';

/** React's own attributes, valid on every component. */
const ALWAYS_ALLOWED = new Set(['key']);

export interface HallucinatedProp {
  component: string;
  prop: string;
  line: number;
}

export interface PropsDetails {
  /** JSX elements that render a catalog primitive. */
  elements: number;
  hallucinated: HallucinatedProp[];
  per100: number;
  /** `{...rest}` on a catalog element: not checkable, counted for the record. */
  spreads: number;
  /** Imports of `../components/<X>` where the catalog has no `<X>` (also a dialect failure). */
  unknownComponents: string[];
}

export function gradeProps(screen: Screen, catalog: Catalog): GradeResult<PropsDetails> {
  const hallucinated: HallucinatedProp[] = [];
  let elements = 0;
  let spreads = 0;
  const unknown = new Set<string>();
  for (const base of screen.componentImports.values()) {
    if (!catalog.files.some((file) => file.startsWith('components/') && file.replace(/\.[jt]sx?$/, '').split('/').pop() === base)) unknown.add(base);
  }

  for (const tag of jsxTags(screen.sf)) {
    const name = catalogTag(screen, tag);
    const component = name === null ? undefined : catalog.components.get(name);
    if (component === undefined) continue;
    elements += 1;
    for (const attr of tag.attributes.properties) {
      if (ts.isJsxSpreadAttribute(attr)) {
        spreads += 1;
        continue;
      }
      const prop = attributeName(attr);
      if (component.open || ALWAYS_ALLOWED.has(prop) || component.props.has(prop)) continue;
      hallucinated.push({ component: tagName(tag) === component.name ? component.name : `${tagName(tag)} (${component.name})`, prop, line: lineOf(screen.sf, attr.getStart()) });
    }
  }

  const per100 = elements === 0 ? 0 : (100 * hallucinated.length) / elements;
  return {
    pass: hallucinated.length === 0,
    score: elements === 0 ? 1 : Math.max(0, 1 - hallucinated.length / elements),
    details: { elements, hallucinated, per100, spreads, unknownComponents: [...unknown].sort() },
  };
}
