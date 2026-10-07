// `pnpm --filter @flux-ui/tokens build`: reads tokens/*.tokens.json and
// writes src/generated/{tokens.ts,theme.css}. `--global-css <path>` also
// writes an app's whole Uniwind entry file (repeatable). `--check` exits 1
// when any output is stale instead of writing it (for CI).

import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildModel } from './model.ts';
import { emitTs } from './emit-ts.ts';
import { emitCss, emitGlobalCss } from './emit-css.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const tokensDir = join(root, 'tokens');
const outDir = join(root, 'src', 'generated');
const check = process.argv.includes('--check');

const read = (file: string): unknown => JSON.parse(readFileSync(join(tokensDir, file), 'utf8'));

const schemes: Record<string, unknown> = {};
for (const file of readdirSync(tokensDir).sort()) {
  const match = /^color\.([a-z]+)\.tokens\.json$/.exec(file);
  if (match?.[1]) schemes[match[1]] = read(file);
}
// Light first: it is the default scheme every emitter falls back to.
const ordered = Object.fromEntries(
  Object.entries(schemes).sort(([a], [b]) => (a === 'light' ? -1 : b === 'light' ? 1 : a.localeCompare(b))),
);

const model = buildModel({ base: read('base.tokens.json'), schemes: ordered });
const outputs: Record<string, string> = {
  [join(outDir, 'tokens.ts')]: emitTs(model),
  [join(outDir, 'theme.css')]: emitCss(model),
};
process.argv.forEach((arg, i) => {
  const target = process.argv[i + 1];
  if (arg === '--global-css' && target) outputs[resolve(process.cwd(), target)] = emitGlobalCss(model);
});

let stale = false;
mkdirSync(outDir, { recursive: true });
for (const [file, content] of Object.entries(outputs)) {
  const current = existsSync(file) ? readFileSync(file, 'utf8') : '';
  if (current === content) continue;
  if (check) {
    stale = true;
    console.error(`stale: ${file} — run \`pnpm tokens\``);
  } else {
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, content);
    console.log(`wrote ${file}`);
  }
}
if (stale) process.exit(1);
