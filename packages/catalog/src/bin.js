#!/usr/bin/env node
// The `fluxnative-catalog` command. The CLI itself is cli.ts, and it imports
// the other @fluxnative packages, which also ship TypeScript source. Node
// strips TypeScript types everywhere except under node_modules, where it
// refuses (ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING), and that is where an
// installed copy lives. So this plain-JS entry strips the types of this
// package's .ts files and of any @fluxnative package's .ts files through a
// node:module load hook, then runs cli.ts. Needs Node.js 22.15 or newer.

import module from 'node:module';
import { readFileSync } from 'node:fs';

const { registerHooks, stripTypeScriptTypes } = module;
if (typeof registerHooks !== 'function' || typeof stripTypeScriptTypes !== 'function') {
  console.error(`fluxnative-catalog needs Node.js 22.15 or newer; this is ${process.version}.`);
  process.exit(1);
}

// stripTypeScriptTypes() is still marked experimental and warns once per
// process; that warning means nothing to someone running the command.
const emitWarning = process.emitWarning;
process.emitWarning = (warning, ...rest) => {
  if (String(warning).startsWith('stripTypeScriptTypes')) return;
  emitWarning.call(process, warning, ...rest);
};

const packageRoot = new URL('../', import.meta.url).href;
const ours = (url) => url.startsWith(packageRoot) || url.includes('/node_modules/@fluxnative/');
registerHooks({
  load(url, context, nextLoad) {
    if (!url.endsWith('.ts') || !ours(url)) return nextLoad(url, context);
    const source = stripTypeScriptTypes(readFileSync(new URL(url), 'utf8'));
    return { format: 'module', source, shortCircuit: true };
  },
});

await import('./cli.ts');
