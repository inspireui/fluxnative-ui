// A unified diff (`diff -u` format) in plain TypeScript, so `update` can show
// a drifted file next to the catalog's copy without a dependency or a shell.

type Op = { kind: ' ' | '-' | '+'; text: string };

/** Above this many cells the middle of the diff is shown as one replaced block. */
const MAX_TABLE = 4_000_000;
/** Marks a last line that has no newline after it. */
const NO_EOL = '\u0000';

function splitLines(text: string): string[] {
  if (text === '') return [];
  const lines = text.split('\n');
  const last = lines.pop() ?? '';
  if (last !== '') lines.push(`${last}${NO_EOL}`);
  return lines;
}

function middle(a: string[], b: string[]): Op[] {
  const n = a.length;
  const m = b.length;
  if (n === 0 || m === 0 || n * m > MAX_TABLE) {
    return [...a.map((text): Op => ({ kind: '-', text })), ...b.map((text): Op => ({ kind: '+', text }))];
  }
  // lcs[i * (m + 1) + j] = length of the longest common subsequence of a[i..] and b[j..].
  const width = m + 1;
  const lcs = new Uint32Array((n + 1) * width);
  const at = (i: number, j: number) => lcs[i * width + j] ?? 0;
  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      lcs[i * width + j] = a[i] === b[j] ? at(i + 1, j + 1) + 1 : Math.max(at(i + 1, j), at(i, j + 1));
    }
  }
  const ops: Op[] = [];
  let i = 0;
  let j = 0;
  while (i < n || j < m) {
    const left = a[i];
    const right = b[j];
    if (left !== undefined && right !== undefined && left === right) {
      ops.push({ kind: ' ', text: left });
      i += 1;
      j += 1;
    } else if (left !== undefined && (right === undefined || at(i + 1, j) >= at(i, j + 1))) {
      ops.push({ kind: '-', text: left });
      i += 1;
    } else if (right !== undefined) {
      ops.push({ kind: '+', text: right });
      j += 1;
    }
  }
  return ops;
}

function editScript(a: string[], b: string[]): Op[] {
  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start += 1;
  let endA = a.length;
  let endB = b.length;
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA -= 1;
    endB -= 1;
  }
  const same = (text: string): Op => ({ kind: ' ', text });
  return [...a.slice(0, start).map(same), ...middle(a.slice(start, endA), b.slice(start, endB)), ...a.slice(endA).map(same)];
}

function range(before: number, count: number): string {
  if (count === 0) return `${before},0`;
  return count === 1 ? `${before + 1}` : `${before + 1},${count}`;
}

/** `--- from` / `+++ to` and the hunks turning `from` into `to`; empty when they are equal. */
export function unifiedDiff(from: string, to: string, labels: { from: string; to: string }, context = 3): string {
  if (from === to) return '';
  const ops = editScript(splitLines(from), splitLines(to));
  const hunks: Array<{ start: number; end: number }> = [];
  ops.forEach((op, index) => {
    if (op.kind === ' ') return;
    const start = Math.max(0, index - context);
    const end = Math.min(ops.length, index + context + 1);
    const last = hunks[hunks.length - 1];
    if (last !== undefined && start <= last.end) last.end = Math.max(last.end, end);
    else hunks.push({ start, end });
  });
  const beforeA: number[] = [];
  const beforeB: number[] = [];
  let lineA = 0;
  let lineB = 0;
  for (const op of ops) {
    beforeA.push(lineA);
    beforeB.push(lineB);
    if (op.kind !== '+') lineA += 1;
    if (op.kind !== '-') lineB += 1;
  }
  const out = [`--- ${labels.from}`, `+++ ${labels.to}`];
  for (const { start, end } of hunks) {
    const slice = ops.slice(start, end);
    const countA = slice.filter((op) => op.kind !== '+').length;
    const countB = slice.filter((op) => op.kind !== '-').length;
    out.push(`@@ -${range(beforeA[start] ?? 0, countA)} +${range(beforeB[start] ?? 0, countB)} @@`);
    for (const op of slice) {
      if (op.text.endsWith(NO_EOL)) out.push(`${op.kind}${op.text.slice(0, -1)}`, '\\ No newline at end of file');
      else out.push(`${op.kind}${op.text}`);
    }
  }
  return `${out.join('\n')}\n`;
}
