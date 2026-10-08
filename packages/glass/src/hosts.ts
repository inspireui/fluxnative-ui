// Keeps the generated palette block inside each host file in step with the
// tokens. `node packages/glass/src/build-hosts.ts` rewrites the block;
// `--check` fails when it is stale. The rest of a host file is hand-written.

import { GLASS_CONTRACT } from './contract.ts';

export const PALETTE_START = '// fluxnative-glass-palette:start';
export const PALETTE_END = '// fluxnative-glass-palette:end';

/** Host files, relative to `packages/glass/hosts`. */
export const HOST_FILES = ['web/glass.tsx', 'expo/glass.tsx'] as const;

const q = (s: string) => `'${s}'`;

export function renderPaletteBlock(): string {
  const { palette, blur, look, version } = GLASS_CONTRACT;
  const scheme = (name: 'light' | 'dark') =>
    `  ${name}: {\n${Object.entries(palette[name])
      .map(([k, v]) => `    ${k}: ${q(v)},`)
      .join('\n')}\n  },`;
  return [
    PALETTE_START,
    `// Generated from @fluxnative/tokens by \`pnpm tokens\` (contract v${version}) — do not edit by hand.`,
    'const PALETTE = {',
    scheme('light'),
    scheme('dark'),
    '} as const;',
    `const BLUR = { radius: ${blur.radius}, saturate: ${blur.saturate} } as const;`,
    `const LOOK = { tintAlpha: { blur: ${look.tintAlpha.blur}, translucent: ${look.tintAlpha.translucent} }, sheenOpacity: { light: ${look.sheenOpacity.light}, dark: ${look.sheenOpacity.dark} } } as const;`,
    PALETTE_END,
  ].join('\n');
}

/** `source` with its palette block replaced by the current one. */
export function applyPaletteBlock(source: string, where = 'host file'): string {
  const start = source.indexOf(PALETTE_START);
  const end = source.indexOf(PALETTE_END);
  if (start < 0 || end < 0 || end < start) {
    throw new Error(`${where}: missing "${PALETTE_START}" … "${PALETTE_END}" block`);
  }
  return source.slice(0, start) + renderPaletteBlock() + source.slice(end + PALETTE_END.length);
}
