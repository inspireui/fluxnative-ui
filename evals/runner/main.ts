// The CLI: validate everything (flags, briefs, keys) before the first call,
// run, write the JSON report, print the markdown summary on stdout.

import { readFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { DRY_RUN_DIR } from '../paths.ts';
import { USAGE, parseCli, type CliOptions } from './args.ts';
import { selectBriefs } from './briefs.ts';
import { CONTEXT_MODES, isContextMode, type ContextMode } from './context.ts';
import { runEval } from './harness.ts';
import { missingKeys, parseModelSpec, type Fetch, type ModelSpec } from './providers/index.ts';
import { defaultReportPath, markdownTable, slug, writeReport, type Prices } from './report.ts';

export interface Io {
  stdout: (text: string) => void;
  stderr: (text: string) => void;
  env: Record<string, string | undefined>;
  cwd: string;
  fetch?: Fetch;
  sleep?: (ms: number) => Promise<void>;
}

const defaultIo: Io = {
  stdout: (text) => process.stdout.write(`${text}\n`),
  stderr: (text) => process.stderr.write(`${text}\n`),
  env: process.env,
  cwd: process.cwd(),
};

/** Exit code: 0 after a run (whatever the scores), 1 on a setup error, 2 on bad flags. */
export async function main(argv: readonly string[], io: Io = defaultIo): Promise<number> {
  let cli: CliOptions;
  try {
    cli = parseCli(argv);
  } catch (error) {
    io.stderr(`${(error as Error).message}\n\n${USAGE}`);
    return 2;
  }
  if (cli.help) {
    io.stdout(USAGE);
    return 0;
  }

  let models: ModelSpec[];
  let contexts: ContextMode[];
  let prices: Prices | undefined;
  try {
    models = [...new Set(cli.models)].map((raw) => parseModelSpec(raw, { allowFixture: cli.dryRun }));
    if (models.length === 0) {
      if (!cli.dryRun) throw new Error('--model <provider>:<model-id> is required (or use --dry-run)');
      models = [{ provider: 'fixture', model: 'canned' }];
    }
    const badContext = cli.contexts.filter((c) => !isContextMode(c));
    if (badContext.length > 0) throw new Error(`--context ${badContext.join(', ')}: expected ${CONTEXT_MODES.join(' or ')}`);
    contexts = [...new Set(cli.contexts)] as ContextMode[];
    if (cli.prices !== undefined) prices = JSON.parse(readFileSync(resolve(io.cwd, cli.prices), 'utf8')) as Prices;
  } catch (error) {
    io.stderr(`${(error as Error).message}\n\n${USAGE}`);
    return 2;
  }

  if (!cli.dryRun) {
    const missing = missingKeys(models, io.env);
    if (missing.length > 0) {
      for (const message of missing) io.stderr(message);
      return 1;
    }
  }

  try {
    const briefs = selectBriefs(cli.briefs);
    const label = cli.label ?? (cli.dryRun ? 'dry-run' : models.map((m) => m.model).join('+'));
    const out = cli.out === undefined ? defaultReportPath(label) : resolve(io.cwd, cli.out);
    const report = await runEval(
      {
        models,
        contexts,
        briefs,
        samples: cli.samples,
        dryRun: cli.dryRun,
        maxTokens: cli.maxTokens,
        concurrency: cli.concurrency,
        timeoutMs: cli.timeoutMs,
        fixturesDir: cli.fixtures === undefined ? DRY_RUN_DIR : resolve(io.cwd, cli.fixtures),
        label: slug(label),
      },
      {
        env: io.env,
        log: io.stderr,
        ...(io.fetch ? { fetch: io.fetch } : {}),
        ...(io.sleep ? { sleep: io.sleep } : {}),
        ...(prices ? { prices } : {}),
      },
    );
    const written = writeReport(out, report);
    io.stdout(markdownTable(report.summary));
    const shown = relative(io.cwd, written);
    io.stderr(`\nreport: ${shown === '' || shown.startsWith('..') ? written : shown}`);
    return 0;
  } catch (error) {
    io.stderr((error as Error).message);
    return 1;
  }
}
