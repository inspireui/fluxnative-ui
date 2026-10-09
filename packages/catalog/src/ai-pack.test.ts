// The AI pack's components: the Markdown subset StreamingText reads, and
// what `--only` emits for each AI pack file.

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { test } from 'node:test';
import { parseMarkdown, plainText, stripMarkdown, type MarkdownBlock } from '../files/components/markdown.ts';
import { FILES_DIR, componentDeps, importGraph, listFiles, selectFiles } from './emit.ts';

const CLI = join(import.meta.dirname, 'cli.ts');

// ---------------------------------------------------------------- markdown

const inline = (blocks: MarkdownBlock[]) => (blocks[0] && blocks[0].kind !== 'code' ? blocks[0].spans : []);

test('markdown reads bold, italic, code and link text, and leaves arithmetic and snake_case alone', () => {
  assert.deepEqual(inline(parseMarkdown('Visit **Kyoto** and *Nara*, then `npm test`')), [
    { text: 'Visit ' },
    { text: 'Kyoto', bold: true },
    { text: ' and ' },
    { text: 'Nara', italic: true },
    { text: ', then ' },
    { text: 'npm test', code: true },
  ]);
  assert.deepEqual(inline(parseMarkdown('2 * 3 * 4 = 24, my_var_name, \\*not italic\\*')), [{ text: '2 * 3 * 4 = 24, my_var_name, *not italic*' }]);
  assert.deepEqual(inline(parseMarkdown('See [the guide](https://example.com/guide).')), [{ text: 'See the guide.' }]);
  assert.deepEqual(inline(parseMarkdown('***both***')), [{ text: 'both', bold: true, italic: true }]);
  assert.deepEqual(inline(parseMarkdown('an *open marker')), [{ text: 'an *open marker' }]);
});

test('markdown reads headings, lists, code blocks and paragraphs', () => {
  const blocks = parseMarkdown('# Weekend\nTwo days.\nSlow ones.\n\n- Day 1: **Fushimi**\n  early start\n* Day 2\n1. Book\n2) Pack\n\n```js\nconst a = 1;\n```\n---\nDone');
  assert.deepEqual(
    blocks.map((b) => (b.kind === 'code' ? ['code', b.text] : [b.kind, b.kind === 'item' ? b.marker : '', b.spans.map((s) => s.text).join('')])),
    [
      ['heading', '', 'Weekend'],
      ['paragraph', '', 'Two days.\nSlow ones.'],
      ['item', '•', 'Day 1: Fushimi\nearly start'],
      ['item', '•', 'Day 2'],
      ['item', '1.', 'Book'],
      ['item', '2.', 'Pack'],
      ['code', 'const a = 1;'],
      ['paragraph', '', 'Done'],
    ],
  );
  assert.deepEqual(parseMarkdown('```\nconst cut = "short'), [{ kind: 'code', text: 'const cut = "short' }], 'an unclosed fence is still code');
  assert.deepEqual(parseMarkdown(''), []);
});

test('while open, the last block styles unclosed markers to its end and hides a marker that ends the text', () => {
  assert.deepEqual(inline(parseMarkdown('Go to **Kyo', { open: true })), [{ text: 'Go to ' }, { text: 'Kyo', bold: true }]);
  assert.deepEqual(inline(parseMarkdown('Go to **', { open: true })), [{ text: 'Go to ' }]);
  assert.deepEqual(inline(parseMarkdown('Run `', { open: true })), [{ text: 'Run ' }]);
  assert.deepEqual(inline(parseMarkdown('Go to **', { open: false })), [{ text: 'Go to **' }]);
  // Only the block being written is open; a finished paragraph keeps its literal asterisk.
  const blocks = parseMarkdown('a *b\n\nc **d', { open: true });
  assert.deepEqual(blocks[0]?.kind === 'paragraph' ? blocks[0].spans : null, [{ text: 'a *b' }]);
  assert.deepEqual(blocks[1]?.kind === 'paragraph' ? blocks[1].spans : null, [{ text: 'c ' }, { text: 'd', bold: true }]);
});

test('plainText is what a screen reader hears: no markup, one block per line', () => {
  assert.equal(plainText(parseMarkdown('# Plan\n- **Day 1**: go\n\n```\ncode\n```')), 'Plan\n• Day 1: go\ncode');
  assert.equal(stripMarkdown('Visit *Nara*'), 'Visit Nara');
  assert.equal(stripMarkdown('Go to **Kyo', { open: true }), 'Go to Kyo', 'a streaming label has no stray asterisks');
});

// ---------------------------------------------------------------- emit

const AI_PACK = ['AiBadge', 'Composer', 'MessageList', 'ScanFrame', 'StreamingText', 'aiState', 'markdown', 'useAiChat', 'useAiTask'];

