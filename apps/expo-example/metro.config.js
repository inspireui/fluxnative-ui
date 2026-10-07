const path = require('node:path');
const { getDefaultConfig } = require('expo/metro-config');
const { withUniwindConfig } = require('uniwind/metro');

const config = getDefaultConfig(__dirname);

// Uniwind joins these paths onto process.cwd(), so express them relative to
// the cwd: the app then bundles the same whether Metro starts here or from
// the monorepo root.
const fromCwd = (file) => path.relative(process.cwd(), path.join(__dirname, file));

// Uniwind must be the outermost wrapper. global.css is generated from the
// Flux UI tokens: run `pnpm tokens` at the repo root after changing them.
module.exports = withUniwindConfig(config, {
  cssEntryFile: fromCwd('src/global.css'),
  dtsFile: fromCwd('src/uniwind-types.d.ts'),
});
