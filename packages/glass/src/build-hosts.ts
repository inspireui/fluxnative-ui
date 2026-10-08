// `node packages/glass/src/build-hosts.ts [--check]`: refreshes the palette
// block in hosts/*/glass.tsx from the tokens (run by `pnpm tokens`).

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { HOST_FILES, applyPaletteBlock } from './hosts.ts';

const hostsDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'hosts');
const check = process.argv.includes('--check');
let stale = false;

for (const file of HOST_FILES) {
  const path = join(hostsDir, file);
  const current = readFileSync(path, 'utf8');
  const next = applyPaletteBlock(current, file);
  if (next === current) continue;
  stale = true;
  if (check) {
    console.error(`stale: packages/glass/hosts/${file} (run \`pnpm tokens\`)`);
  } else {
    writeFileSync(path, next);
    console.log(`wrote packages/glass/hosts/${file}`);
  }
}

if (check && stale) process.exit(1);
if (!stale) console.log(check ? 'glass hosts up to date' : 'glass hosts unchanged');
