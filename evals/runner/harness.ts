// One eval run: models × contexts × briefs × samples. Each job builds the
// prompt, gets one reply (from the API, or from evals/fixtures/dry-run with
// --dry-run), and grades it. API calls run in a small pool; grading is
// synchronous, so the shared typecheck scaffold is never used twice at once.

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';
import { Typechecker, gradeOutput, type Grades } from '../graders/index.ts';
import { CATALOG_DIR, REPO_ROOT } from '../paths.ts';
import type { Brief } from './briefs.ts';
import { loadContext, type Context, type ContextMode } from './context.ts';
import { systemPrompt, userPrompt } from './prompt.ts';
import { createProvider, modelLabel, type Fetch, type ModelSpec, type Provider, type Usage } from './providers/index.ts';
import { summarize, type Prices, type SampleRecord, type SummaryRow } from './report.ts';

export interface EvalPlan {
  models: ModelSpec[];
  contexts: ContextMode[];
  briefs: Brief[];
  samples: number;
  dryRun: boolean;
  /** Output budget per call (reasoning included). */
  maxTokens: number;
  /** Parallel API calls. */
  concurrency: number;
  timeoutMs: number;
  /** Where --dry-run reads canned replies. */
  fixturesDir: string;
  label: string;
}

export interface EvalDeps {
  fetch?: Fetch;
  env?: Record<string, string | undefined>;
  sleep?: (ms: number) => Promise<void>;
  /** Progress lines (stderr in the CLI). */
  log?: (line: string) => void;
  prices?: Prices;
  repoRoot?: string;
}

export interface Report {
  schema: 1;
  createdAt: string;
  label: string;
  dryRun: boolean;
  plan: { models: string[]; contexts: ContextMode[]; briefs: string[]; samples: number; maxTokens: number };
  env: { node: string; typescript: string; catalog: string | null; commit: string | null };
  contexts: Partial<Record<ContextMode, { files: { path: string; bytes: number; sha256: string }[] }>>;
  /** The exact prompts, so a report can be replayed. */
  prompts: { system: Partial<Record<ContextMode, string>>; user: Record<string, string> };
  /** Dry run: briefs without a canned reply. */
  skipped: string[];
  samples: SampleRecord[];
  summary: SummaryRow[];
}

interface Job {
  spec: ModelSpec;
  context: Context;
  brief: Brief;
  sample: number;
}

export async function runEval(plan: EvalPlan, deps: EvalDeps = {}): Promise<Report> {
  const log = deps.log ?? (() => undefined);
  const contexts = plan.contexts.map((mode) => loadContext(mode, deps.repoRoot ?? REPO_ROOT));
  const providers = new Map<string, Provider>();
  if (!plan.dryRun) {
    for (const spec of plan.models) {
      providers.set(
        modelLabel(spec),
        createProvider(spec, {
          ...(deps.fetch ? { fetch: deps.fetch } : {}),
          ...(deps.env ? { env: deps.env } : {}),
          ...(deps.sleep ? { sleep: deps.sleep } : {}),
          timeoutMs: plan.timeoutMs,
          onRetry: (message) => log(`  … ${message}`),
        }),
      );
    }
  }

  const skipped = plan.dryRun ? plan.briefs.filter((b) => cannedOutput(plan.fixturesDir, b.id, 1) === null).map((b) => b.id) : [];
  const jobs: Job[] = [];
  for (const spec of plan.models) {
    for (const context of contexts) {
      for (const brief of plan.briefs) {
        if (skipped.includes(brief.id)) continue;
        for (let sample = 1; sample <= plan.samples; sample += 1) jobs.push({ spec, context, brief, sample });
      }
    }
  }
  if (skipped.length > 0) log(`dry run: skipping ${skipped.length} brief(s) with no canned reply (${skipped.join(', ')})`);

  const typechecker = new Typechecker();
  let done = 0;
  let samples: SampleRecord[];
  try {
    typechecker.prepare();
    samples = await mapPool(jobs, plan.dryRun ? 1 : plan.concurrency, async (job) => {
      const record = await runJob(job, plan, providers, typechecker);
      done += 1;
      log(progressLine(record, done, jobs.length));
      return record;
    });
  } finally {
    typechecker.dispose();
  }

  return {
    schema: 1,
    createdAt: new Date().toISOString(),
    label: plan.label,
    dryRun: plan.dryRun,
    plan: {
      models: plan.models.map(modelLabel),
      contexts: plan.contexts,
      briefs: plan.briefs.map((b) => b.id),
      samples: plan.samples,
      maxTokens: plan.maxTokens,
    },
    env: environment(deps.repoRoot ?? REPO_ROOT),
    contexts: Object.fromEntries(contexts.map((c) => [c.mode, { files: c.docs.map(({ path, bytes, sha256 }) => ({ path, bytes, sha256 })) }])),
    prompts: {
      system: Object.fromEntries(contexts.map((c) => [c.mode, systemPrompt(c)])),
      user: Object.fromEntries(plan.briefs.map((b) => [b.id, userPrompt(b)])),
    },
    skipped,
    samples,
    summary: summarize(samples, deps.prices),
  };
}

