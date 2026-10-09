import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, describe, test } from 'node:test';
import { loadCatalog } from '../graders/catalog.ts';
import type { Grades } from '../graders/index.ts';
import { FIXTURES_DIR } from '../paths.ts';
import { parseCli } from './args.ts';
import { STATES, listBriefIds, loadBrief, screenName, selectBriefs } from './briefs.ts';
import { CATALOG_INDEX, FALLBACK_INDEX, loadContext } from './context.ts';
import { mapPool, type Report } from './harness.ts';
import { main, type Io } from './main.ts';
import { RULES, systemPrompt, userPrompt } from './prompt.ts';
import type { Fetch } from './providers/types.ts';
import { defaultReportPath, markdownTable, summarize, writeReport, type SampleRecord } from './report.ts';

const tmp = mkdtempSync(join(tmpdir(), 'fluxnative-eval-test-'));
after(() => rmSync(tmp, { recursive: true, force: true }));

const BRIEF_IDS = [
  'ai-chat',
  'ai-generate',
  'ai-scan',
  'booking',
  'cart-checkout',
  'catalog-grid',
  'inbox',
  'onboarding',
  'product-detail',
  'search-filter',
  'settings',
  'stats-dashboard',
  'tabbed-home',
];

function capture(overrides: Partial<Io> = {}): { io: Io; out: string[]; err: string[] } {
  const out: string[] = [];
  const err: string[] = [];
  const io: Io = {
    stdout: (text) => out.push(text),
    stderr: (text) => err.push(text),
    env: {},
    cwd: tmp,
    // Any network call fails the test.
    fetch: async () => {
      throw new Error('network call in a test');
    },
    ...overrides,
  };
  return { io, out, err };
}

describe('flags', () => {
  test('defaults', () => {
    const cli = parseCli([]);
    assert.deepEqual(
      { models: cli.models, contexts: cli.contexts, samples: cli.samples, dryRun: cli.dryRun, maxTokens: cli.maxTokens, concurrency: cli.concurrency, timeoutMs: cli.timeoutMs },
      { models: [], contexts: ['index'], samples: 1, dryRun: false, maxTokens: 16_000, concurrency: 4, timeoutMs: 600_000 },
    );
  });

  test('repeatable and comma-separated values; bad numbers and unknown flags fail', () => {
    const cli = parseCli(['--model', 'anthropic:a', '--model', 'google:g', '--context', 'none,index', '--samples', '3', '--briefs', 'inbox,ai-chat']);
    assert.deepEqual(cli.models, ['anthropic:a', 'google:g']);
    assert.deepEqual(cli.contexts, ['none', 'index']);
    assert.equal(cli.samples, 3);
    assert.equal(cli.briefs, 'inbox,ai-chat');
    assert.throws(() => parseCli(['--samples', '0']), /--samples must be a positive integer/);
    assert.throws(() => parseCli(['--temperature', '1']), /Unknown option '--temperature'/);
  });
});

describe('briefs', () => {
  test('the 13 core briefs exist, and every BRIEF.md keeps the shape within 25 lines', () => {
    const ids = listBriefIds();
    assert.deepEqual(
      BRIEF_IDS.filter((id) => !ids.includes(id)),
      [],
    );
    for (const id of ids) {
      const brief = loadBrief(id);
      const lines = brief.text.trimEnd().split('\n').length;
      assert.ok(lines <= 25, `${id}/BRIEF.md has ${lines} lines`);
      for (const section of ['**Purpose.**', '**Content.**', '**Required elements.**', '**States** (`previewState`).']) {
        assert.ok(brief.text.includes(section), `${id}/BRIEF.md lacks ${section}`);
      }
    }
  });

  test('expect.json names real catalog components and the states the brief describes', () => {
    const components = loadCatalog().components;
    for (const id of listBriefIds()) {
      const { expect, text } = loadBrief(id);
      assert.ok(expect.recipes.length >= 5, `${id}: expects too few recipes`);
      for (const recipe of expect.recipes) assert.ok(components.has(recipe), `${id}: ${recipe} is not a catalog component`);
      for (const state of ['live', 'loading', 'empty', 'error']) assert.ok(expect.states.includes(state), `${id}: missing state ${state}`);
      const ai = id.startsWith('ai-');
      for (const state of ['streaming', 'quota']) assert.equal(expect.states.includes(state), ai, `${id}: ${state}`);
      for (const state of expect.states) assert.ok(text.includes(`\`${state}\``), `${id}: BRIEF.md does not describe ${state}`);
      assert.ok(expect.states.every((s) => (STATES as readonly string[]).includes(s)));
    }
  });

  test('screen names and selection', () => {
    assert.equal(screenName('catalog-grid'), 'CatalogGridScreen');
    assert.equal(screenName('ai-chat'), 'AiChatScreen');
    assert.deepEqual(
      selectBriefs('inbox, ai-chat').map((b) => b.id),
      ['inbox', 'ai-chat'],
    );
    assert.equal(selectBriefs('all').length, listBriefIds().length);
    assert.throws(() => selectBriefs('inbox,nope'), /unknown brief\(s\): nope/);
  });
});

