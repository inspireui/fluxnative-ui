#!/usr/bin/env node
// The `fluxnative-tokens` command. The CLI itself is cli.ts. Node strips
// TypeScript types everywhere except under node_modules, where it refuses
// (ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING), and that is where an
// installed copy of this package lives. So this plain-JS entry strips the
// types of the package's own .ts files through a node:module load hook,
// then runs cli.ts. Needs Node.js 22.15 or newer.

import module from 'node:module';
import { readFileSync } from 'node:fs';

const { registerHooks, stripTypeScriptTypes } = module;
if (typeof registerHooks !== 'function' || typeof stripTypeScriptTypes !== 'function') {
  console.error(`fluxnative-tokens needs Node.js 22.15 or newer; this is ${process.version}.`);
  process.exit(1);
}

// stripTypeScriptTypes() is still marked experimental and warns once per
// process. The warning means nothing to someone running the command, so
// only that one is dropped.
const emitWarning = process.emitWarning;
process.emitWarning = (warning, ...rest) => {
  if (String(warning).startsWith('stripTypeScriptTypes')) return;
  emitWarning.call(process, warning, ...rest);
};

const packageRoot = new URL('../', import.meta.url).href;
registerHooks({
  load(url, context, nextLoad) {
    if (!url.startsWith(packageRoot) || !url.endsWith('.ts')) return nextLoad(url, context);
    const source = stripTypeScriptTypes(readFileSync(new URL(url), 'utf8'));
    return { format: 'module', source, shortCircuit: true };
  },
});

await import('./cli.ts');
