import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { after, describe, test } from 'node:test';
import { FIXTURES_DIR } from '../paths.ts';
import { loadCatalog } from './catalog.ts';
import { gradeCoverage, type Expect } from './coverage.ts';
import { gradeDialect, type DialectDetails } from './dialect.ts';
import { extract, findFences } from './extract.ts';
import { Typechecker, gradeOutput, type Grades } from './index.ts';
import { gradeProps } from './props.ts';
import { gradeShadowPrimitive } from './shadow-primitive.ts';
import { parseScreen } from './source.ts';
import { gradeTokens } from './tokens.ts';
import type { TypecheckDetails } from './typecheck.ts';
import type { Skipped } from './types.ts';

const CATALOG_GRID: Expect = {
  recipes: ['Chip', 'IconButton', 'Icon', 'Press', 'Reveal', 'SectionHeader', 'Skeleton', 'StateView'],
  states: ['live', 'loading', 'empty', 'error'],
};
const TARGET = { screenName: 'CatalogGridScreen', expect: CATALOG_GRID };

const typechecker = new Typechecker();
after(() => typechecker.dispose());

const fixture = (name: string) => readFileSync(join(FIXTURES_DIR, 'screens', `${name}.md`), 'utf8');
const grade = (name: string): Grades => gradeOutput(fixture(name), TARGET, typechecker);
const catalog = loadCatalog();

function details<D>(result: { details: D | Skipped }): D {
  assert.ok(!('skipped' in (result.details as object)), 'grader was skipped');
  return result.details as D;
}

describe('good screen', () => {
  test('passes every grader and pass@1', () => {
    const g = grade('good');
    for (const [name, result] of Object.entries(g)) {
      if (name === 'pass1' || name === 'metrics') continue;
      assert.equal((result as { pass: boolean }).pass, true, `${name}: ${JSON.stringify((result as { details: unknown }).details)}`);
    }
    assert.equal(g.pass1, true);
    assert.deepEqual(
      { ...g.metrics, catalogElements: g.metrics.catalogElements > 10 },
      {
        hasCode: true,
        typecheckErrors: 0,
        dialectViolations: 0,
        catalogElements: true,
        hallucinatedProps: 0,
        tokenViolations: 0,
        shadowFindings: 0,
        coverage: 1,
        stateCoverage: 1,
      },
    );
  });
});

describe('extract', () => {
  test('two code blocks fail, and the longest tsx block is still graded', () => {
    const g = grade('bad-extract');
    assert.equal(g.extract.pass, false);
    assert.match(g.extract.details.reason ?? '', /2 code blocks/);
    assert.equal(g.pass1, false);
    assert.equal(g.typecheck.pass, true, 'the screen block itself compiles');
    assert.ok(g.metrics.hasCode);
  });

  test('accepts exactly one closed tsx block, with an info string or ~~~ fences', () => {
    assert.equal(extract('Here you go:\n```tsx title="screens/A.tsx"\nexport default 1;\n```\nDone.').pass, true);
    assert.equal(extract('~~~tsx\nexport default 1;\n~~~').pass, true);
    assert.equal(extract('````tsx\nconst s = "```";\nexport default s;\n````').code, 'const s = "```";\nexport default s;');
  });

  test('names what went wrong', () => {
    assert.equal(extract('no code at all').details.reason, 'no code block');
    assert.equal(extract('no code at all').code, null);
    assert.match(extract('```typescript\nexport default 1;\n```').details.reason ?? '', /no tsx block \(found typescript\)/);
    const truncated = extract('```tsx\nexport default function A() {\n');
    assert.match(truncated.details.reason ?? '', /not closed/);
    assert.equal(truncated.code, 'export default function A() {\n');
    assert.equal(extract('import React from "react";\nexport default 1;').code?.startsWith('import React'), true);
  });

  test('findFences reports language, line and closure', () => {
    const fences = findFences('a\n```bash\nls\n```\n\n```tsx\nx\n');
    assert.deepEqual(
      fences.map((f) => [f.lang, f.line, f.closed]),
      [
        ['bash', 2, true],
        ['tsx', 6, false],
      ],
    );
  });
});

