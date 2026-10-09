// The report: every sample (prompt ids, raw reply, usage, grades) plus one
// summary row per model × context, written as JSON and printed as markdown.

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { Grades } from '../graders/index.ts';
import { REPORTS_DIR } from '../paths.ts';
import type { ContextMode } from './context.ts';
import type { Usage } from './providers/types.ts';

export interface SampleRecord {
  /** `anthropic:<model-id>`. */
  model: string;
  context: ContextMode;
  brief: string;
  /** 1-based. */
  sample: number;
  /** The raw reply; null when the call failed. */
  output: string | null;
  /** Transport failure after retries (not a model failure; excluded from the rates). */
  error: string | null;
  usage: Usage;
  latencyMs: number | null;
  attempts: number;
  stopReason: string | null;
  grades: Grades | null;
  pass1: boolean;
}

/** USD per million tokens, keyed by `<provider>:<model-id>`. */
export type Prices = Record<string, { inputPerMTok: number; outputPerMTok: number }>;

export interface SummaryRow {
  model: string;
  context: ContextMode;
  /** Samples asked for. */
  samples: number;
  /** Calls that failed after retries. */
  errors: number;
  /** Samples graded (samples − errors): the denominator of every rate. */
  n: number;
  pass1: number | null;
  typecheck: number | null;
  dialect: number | null;
  hallucinatedProps: number;
  catalogElements: number;
  /** Pooled: 100 × hallucinated props / catalog elements. */
  propsPer100: number | null;
  /** Means over the graded samples that had code. */
  tokenViolations: number | null;
  shadowFindings: number | null;
  coverage: number | null;
  stateCoverage: number | null;
  meanInputTokens: number | null;
  meanOutputTokens: number | null;
  meanLatencyMs: number | null;
  /** Needs `--prices`; null otherwise. */
  costUsd: number | null;
}

export function summarize(samples: readonly SampleRecord[], prices: Prices = {}): SummaryRow[] {
  const groups = new Map<string, SampleRecord[]>();
  for (const s of samples) {
    const key = `${s.model}\u0000${s.context}`;
    groups.set(key, [...(groups.get(key) ?? []), s]);
  }
  return [...groups.values()].map((group) => {
    const first = group[0] as SampleRecord;
    const graded = group.filter((s) => s.grades !== null);
    const grades = graded.map((s) => s.grades as Grades);
    const withCode = grades.filter((g) => g.metrics.hasCode);
    const hallucinatedProps = sumOf(withCode.map((g) => g.metrics.hallucinatedProps));
    const catalogElements = sumOf(withCode.map((g) => g.metrics.catalogElements));
    const price = prices[first.model];
    const inputs = graded.map((s) => s.usage.inputTokens).filter((v) => v !== undefined);
    const outputs = graded.map((s) => s.usage.outputTokens).filter((v) => v !== undefined);
    const latencies = graded.map((s) => s.latencyMs).filter((v) => v !== null);
    const priced = price !== undefined && inputs.length === graded.length && outputs.length === graded.length && graded.length > 0;
    return {
      model: first.model,
      context: first.context,
      samples: group.length,
      errors: group.length - graded.length,
      n: graded.length,
      pass1: rate(graded.map((s) => s.pass1)),
      typecheck: rate(grades.map((g) => g.typecheck.pass)),
      dialect: rate(grades.map((g) => g.dialect.pass)),
      hallucinatedProps,
      catalogElements,
      propsPer100: catalogElements === 0 ? null : (100 * hallucinatedProps) / catalogElements,
      tokenViolations: mean(withCode.map((g) => g.metrics.tokenViolations)),
      shadowFindings: mean(withCode.map((g) => g.metrics.shadowFindings)),
      coverage: mean(grades.map((g) => g.metrics.coverage)),
      stateCoverage: mean(grades.map((g) => g.metrics.stateCoverage)),
      meanInputTokens: mean(inputs),
      meanOutputTokens: mean(outputs),
      meanLatencyMs: mean(latencies),
      costUsd: priced ? (sumOf(inputs) * price.inputPerMTok + sumOf(outputs) * price.outputPerMTok) / 1e6 : null,
    };
  });
}

const COLUMNS = [
  ['model', 'left'],
  ['context', 'left'],
  ['n', 'right'],
  ['pass@1', 'right'],
  ['typecheck', 'right'],
  ['props/100', 'right'],
  ['token viol.', 'right'],
  ['shadow', 'right'],
  ['coverage', 'right'],
  ['states', 'right'],
  ['tokens in/out', 'right'],
  ['cost', 'right'],
] as const;

export function markdownTable(rows: readonly SummaryRow[]): string {
  const header = `| ${COLUMNS.map(([name]) => name).join(' | ')} |`;
  const rule = `|${COLUMNS.map(([, align]) => (align === 'right' ? '---:' : ':---')).join('|')}|`;
  const lines = rows.map((r) =>
    [
      r.model,
      r.context,
      r.errors > 0 ? `${r.n} (+${r.errors} err)` : String(r.n),
      pct(r.pass1),
      pct(r.typecheck),
      r.propsPer100 === null ? '—' : r.propsPer100.toFixed(1),
      r.tokenViolations === null ? '—' : r.tokenViolations.toFixed(2),
      r.shadowFindings === null ? '—' : r.shadowFindings.toFixed(2),
      pct(r.coverage),
      pct(r.stateCoverage),
      r.meanInputTokens === null && r.meanOutputTokens === null ? '—' : `${kilo(r.meanInputTokens)}/${kilo(r.meanOutputTokens)}`,
      r.costUsd === null ? '—' : `$${r.costUsd.toFixed(2)}`,
    ].join(' | '),
  );
  return [header, rule, ...lines.map((l) => `| ${l} |`)].join('\n');
}

/** `evals/reports/<YYYY-MM-DD>-<label>.json`. */
export function defaultReportPath(label: string, date: Date = new Date(), dir: string = REPORTS_DIR): string {
  return join(dir, `${date.toISOString().slice(0, 10)}-${slug(label)}.json`);
}

/** Writes the report without overwriting an earlier run (`-2`, `-3`… on a clash); returns the path used. */
export function writeReport(path: string, report: unknown): string {
  let target = path;
  for (let i = 2; existsSync(target); i += 1) target = path.replace(/(\.json)?$/, `-${i}.json`);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, `${JSON.stringify(report, null, 2)}\n`);
  return target;
}

export function slug(text: string): string {
  return (
    text
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || 'run'
  );
}

function rate(flags: readonly boolean[]): number | null {
  return flags.length === 0 ? null : flags.filter(Boolean).length / flags.length;
}

function mean(values: readonly number[]): number | null {
  return values.length === 0 ? null : sumOf(values) / values.length;
}

function sumOf(values: readonly number[]): number {
  return values.reduce((a, b) => a + b, 0);
}

function pct(value: number | null): string {
  return value === null ? '—' : `${Math.round(value * 100)}%`;
}

function kilo(value: number | null): string {
  if (value === null) return '—';
  return value >= 1000 ? `${(value / 1000).toFixed(1)}k` : String(Math.round(value));
}
