#!/usr/bin/env node
// Kit-level eval runner. `node evals/runner/run.ts --help`, or `pnpm eval`.

import { main } from './main.ts';

process.exitCode = await main(process.argv.slice(2));