describe('dialect', () => {
  test('web constructs fail it even when tsc is happy', () => {
    const g = grade('bad-dialect');
    const d = details<DialectDetails>(g.dialect);
    assert.equal(g.dialect.pass, false);
    assert.deepEqual(
      d.violations.map((v) => [v.rule, v.line]),
      [
        ['web', 15],
        ['web', 21],
      ],
    );
    assert.equal(g.typecheck.pass, true);
    assert.equal(g.pass1, false);
  });

  const dialect = (code: string) => gradeDialect(parseScreen(code), catalog).details.violations.map((v) => `${v.rule}: ${v.message}`);

  test('the import allowlist, host modules and require/dynamic import', () => {
    const found = dialect(
      [
        "import React from 'react';",
        "import { View } from 'react-native';",
        "import Svg from 'react-native-svg';",
        "import { Link } from 'expo-router';",
        "import { useNavigation } from 'flux/navigation';",
        "const _ = require('lodash');",
        "const later = import('@fluxnative/ui');",
        'export default function A() { return null; }',
      ].join('\n'),
    );
    assert.deepEqual(found, [
      "import: import 'expo-router' is not on the allowlist (react, react-native, react-native-svg, relative files)",
      "import: import 'flux/navigation' is a host module this eval does not offer",
      "import: import 'lodash' is not on the allowlist (react, react-native, react-native-svg, relative files)",
      "import: import '@fluxnative/ui' is not on the allowlist (react, react-native, react-native-svg, relative files)",
    ]);
  });

  test('relative imports must land on a shipped catalog file', () => {
    const found = dialect(
      [
        "import Button from '../components/Button';",
        "import { space } from '../theme/tokens';",
        "import useReducedMotion from '../components/useReducedMotion';",
        "import Card from '../components/Card';",
        "import { colors } from '../../theme/colors';",
        "import * as all from '../components';",
        'export default function A() { return null; }',
      ].join('\n'),
    );
    assert.deepEqual(found, [
      "relative: relative import '../components/Card' resolves to nothing in the catalog layer",
      "relative: '../../theme/colors' escapes files/; it is not in the shipped map",
      "relative: relative import '../components' resolves to nothing in the catalog layer",
    ]);
  });

  test('className, span, document. and a missing default export', () => {
    const found = dialect("import React from 'react';\nexport function A() {\n  document.title = 'x';\n  return <span className=\"p-4\" />;\n}\n");
    assert.deepEqual(found, [
      "default-export: no default export: the screen must be the default export",
      "web: web-only construct 'document.': this is React Native, not HTML",
      "web: web-only construct '<span': this is React Native, not HTML",
      "web: web-only construct 'className=': this is React Native, not HTML",
    ]);
  });
});

describe('typecheck', () => {
  test('strict mode and noUncheckedIndexedAccess errors fail it; prop names alone do not', () => {
    const g = grade('bad-typecheck');
    const d = details<TypecheckDetails>(g.typecheck);
    assert.equal(g.typecheck.pass, false);
    assert.deepEqual(
      d.errors.map((e) => [e.code, e.file, e.line]),
      [
        [18048, 'screens/CatalogGridScreen.tsx', 16],
        [2322, 'screens/CatalogGridScreen.tsx', 17],
      ],
    );
    assert.equal(g.props.pass, true, '`variant` is a real prop; only its value is wrong');
  });

  test('a suppression comment fails it even when nothing else does', () => {
    const code = "// @ts-nocheck\nimport React from 'react';\nexport default function A() {\n  return null;\n}\n";
    const result = typechecker.check(code, 'Suppressed');
    assert.equal(result.pass, false);
    assert.deepEqual(result.details.suppressions, ['@ts-nocheck']);
    assert.deepEqual(result.details.errors, []);
  });

  test('unused locals and extension imports fail like the template tsc', () => {
    const code = "import React from 'react';\nimport Button from '../components/Button.tsx';\nexport default function A() {\n  const unused = 1;\n  return <Button label=\"Go\" />;\n}\n";
    const codes = typechecker.check(code, 'Strict').details.errors.map((e) => e.code);
    assert.ok(codes.includes(6133), `noUnusedLocals: ${codes.join(', ')}`);
    assert.ok(codes.includes(5097), `allowImportingTsExtensions is off: ${codes.join(', ')}`);
  });
});

