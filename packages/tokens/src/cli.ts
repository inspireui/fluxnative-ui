// fluxnative-tokens global-css --out <path> [--check]
//
// Writes an app's Uniwind CSS entry file from this package's own token
// files: `@import 'tailwindcss'`, `@import 'uniwind'` and the FluxNative UI
// theme. Uniwind registers the light/dark themes by scanning the `@variant`
// blocks of its CSS entry file, so `@import '@fluxnative/tokens/theme.css'`
// is not enough; this command is how an app outside this repo gets the file.
// The output is byte for byte what `pnpm tokens` writes for the example app.
//
// `--check` writes nothing and exits 1 when the file is missing or differs.
// The command never writes inside this package or any node_modules folder.
// The package's bin is `bin.js`, which runs this file: Node won't strip
// types under node_modules, where an installed copy lives.

import { existsSync, mkdirSync, readdirSync, readFileSync, realpathSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { emitGlobalCss } from './emit-css.ts';
import { buildModel, type TokenSources } from './model.ts';

const PACKAGE_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const USAGE = `usage: fluxnative-tokens global-css --out <path> [--check]

  global-css  write the Uniwind CSS entry file: the tailwindcss and uniwind
              imports followed by the FluxNative UI theme
  --out       the file to write, e.g. src/global.css (Metro's cssEntryFile)
  --check     write nothing; exit 1 when the file is missing or out of date`;

function fail(message: string, code = 2): never {
  console.error(message);
  process.exit(code);
}

/** The token documents, read as build.ts reads them: light scheme first, the default every emitter falls back to. */
function readSources(dir: string): TokenSources {
  const read = (file: string): unknown => JSON.parse(readFileSync(join(dir, file), 'utf8'));
  const schemes = readdirSync(dir)
    .map((file) => /^color\.([a-z]+)\.tokens\.json$/.exec(file)?.[1])
    .filter((name): name is string => name !== undefined)
    .sort((a, b) => (a === 'light' ? -1 : b === 'light' ? 1 : a.localeCompare(b)));
  return {
    base: read('base.tokens.json'),
    schemes: Object.fromEntries(schemes.map((name) => [name, read(`color.${name}.tokens.json`)])),
  };
}

function isInside(path: string, dir: string): boolean {
  const rel = relative(dir, path);
  return rel === '' || (rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel));
}

/** `path` with symlinks resolved, also when it or some of its parents don't exist yet. */
function realPath(path: string): string {
  const missing: string[] = [];
  let existing = path;
  while (!existsSync(existing) && dirname(existing) !== existing) {
    missing.unshift(basename(existing));
    existing = dirname(existing);
  }
  return join(realpathSync(existing), ...missing);
}

const argv = process.argv.slice(2);
if (argv.includes('--help') || argv.includes('-h')) {
  console.log(USAGE);
  process.exit(0);
}

const [command, ...options] = argv;
if (command !== 'global-css') fail(command === undefined ? USAGE : `unknown command "${command}"\n\n${USAGE}`);

let out: string | undefined;
let check = false;
for (let i = 0; i < options.length; i += 1) {
  const option = options[i] ?? '';
  if (option === '--check') check = true;
  else if (option.startsWith('--out=')) out = option.slice('--out='.length);
  else if (option === '--out') {
    out = options[i + 1];
    i += 1;
  } else fail(`unknown option "${option}"\n\n${USAGE}`);
}
if (!out || out.startsWith('--')) fail(`--out needs a file path\n\n${USAGE}`);

const target = resolve(process.cwd(), out);
const real = realPath(target);
const forbidden = isInside(real, realpathSync(PACKAGE_ROOT))
  ? 'the @fluxnative/tokens package'
  : [target, real].some((path) => path.split(sep).includes('node_modules'))
    ? 'a node_modules folder'
    : null;
if (forbidden) fail(`refusing to write ${out}: it is inside ${forbidden}. Point --out at your app's source, e.g. src/global.css.`);
if (existsSync(target) && statSync(target).isDirectory()) fail(`--out must be a file path; ${out} is a directory`);

const css = emitGlobalCss(buildModel(readSources(join(PACKAGE_ROOT, 'tokens'))));
const current = existsSync(target) ? readFileSync(target, 'utf8') : null;
const shown = relative(process.cwd(), target) || target;

if (current === css) {
  console.log(`${shown} is up to date`);
} else if (check) {
  fail(`${current === null ? 'missing' : 'stale'}: ${shown} — run \`npx fluxnative-tokens global-css --out ${out}\``, 1);
} else {
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, css);
  console.log(`wrote ${shown}`);
}