describe('context and prompt', () => {
  const docsRoot = (withCatalogIndex: boolean): string => {
    const root = mkdtempSync(join(tmp, 'repo-'));
    for (const path of [...FALLBACK_INDEX, ...(withCatalogIndex ? [CATALOG_INDEX] : [])]) {
      mkdirSync(join(root, path, '..'), { recursive: true });
      writeFileSync(join(root, path), `contents of ${path}\n`);
    }
    return root;
  };

  test('index prefers CATALOG.index.md and falls back to the app index plus the catalog topic', () => {
    assert.deepEqual(loadContext('none').docs, []);
    assert.deepEqual(
      loadContext('index', docsRoot(false)).docs.map((d) => d.path),
      ['docs/llm/AGENTS.index.md', 'docs/topics/catalog.md'],
    );
    const preferred = loadContext('index', docsRoot(true)).docs;
    assert.deepEqual(
      preferred.map((d) => d.path),
      ['docs/llm/CATALOG.index.md'],
    );
    assert.equal(preferred[0]?.bytes, Buffer.byteLength('contents of docs/llm/CATALOG.index.md\n'));
    assert.match(preferred[0]?.sha256 ?? '', /^[0-9a-f]{64}$/);
  });

  test('system = the rules (+ docs); user = the brief + the file to write', () => {
    assert.equal(systemPrompt({ mode: 'none', docs: [] }), RULES);
    const withDocs = systemPrompt(loadContext('index', docsRoot(true)));
    assert.ok(withDocs.startsWith(RULES));
    assert.match(withDocs, /<doc path="docs\/llm\/CATALOG.index.md">\ncontents of docs\/llm\/CATALOG.index.md\n<\/doc>/);
    for (const rule of ['react-native-svg', 'className', 'window.location', 'usePalette()', 'noUncheckedIndexedAccess', 'previewState']) {
      assert.ok(RULES.includes(rule), `the rules mention ${rule}`);
    }
    const user = userPrompt(loadBrief('ai-chat'));
    assert.ok(user.startsWith('# AI chat'));
    assert.match(user, /Write `screens\/AiChatScreen.tsx`/);
    assert.match(user, /previewState\?: 'live' \| 'loading' \| 'empty' \| 'error' \| 'streaming' \| 'quota'/);
  });
});

describe('report', () => {
  const metrics = (over: Partial<Grades['metrics']> = {}): Grades['metrics'] => ({
    hasCode: true,
    typecheckErrors: 0,
    dialectViolations: 0,
    catalogElements: 10,
    hallucinatedProps: 0,
    tokenViolations: 0,
    shadowFindings: 0,
    coverage: 1,
    stateCoverage: 1,
    ...over,
  });
  const sample = (pass1: boolean, m: Grades['metrics'], usage = { inputTokens: 1000, outputTokens: 500 }): SampleRecord => ({
    model: 'anthropic:a',
    context: 'index',
    brief: 'inbox',
    sample: 1,
    output: '…',
    error: null,
    usage,
    latencyMs: 2000,
    attempts: 1,
    stopReason: 'end_turn',
    grades: { typecheck: { pass: m.typecheckErrors === 0 }, dialect: { pass: m.dialectViolations === 0 }, pass1, metrics: m } as unknown as Grades,
    pass1,
  });

  test('summarize pools props, averages the rest and leaves API errors out of the rates', () => {
    const errored: SampleRecord = { ...sample(false, metrics()), output: null, error: 'HTTP 500', grades: null, usage: {}, latencyMs: null };
    const [row] = summarize(
      [
        sample(true, metrics()),
        sample(false, metrics({ typecheckErrors: 2, hallucinatedProps: 3, catalogElements: 20, tokenViolations: 4, coverage: 0.5, stateCoverage: 0.5 })),
        errored,
      ],
      { 'anthropic:a': { inputPerMTok: 3, outputPerMTok: 15 } },
    );
    assert.ok(row);
    assert.deepEqual(
      [row.samples, row.errors, row.n, row.pass1, row.typecheck, row.propsPer100, row.tokenViolations, row.coverage, row.stateCoverage],
      [3, 1, 2, 0.5, 0.5, 10, 2, 0.75, 0.75],
    );
    assert.equal(row.meanOutputTokens, 500);
    assert.equal(row.costUsd, (2000 * 3 + 1000 * 15) / 1e6);
    const table = markdownTable([row]);
    assert.match(table, /^\| model \| context \| n \| pass@1 \| typecheck \| props\/100 \| token viol\. \| shadow \| coverage \| states \| tokens in\/out \| cost \|/);
    assert.match(table, /\| anthropic:a \| index \| 2 \(\+1 err\) \| 50% \| 50% \| 10\.0 \| 2\.00 \| 0\.00 \| 75% \| 75% \| 1\.0k\/500 \| \$0\.02 \|$/);
  });

  test('report paths are dated and never overwrite an earlier run', () => {
    assert.match(defaultReportPath('Claude X + GPT', new Date('2026-10-09T12:00:00Z'), tmp), /2026-10-09-claude-x-gpt\.json$/);
    const path = join(tmp, 'r.json');
    assert.equal(writeReport(path, { a: 1 }), path);
    assert.equal(writeReport(path, { a: 2 }), join(tmp, 'r-2.json'));
    assert.deepEqual(JSON.parse(readFileSync(path, 'utf8')), { a: 1 });
  });
});

