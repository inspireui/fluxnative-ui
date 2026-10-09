// A deliberately small Markdown reader for AI replies: paragraphs, `#`
// headings, `-` / `*` / `1.` list items and fenced code blocks; **bold**,
// *italic*, `code` and the text of [links](url) inline. Anything else stays
// literal text. With `open` (a reply still streaming), the last block styles
// an unclosed marker to its end and hides a marker that ends the text, so
// `**Kyo` shows as a bold "Kyo" rather than flashing asterisks. No imports:
// `node --test` loads it as is.

export interface MarkdownSpan {
  text: string;
  bold?: boolean;
  italic?: boolean;
  code?: boolean;
}

export type MarkdownBlock =
  | { kind: 'paragraph'; spans: MarkdownSpan[] }
  | { kind: 'heading'; spans: MarkdownSpan[] }
  /** A list item; `marker` is `•` or the item's number (`2.`). */
  | { kind: 'item'; marker: string; spans: MarkdownSpan[] }
  | { kind: 'code'; text: string };

export interface MarkdownOptions {
  /** The text is still arriving: see the file comment. Default false. */
  open?: boolean;
}

const FENCE = /^\s{0,3}(`{3,}|~{3,})/;
const HEADING = /^\s{0,3}#{1,6}\s+(.*?)(?:\s+#+)?\s*$/;
const RULE = /^\s{0,3}([-*_])(?:\s*\1){2,}\s*$/;
const BULLET = /^\s*[-*+•]\s+(.*)$/;
const ORDERED = /^\s*(\d{1,3})[.)]\s+(.*)$/;
const LINK = /^\[([^\]\n]+)\]\([^()\s]*\)/;
const ESCAPABLE = /[\\`*_[\]()#+\-.!>~|]/;
const SPACE = /\s/;
const WORD = /[\p{L}\p{N}_]/u;

type RawBlock = { kind: 'paragraph' | 'heading' | 'code'; text: string } | { kind: 'item'; marker: string; text: string };

/** Splits `source` into blocks; see the file comment for what is read. */
export function parseMarkdown(source: string, options: MarkdownOptions = {}): MarkdownBlock[] {
  const raw = readBlocks(source.replace(/\r\n?/g, '\n'));
  const open = options.open === true;
  return raw.map((block, index): MarkdownBlock => {
    if (block.kind === 'code') return { kind: 'code', text: block.text };
    const spans = readInline(block.text, open && index === raw.length - 1);
    return block.kind === 'item' ? { kind: 'item', marker: block.marker, spans } : { kind: block.kind, spans };
  });
}

/** The words of the blocks without markup, one block per line: what a screen reader should hear. */
export function plainText(blocks: readonly MarkdownBlock[]): string {
  return blocks
    .map((block) => {
      if (block.kind === 'code') return block.text;
      const words = block.spans.map((span) => span.text).join('');
      return block.kind === 'item' ? `${block.marker} ${words}` : words;
    })
    .join('\n');
}

/** `plainText(parseMarkdown(source, options))`. */
export function stripMarkdown(source: string, options: MarkdownOptions = {}): string {
  return plainText(parseMarkdown(source, options));
}

function readBlocks(source: string): RawBlock[] {
  const blocks: RawBlock[] = [];
  // The paragraph or list item being read; later lines without a marker join it.
  let current: RawBlock | null = null;
  let code: string[] | null = null;
  let fence = '';
  const close = () => {
    if (current !== null) blocks.push(current);
    current = null;
  };

  for (const line of source.split('\n')) {
    if (code !== null) {
      const end = FENCE.exec(line);
      if (end?.[1] !== undefined && end[1][0] === fence[0] && end[1].length >= fence.length && line.trim() === end[1]) {
        blocks.push({ kind: 'code', text: code.join('\n') });
        code = null;
      } else {
        code.push(line);
      }
      continue;
    }
    const opening = FENCE.exec(line);
    if (opening?.[1] !== undefined) {
      close();
      code = [];
      fence = opening[1];
      continue;
    }
    if (line.trim() === '') {
      close();
      continue;
    }
    const heading = HEADING.exec(line);
    if (heading) {
      close();
      blocks.push({ kind: 'heading', text: heading[1] ?? '' });
      continue;
    }
    if (RULE.test(line)) {
      close();
      continue;
    }
    const bullet = BULLET.exec(line);
    const ordered = bullet ? null : ORDERED.exec(line);
    if (bullet || ordered) {
      close();
      current = bullet ? { kind: 'item', marker: '•', text: bullet[1] ?? '' } : { kind: 'item', marker: `${ordered?.[1] ?? ''}.`, text: ordered?.[2] ?? '' };
      continue;
    }
    if (current === null) current = { kind: 'paragraph', text: line };
    else current.text += `\n${line.trim()}`;
  }
  close();
  // An unclosed fence (a reply cut short, or still streaming) is still code.
  if (code !== null) blocks.push({ kind: 'code', text: code.join('\n') });
  return blocks;
}

/**
 * Whether `marker` closes later in `text`, after at least one character from
 * `start` on. Markers come in runs: `**` closes bold, `*` italic, `***` both.
 */
function closes(text: string, start: number, marker: string): boolean {
  const char = marker[0] ?? '';
  for (let at = start + 1; at < text.length; at += 1) {
    if (text[at] !== char) continue;
    let end = at;
    while (text[end] === char) end += 1;
    const run = end - at;
    const fits = marker.length === 2 ? run >= 2 : run !== 2;
    if (fits && !SPACE.test(text[at - 1] ?? ' ') && (char !== '_' || !WORD.test(text[end] ?? ' '))) return true;
    at = end - 1;
  }
  return false;
}

function readInline(text: string, open: boolean): MarkdownSpan[] {
  const spans: MarkdownSpan[] = [];
  let buffer = '';
  let bold: string | null = null;
  let italic: string | null = null;
  let code = false;
  const push = () => {
    if (buffer === '') return;
    const span: MarkdownSpan = { text: buffer };
    if (bold !== null) span.bold = true;
    if (italic !== null) span.italic = true;
    if (code) span.code = true;
    spans.push(span);
    buffer = '';
  };

  let i = 0;
  while (i < text.length) {
    const c = text[i] ?? '';
    const atEnd = (length: number) => i + length >= text.length;
    if (code) {
      if (c === '`') {
        push();
        code = false;
      } else {
        buffer += c;
      }
      i += 1;
      continue;
    }
    if (c === '\\' && ESCAPABLE.test(text[i + 1] ?? '')) {
      buffer += text[i + 1];
      i += 2;
      continue;
    }
    if (c === '`') {
      if (open && atEnd(1)) {
        i += 1;
        continue;
      }
      if (open || text.indexOf('`', i + 1) !== -1) {
        push();
        code = true;
      } else {
        buffer += c;
      }
      i += 1;
      continue;
    }
    if (c === '*' || c === '_') {
      const pair = text[i + 1] === c ? c + c : c;
      const before = text[i - 1] ?? ' ';
      const after = text[i + pair.length] ?? '';
      const current: string | null = pair.length === 2 ? bold : italic;
      // `_` only counts at a word's edge, so snake_case stays as written.
      if (current === pair && !SPACE.test(before) && (c === '*' || !WORD.test(after))) {
        push();
        if (pair.length === 2) bold = null;
        else italic = null;
        i += pair.length;
        continue;
      }
      if (current === null && after !== '' && !SPACE.test(after) && (c === '*' || !WORD.test(before)) && (open || closes(text, i + pair.length, pair))) {
        push();
        if (pair.length === 2) bold = pair;
        else italic = pair;
        i += pair.length;
        continue;
      }
      if (open && atEnd(pair.length)) {
        i += pair.length;
        continue;
      }
      buffer += pair;
      i += pair.length;
      continue;
    }
    if (c === '[') {
      const link = LINK.exec(text.slice(i));
      if (link) {
        buffer += link[1];
        i += link[0].length;
        continue;
      }
    }
    buffer += c;
    i += 1;
  }
  push();
  return spans;
}