test('each AI pack component pulls what it imports, and markdown.ts imports nothing', () => {
  const deps = componentDeps();
  assert.deepEqual(deps.markdown, []);
  assert.deepEqual(deps.StreamingText, ['bridge', 'markdown', 'useReducedMotion']);
  assert.deepEqual(deps.ScanFrame, ['bridge', 'useReducedMotion']);
  assert.deepEqual(deps.AiBadge, ['Icon']);
  for (const dep of ['Icon', 'IconButton', 'Press', 'bridge', 'useReducedMotion']) assert.ok(deps.Composer?.includes(dep), `Composer → ${dep}`);
  for (const dep of ['Icon', 'IconButton', 'Reveal', 'StreamingText', 'markdown', 'useReducedMotion']) assert.ok(deps.MessageList?.includes(dep), `MessageList → ${dep}`);
  // node --test loads it as it is.
  assert.doesNotMatch(readFileSync(join(FILES_DIR, 'components', 'markdown.ts'), 'utf8'), /^import /m);
});

test('--only <AI component> selects a closed set of files in the template dialect', () => {
  const all = listFiles();
  for (const name of AI_PACK) {
    const picked = selectFiles(all, [name]);
    const sources = Object.fromEntries(picked.map((rel) => [rel, readFileSync(join(FILES_DIR, rel), 'utf8')]));
    assert.doesNotThrow(() => importGraph(sources), `${name}: every relative import is selected too`);
    assert.ok(picked.includes('theme/tokens.ts') && picked.includes('theme/usePalette.ts'), name);
  }
  const list = selectFiles(all, ['MessageList']);
  for (const rel of ['components/MessageList.tsx', 'components/StreamingText.tsx', 'components/markdown.ts', 'components/IconButton.tsx', 'components/Press.tsx', 'components/Reveal.tsx', 'components/Icon.tsx', 'components/bridge.ts']) {
    assert.ok(list.includes(rel), `MessageList pulls ${rel}`);
  }
  for (const rel of ['components/Composer.tsx', 'components/useAiChat.ts', 'components/aiState.ts', 'components/Sheet.tsx']) assert.ok(!list.includes(rel), `MessageList leaves ${rel}`);

  // fluxbuilder-template's check_templates.py contract, for every AI pack file.
  const allowed = new Set(['react', 'react-native', 'react-native-svg']);
  for (const name of AI_PACK) {
    const rel = all.find((file) => file.replace(/\.tsx?$/, '') === `components/${name}`);
    assert.ok(rel, name);
    const source = readFileSync(join(FILES_DIR, rel), 'utf8');
    for (const [, spec = ''] of source.matchAll(/^[ \t]*(?:import|export)\s+(?:[^'"`;]*?\s+from\s+)?['"]([^'"]+)['"]/gm)) {
      assert.ok(allowed.has(spec) || (/^\.\.?\//.test(spec) && !/\.tsx?$/.test(spec)), `${rel}: import '${spec}'`);
    }
    assert.doesNotMatch(source, /className=|<div[\s>]|<span[\s>]|document\.|window\.location/, `${rel}: no web-only code`);
    assert.doesNotMatch(source, /['"]#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})['"]/, `${rel}: colours come from the palette`);
    assert.doesNotMatch(source, /\bfetch\(/, `${rel}: no fetch; the host makes the calls`);
  }
});

test('cli emit --only MessageList,Composer,useAiChat writes a closed layer that check accepts', () => {
  const dir = mkdtempSync(join(tmpdir(), 'fluxnative-catalog-ai-'));
  try {
    const files = join(dir, 'files');
    execFileSync('node', [CLI, 'emit', '--to', files, '--only', 'MessageList,Composer,useAiChat'], { stdio: 'pipe' });
    const walk = (at: string): string[] =>
      readdirSync(at).flatMap((entry) => (statSync(join(at, entry)).isDirectory() ? walk(join(at, entry)) : [relative(files, join(at, entry))]));
    const written = walk(files).filter((rel) => rel !== '.fluxnative-ui.json');
    const sources = Object.fromEntries(written.map((rel) => [rel, readFileSync(join(files, rel), 'utf8')]));
    assert.doesNotThrow(() => importGraph(sources));
    for (const rel of ['components/MessageList.tsx', 'components/Composer.tsx', 'components/useAiChat.ts', 'components/aiState.ts', 'components/StreamingText.tsx', 'components/markdown.ts']) {
      assert.ok(written.includes(rel), rel);
    }
    assert.ok(!written.includes('components/ScanFrame.tsx'));
    assert.match(execFileSync('node', [CLI, 'check', '--to', files], { encoding: 'utf8' }), /up to date with its manifest/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