describe('pool', () => {
  test('keeps order, respects the limit and starts nothing new after a failure', async () => {
    let running = 0;
    let peak = 0;
    const out = await mapPool([1, 2, 3, 4, 5], 2, async (n) => {
      running += 1;
      peak = Math.max(peak, running);
      await new Promise((resolve) => setTimeout(resolve, 5));
      running -= 1;
      return n * 10;
    });
    assert.deepEqual(out, [10, 20, 30, 40, 50]);
    assert.equal(peak, 2);
    const started: number[] = [];
    await assert.rejects(
      mapPool([1, 2, 3, 4, 5], 1, async (n) => {
        started.push(n);
        if (n === 2) throw new Error('boom');
        return n;
      }),
      /boom/,
    );
    assert.deepEqual(started, [1, 2]);
  });
});

describe('cli', () => {
  test('--dry-run grades the canned replies with no network and writes the report', async () => {
    const { io, out, err } = capture();
    const code = await main(['--dry-run', '--out', 'dry.json'], io);
    assert.equal(code, 0, err.join('\n'));
    const report = JSON.parse(readFileSync(join(tmp, 'dry.json'), 'utf8')) as Report;
    assert.equal(report.dryRun, true);
    assert.ok(report.samples.length >= 2);
    assert.ok(report.samples.some((s) => s.pass1), 'at least one canned reply passes');
    assert.ok(report.samples.some((s) => !s.pass1), 'at least one canned reply fails');
    assert.ok(report.skipped.length > 0 && !report.skipped.includes('ai-chat'));
    assert.ok(report.prompts.system.index?.startsWith(RULES));
    assert.match(out.join('\n'), /\| fixture:canned \| index \| \d+ \|/);
    assert.ok(err.some((line) => /^\[1\/\d+\] (PASS|FAIL) fixture:canned · index · /.test(line)));
  });

  test('a real adapter end to end, against a fake API', async () => {
    const good = readFileSync(join(FIXTURES_DIR, 'screens', 'good.md'), 'utf8');
    const calls: string[] = [];
    const fetch: Fetch = async (url, init) => {
      calls.push(url);
      const body = JSON.parse(String(init.body)) as { messages: { content: string }[] };
      assert.match(body.messages[0]?.content ?? '', /Write `screens\/CatalogGridScreen.tsx`/);
      return new Response(JSON.stringify({ content: [{ type: 'text', text: good }], stop_reason: 'end_turn', usage: { input_tokens: 3000, output_tokens: 2500 } }));
    };
    const { io, out, err } = capture({ env: { ANTHROPIC_API_KEY: 'sk-test-0123456789' }, fetch });
    const code = await main(['--model', 'anthropic:claude-test', '--briefs', 'catalog-grid', '--context', 'none,index', '--out', 'live.json'], io);
    assert.equal(code, 0, err.join('\n'));
    assert.equal(calls.length, 2);
    const report = JSON.parse(readFileSync(join(tmp, 'live.json'), 'utf8')) as Report;
    assert.deepEqual(
      report.summary.map((r) => [r.model, r.context, r.n, r.pass1, r.meanOutputTokens]),
      [
        ['anthropic:claude-test', 'none', 1, 1, 2500],
        ['anthropic:claude-test', 'index', 1, 1, 2500],
      ],
    );
    assert.ok(!JSON.stringify(report).includes('sk-test-0123456789'), 'the key is never in the report');
    assert.match(out.join('\n'), /\| anthropic:claude-test \| index \| 1 \| 100% \| 100% \| 0\.0 \|/);
  });

  test('setup errors: missing key → 1, bad flags → 2', async () => {
    const missing = capture();
    assert.equal(await main(['--model', 'google:gemini-test'], missing.io), 1);
    assert.match(missing.err.join('\n'), /GEMINI_API_KEY is not set \(needed for google:gemini-test\)/);
    const bad = capture();
    assert.equal(await main(['--model', 'anthropic:a', '--context', 'mcp'], bad.io), 2);
    assert.match(bad.err.join('\n'), /--context mcp: expected none or index/);
    assert.equal(await main([], capture().io), 2);
  });
});