describe('props', () => {
  test('counts hallucinated props per catalog element', () => {
    const g = grade('bad-props');
    assert.equal(g.props.pass, false);
    assert.deepEqual(g.metrics.hallucinatedProps, 3);
    assert.deepEqual(g.metrics.catalogElements, 2);
    const d = g.props.details as { hallucinated: { component: string; prop: string }[]; per100: number };
    assert.deepEqual(
      d.hallucinated.map((h) => `${h.component}.${h.prop}`),
      ['Chip.active', 'Button.title', 'Button.fullWidth'],
    );
    assert.equal(d.per100, 150);
  });

  test('follows renamed imports, allows key, counts spreads and unknown components', () => {
    const screen = parseScreen(
      [
        "import Btn from '../components/Button';",
        "import Card from '../components/Card';",
        'const rest = { label: "x" };',
        'export default function A() {',
        '  return <><Btn key="a" label="Go" titel="typo" /><Btn {...rest} /><Card elevated /></>;',
        '}',
      ].join('\n'),
    );
    const d = gradeProps(screen, catalog).details;
    assert.deepEqual(
      d.hallucinated.map((h) => `${h.component}.${h.prop}`),
      ['Btn (Button).titel'],
    );
    assert.equal(d.elements, 2);
    assert.equal(d.spreads, 1);
    assert.deepEqual(d.unknownComponents, ['Card']);
  });

  test('reads the prop table from the catalog sources', () => {
    assert.deepEqual([...catalog.components.keys()].sort(), [
      'Button',
      'Chip',
      'Icon',
      'IconButton',
      'Press',
      'ProductCard',
      'Reveal',
      'Scrim',
      'SectionHeader',
      'Sheet',
      'Skeleton',
      'Snackbar',
      'StateView',
      'Toggle',
    ]);
    const button = catalog.components.get('Button');
    assert.ok(button && !button.open);
    assert.ok(button.props.has('label') && button.props.has('variant') && !button.props.has('title'));
    assert.deepEqual([...button.required], ['label']);
    assert.deepEqual([...(catalog.components.get('Press')?.required ?? [])], ['accessibilityLabel']);
  });
});

describe('tokens', () => {
  test('flags raw colours and literal type and radius sizes', () => {
    const g = grade('bad-tokens');
    const d = g.tokens.details as { violations: { rule: string; text: string }[]; colors: number; sizes: number };
    assert.equal(g.tokens.pass, false);
    assert.deepEqual(
      d.violations.map((v) => `${v.rule} ${v.text}`),
      [
        "named-color backgroundColor: 'white'",
        'type-literal fontSize: 28',
        'type-literal lineHeight: 34',
        "hex '#1A1A1A'",
        'radius-literal borderRadius: CARD_RADIUS',
        "rgb 'rgba(0, 0, 0, 0.1)'",
      ],
    );
    assert.equal(d.colors, 3);
    assert.equal(d.sizes, 3);
    assert.equal(g.typecheck.pass, true);
  });

  test('tokens, zero and transparent are fine; JSX radius and colour props are checked', () => {
    const rules = (code: string) => gradeTokens(parseScreen(code)).details.violations.map((v) => v.rule);
    assert.deepEqual(
      rules(
        "const s = { fontSize: text.lg.fontSize, borderRadius: 0, letterSpacing: 0, backgroundColor: 'transparent', color: palette.primary, width: 12 };",
      ),
      [],
    );
    assert.deepEqual(rules('const a = <Skeleton radius={12} />;\nconst b = <Icon name="bag" color="white" size={22} />;'), ['radius-literal', 'named-color']);
    assert.deepEqual(rules("const cardStyle = { borderTopLeftRadius: 16, shadowColor: 'black', tint: 'hsl(210, 50%, 40%)' };"), [
      'radius-literal',
      'named-color',
      'hsl',
    ]);
  });

  test('a colour keyword in mock data is content; in a style it is a raw colour', () => {
    const rules = (code: string) => gradeTokens(parseScreen(code)).details.violations.map((v) => `${v.rule} ${v.line}`);
    assert.deepEqual(
      rules(
        [
          "const COLOURS = [{ name: 'Olive', color: 'Olive' }, { name: 'Navy', color: 'Navy' }];",
          "const styles = StyleSheet.create({ swatch: { borderColor: 'navy' } });",
          "const a = <View style={[styles.swatch, { backgroundColor: 'white' }]} onLayout={() => pick({ color: 'red' })} />;",
          "const b = <TextInput placeholderTextColor=\"gray\" />;",
        ].join('\n'),
      ),
      ['named-color 2', 'named-color 3', 'named-color 4'],
    );
  });
});