async function runJob(job: Job, plan: EvalPlan, providers: Map<string, Provider>, typechecker: Typechecker): Promise<SampleRecord> {
  const base = { model: modelLabel(job.spec), context: job.context.mode, brief: job.brief.id, sample: job.sample };
  let output: string;
  let usage: Usage = {};
  let latencyMs: number | null = null;
  let attempts = 0;
  let stopReason: string | null = null;
  if (plan.dryRun) {
    output = cannedOutput(plan.fixturesDir, job.brief.id, job.sample) ?? '';
  } else {
    const provider = providers.get(base.model) as Provider;
    try {
      const generation = await provider.generate({ system: systemPrompt(job.context), user: userPrompt(job.brief), maxTokens: plan.maxTokens });
      ({ text: output, usage, latencyMs, attempts, stopReason } = generation);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { ...base, output: null, error: message, usage: {}, latencyMs: null, attempts: 0, stopReason: null, grades: null, pass1: false };
    }
  }
  let grades: Grades;
  try {
    grades = gradeOutput(output, { screenName: job.brief.screenName, expect: job.brief.expect }, typechecker);
  } catch (error) {
    // A grader bug must not cost the replies already paid for: keep the reply, flag the sample.
    const message = `grader crashed: ${error instanceof Error ? error.message : String(error)}`;
    return { ...base, output, error: message, usage, latencyMs, attempts, stopReason, grades: null, pass1: false };
  }
  return { ...base, output, error: null, usage, latencyMs, attempts, stopReason, grades, pass1: grades.pass1 };
}

/** `<brief>.<sample>.md`, else `<brief>.md`. */
export function cannedOutput(dir: string, brief: string, sample: number): string | null {
  for (const name of [`${brief}.${sample}.md`, `${brief}.md`]) {
    const file = join(dir, name);
    if (existsSync(file)) return readFileSync(file, 'utf8');
  }
  return null;
}

/** Runs `fn` over `items`, `limit` at a time, in order of start. After a throw no new item starts. */
export async function mapPool<T, R>(items: readonly T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array<R>(items.length);
  let next = 0;
  let failed = false;
  const worker = async () => {
    while (next < items.length && !failed) {
      const index = next;
      next += 1;
      try {
        results[index] = await fn(items[index] as T, index);
      } catch (error) {
        failed = true;
        throw error;
      }
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, worker));
  return results;
}

export function progressLine(record: SampleRecord, done: number, total: number): string {
  const width = String(total).length;
  const where = `${record.model} · ${record.context} · ${record.brief} #${record.sample}`;
  const head = `[${String(done).padStart(width)}/${total}]`;
  if (record.grades === null) return `${head} ERR  ${where} · ${record.error ?? 'unknown error'}`;
  return `${head} ${record.pass1 ? 'PASS' : 'FAIL'} ${where} · ${describe(record.grades)}${record.latencyMs === null ? '' : ` · ${(record.latencyMs / 1000).toFixed(1)}s`}`;
}

function describe(grades: Grades): string {
  const m = grades.metrics;
  if (!m.hasCode) return `no code (${grades.extract.details.reason ?? 'extract failed'})`;
  const parts = [
    grades.extract.pass ? null : `extract: ${grades.extract.details.reason ?? 'failed'}`,
    m.dialectViolations === 0 ? null : `dialect ${m.dialectViolations}`,
    m.typecheckErrors === 0 ? 'tsc ok' : `tsc ${m.typecheckErrors} error${m.typecheckErrors === 1 ? '' : 's'}`,
    `props ${m.hallucinatedProps}/${m.catalogElements}`,
    `tokens ${m.tokenViolations}`,
    `shadow ${m.shadowFindings}`,
    `coverage ${Math.round(m.coverage * 100)}%`,
  ];
  return parts.filter((p) => p !== null).join(' · ');
}

function environment(root: string): Report['env'] {
  let catalog: string | null = null;
  try {
    catalog = (JSON.parse(readFileSync(join(CATALOG_DIR, 'package.json'), 'utf8')) as { version?: string }).version ?? null;
  } catch {
    catalog = null;
  }
  let commit: string | null = null;
  try {
    commit = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim() || null;
  } catch {
    commit = null;
  }
  return { node: process.version, typescript: ts.version, catalog, commit };
}
