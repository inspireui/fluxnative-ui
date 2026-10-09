// Narrowing helpers for vendor JSON: responses are read defensively, so a
// missing field becomes `undefined` instead of a crash mid-run.

export function record(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;
}

export function list(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

export function num(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

export function str(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

/** Sum of the defined numbers; undefined when there are none. */
export function sum(...values: (number | undefined)[]): number | undefined {
  const defined = values.filter((v) => v !== undefined);
  return defined.length === 0 ? undefined : defined.reduce((a, b) => a + b, 0);
}
