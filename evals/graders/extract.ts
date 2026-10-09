// extract: the reply must hold exactly one ```tsx block (the whole screen
// file). When it doesn't, the most plausible block is still handed to the
// other graders so the report says what else went wrong, but pass@1 fails.

import type { GradeResult } from './types.ts';

export interface Fence {
  /** First word of the info string, lower-cased (`tsx`, `typescript`, ``). */
  lang: string;
  info: string;
  code: string;
  /** 1-based line of the opening fence. */
  line: number;
  /** False when the reply ended inside the block (truncated output). */
  closed: boolean;
}

export interface ExtractDetails {
  blocks: number;
  tsxBlocks: number;
  langs: string[];
  /** Why it failed, when it did. */
  reason?: string;
}

export interface Extracted extends GradeResult<ExtractDetails> {
  /** The code the other graders look at; null when there is nothing code-like. */
  code: string | null;
}

/** CommonMark-style fenced blocks: ``` or ~~~, at least three, closed by the same run or longer. */
export function findFences(text: string): Fence[] {
  const lines = text.split(/\r?\n/);
  const fences: Fence[] = [];
  let open: { char: string; length: number; info: string; line: number; body: string[] } | null = null;
  for (const [index, line] of lines.entries()) {
    if (open === null) {
      const start = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line);
      const marker = start?.[1];
      const info = (start?.[2] ?? '').trim();
      if (marker === undefined || (marker.startsWith('`') && info.includes('`'))) continue;
      open = { char: marker.charAt(0), length: marker.length, info, line: index + 1, body: [] };
      continue;
    }
    const end = /^ {0,3}(`{3,}|~{3,})\s*$/.exec(line)?.[1];
    if (end !== undefined && end.charAt(0) === open.char && end.length >= open.length) {
      fences.push(toFence(open, true));
      open = null;
    } else {
      open.body.push(line);
    }
  }
  if (open !== null) fences.push(toFence(open, false));
  return fences;
}

function toFence(open: { info: string; line: number; body: string[] }, closed: boolean): Fence {
  return { lang: (open.info.split(/\s+/)[0] ?? '').toLowerCase(), info: open.info, code: open.body.join('\n'), line: open.line, closed };
}

/** Preference when the reply isn't exactly one tsx block: the longest block of the best language. */
const LANG_RANK: Record<string, number> = { tsx: 5, typescript: 4, ts: 4, jsx: 3, javascript: 2, js: 2, '': 1 };

export function extract(output: string): Extracted {
  const fences = findFences(output);
  const tsx = fences.filter((f) => f.lang === 'tsx');
  const details: ExtractDetails = { blocks: fences.length, tsxBlocks: tsx.length, langs: fences.map((f) => f.lang || '(none)') };

  const only = fences.length === 1 ? fences[0] : undefined;
  if (only !== undefined && only.lang === 'tsx' && only.closed && only.code.trim() !== '') {
    return { pass: true, score: 1, details, code: only.code };
  }

  if (fences.length === 0) details.reason = 'no code block';
  else if (tsx.length === 0) details.reason = `no tsx block (found ${details.langs.join(', ')})`;
  else if (fences.length > 1) details.reason = `${fences.length} code blocks, expected exactly one`;
  else if (!only?.closed) details.reason = 'the code block is not closed (truncated output?)';
  else details.reason = 'the code block is empty';

  const candidates = fences
    .filter((f) => (LANG_RANK[f.lang] ?? 0) > 0 && f.code.trim() !== '')
    .sort((a, b) => (LANG_RANK[b.lang] ?? 0) - (LANG_RANK[a.lang] ?? 0) || b.code.length - a.code.length);
  let code = candidates[0]?.code ?? null;
  // A bare file with no fence at all is still worth grading for diagnostics.
  if (code === null && fences.length === 0 && /^\s*(import|export)\s/m.test(output)) code = output;
  return { pass: false, score: 0, details, code };
}
