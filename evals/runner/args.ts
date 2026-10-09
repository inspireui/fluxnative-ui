// Command-line flags (node:util parseArgs, strict: unknown flags fail).

import { parseArgs } from 'node:util';

export const USAGE = `usage: node evals/runner/run.ts [options]      (or: pnpm eval [options])

  --model <provider>:<model-id>   repeatable; providers anthropic, openai, google
                                  keys: ANTHROPIC_API_KEY, OPENAI_API_KEY, GEMINI_API_KEY
  --context none|index            repeatable or comma-separated (default index)
  --briefs <ids|all>              comma-separated brief ids (default all)
  --samples N                     replies per model × context × brief (default 1)
  --out <file.json>               default evals/reports/<date>-<label>.json
  --label <text>                  names the report (default: the model ids, or dry-run)
  --dry-run                       grade the canned replies in evals/fixtures/dry-run; no API calls
  --fixtures <dir>                canned replies for --dry-run (default evals/fixtures/dry-run)
  --max-tokens N                  output budget per call, reasoning included (default 16000)
  --concurrency N                 parallel API calls (default 4)
  --timeout <seconds>             per HTTP attempt (default 600)
  --prices <file.json>            { "<provider>:<model-id>": { "inputPerMTok": 3, "outputPerMTok": 15 } }
  --help`;

export interface CliOptions {
  models: string[];
  contexts: string[];
  briefs: string | undefined;
  samples: number;
  out: string | undefined;
  label: string | undefined;
  dryRun: boolean;
  fixtures: string | undefined;
  maxTokens: number;
  concurrency: number;
  timeoutMs: number;
  prices: string | undefined;
  help: boolean;
}

export function parseCli(argv: readonly string[]): CliOptions {
  const { values } = parseArgs({
    args: [...argv],
    strict: true,
    allowPositionals: false,
    options: {
      model: { type: 'string', multiple: true },
      context: { type: 'string', multiple: true },
      briefs: { type: 'string' },
      samples: { type: 'string' },
      out: { type: 'string' },
      label: { type: 'string' },
      'dry-run': { type: 'boolean' },
      fixtures: { type: 'string' },
      'max-tokens': { type: 'string' },
      concurrency: { type: 'string' },
      timeout: { type: 'string' },
      prices: { type: 'string' },
      help: { type: 'boolean', short: 'h' },
    },
  });
  return {
    models: values.model ?? [],
    contexts: (values.context ?? ['index']).flatMap((c) => c.split(',')).map((c) => c.trim()).filter(Boolean),
    briefs: values.briefs,
    samples: positiveInt(values.samples, 1, '--samples'),
    out: values.out,
    label: values.label,
    dryRun: values['dry-run'] ?? false,
    fixtures: values.fixtures,
    maxTokens: positiveInt(values['max-tokens'], 16_000, '--max-tokens'),
    concurrency: positiveInt(values.concurrency, 4, '--concurrency'),
    timeoutMs: positiveInt(values.timeout, 600, '--timeout') * 1000,
    prices: values.prices,
    help: values.help ?? false,
  };
}

function positiveInt(raw: string | undefined, fallback: number, flag: string): number {
  if (raw === undefined) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1) throw new Error(`${flag} must be a positive integer, got "${raw}"`);
  return value;
}