describe('shadow-primitive', () => {
  test('flags re-implemented primitives by name and by shape', () => {
    const g = grade('bad-shadow');
    const d = g.shadowPrimitive.details as { findings: { rule: string; primitive: string }[]; rawPressables: number };
    assert.equal(g.shadowPrimitive.pass, false);
    assert.deepEqual(
      d.findings.map((f) => `${f.rule}:${f.primitive}`),
      ['name:Press', 'name:StateView', 'modal:Sheet'],
    );
    assert.equal(d.rawPressables, 1);
    assert.equal(g.pass1, true, 'shadow-primitive is reported, not part of pass@1');
  });

  test('a wrapper that renders the primitive is a composition, not a shadow', () => {
    const screen = parseScreen(
      [
        "import Sheet from '../components/Sheet';",
        "import Icon from '../components/Icon';",
        "import { Pressable, Animated } from 'react-native';",
        "import Svg, { Path } from 'react-native-svg';",
        'function FilterSheet() { return <Sheet open onClose={() => undefined} />; }',
        'function CategoryIcon() { return <Icon name="bag" />; }',
        'function HeartIcon() { return <Svg viewBox="0 0 24 24"><Path d="M12 20" /></Svg>; }',
        'const Card = () => { const scale = new Animated.Value(1); Animated.spring(scale, { toValue: 1, useNativeDriver: true }); return <Pressable onPressIn={() => undefined} />; };',
        'export default function Screen() { return <Svg viewBox="0 0 24 24" />; }',
      ].join('\n'),
    );
    const d = gradeShadowPrimitive(screen).details;
    assert.deepEqual(
      d.compositions.map((c) => `${c.name}>${c.wraps}`),
      ['FilterSheet>Sheet', 'CategoryIcon>Icon'],
    );
    assert.deepEqual(
      d.findings.map((f) => `${f.rule}:${f.primitive}`),
      ['name:Icon', 'scale-press:Press', 'icon-svg:Icon'],
    );
  });
});

describe('coverage', () => {
  test('is the share of expected recipes rendered', () => {
    const g = grade('bad-coverage');
    const d = g.coverage.details as { share: number; used: string[]; missing: string[] };
    assert.equal(g.coverage.pass, false);
    assert.equal(d.share, 0.25);
    assert.deepEqual(d.used, ['Chip', 'Icon']);
    assert.deepEqual(d.missing, ['IconButton', 'Press', 'Reveal', 'SectionHeader', 'Skeleton', 'StateView']);
    assert.equal(g.pass1, true, 'coverage is reported, not part of pass@1');
  });

  test('a state counts when used as a value, not when it is only in the prop type', () => {
    const screen = parseScreen(
      [
        "type S = 'live' | 'loading' | 'empty' | 'error';",
        "export default function A({ previewState = 'live' }: { previewState?: S }) {",
        "  const views = { empty: 1 };",
        "  return previewState === 'loading' ? <StateView tone=\"error\" /> : views.empty;",
        '}',
      ].join('\n'),
    );
    const states = gradeCoverage(screen, catalog, { recipes: [], states: ['live', 'loading', 'empty', 'error'] }).details.states;
    assert.deepEqual(states.found, ['live', 'loading', 'empty']);
    assert.deepEqual(states.missing, ['error']);
    assert.equal(states.share, 0.75);
  });
});

describe('no code', () => {
  test('every grader is skipped and the sample fails', () => {
    const g = gradeOutput('I cannot help with that.', TARGET, typechecker);
    assert.equal(g.pass1, false);
    assert.equal(g.metrics.hasCode, false);
    assert.deepEqual(g.typecheck.details, { skipped: 'no code block' });
  });
});
