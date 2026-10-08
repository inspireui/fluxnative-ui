import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GLASS_CONTRACT } from './contract.ts';
import { HOST_FILES, applyPaletteBlock, renderPaletteBlock } from './hosts.ts';

const hostsDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'hosts');
const hosts = HOST_FILES.map((file) => ({ file, source: readFileSync(join(hostsDir, file), 'utf8') }));

test('every host file carries the current token palette', () => {
  for (const { file, source } of hosts) {
    assert.equal(applyPaletteBlock(source, file), source, `${file} palette block is stale: run pnpm tokens`);
    assert.ok(source.includes(renderPaletteBlock()));
  }
});

test('every host file exports the contract surface', () => {
  for (const { file, source } of hosts) {
    for (const name of GLASS_CONTRACT.exports.values) {
      assert.match(source, new RegExp(`export function ${name}\\b`), `${file} must export ${name}`);
    }
    for (const name of GLASS_CONTRACT.exports.types) {
      assert.match(source, new RegExp(`export (type|interface) ${name}\\b`), `${file} must export type ${name}`);
    }
    for (const tier of GLASS_CONTRACT.tiers) {
      assert.ok(source.includes(`'${tier}'`), `${file} must know the tier ${tier}`);
    }
  }
});

test('host files stand alone: no imports from the monorepo', () => {
  for (const { file, source } of hosts) {
    assert.doesNotMatch(source, /from '@fluxnative\//, `${file} must not import @fluxnative/*`);
    assert.doesNotMatch(source, /from '\.\.?\//, `${file} must not import relative files`);
  }
});

test('the palette is the glass slice of the tokens', () => {
  assert.equal(GLASS_CONTRACT.palette.light.opaque, '#f9f9f9');
  assert.equal(GLASS_CONTRACT.palette.dark.opaque, '#1c1c1e');
  assert.equal(GLASS_CONTRACT.blur.radius, 24);
  assert.equal(GLASS_CONTRACT.blur.saturate, 1.8);
});
