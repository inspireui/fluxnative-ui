// POST JSON with a simple backoff: 408, 429, 5xx (Anthropic's 529 too) and
// network errors are retried with exponential, jittered waits, honouring
// `retry-after` / `retry-after-ms`. Error messages never carry the key: the
// key travels in a header, and any echo of it in a response is redacted.

import type { Fetch } from './types.ts';

export class HttpError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
  }
}

export interface PostOptions {
  provider: string;
  url: string;
  headers: Record<string, string>;
  body: unknown;
  /** Values to scrub from every error message (the API key). */
  secrets: readonly string[];
  fetch: Fetch;
  sleep: (ms: number) => Promise<void>;
  retries: number;
  timeoutMs: number;
  onRetry?: (message: string) => void;
}

const MAX_WAIT_MS = 60_000;

export async function postJson(options: PostOptions): Promise<{ json: unknown; attempts: number }> {
  const { provider, secrets } = options;
  for (let attempt = 1; ; attempt += 1) {
    let response: Response;
    try {
      response = await options.fetch(options.url, {
        method: 'POST',
        headers: options.headers,
        body: JSON.stringify(options.body),
        signal: AbortSignal.timeout(options.timeoutMs),
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      if (attempt <= options.retries) {
        const wait = backoffMs(attempt);
        options.onRetry?.(redact(`${provider}: ${reason}; retry ${attempt}/${options.retries} in ${seconds(wait)}`, secrets));
        await options.sleep(wait);
        continue;
      }
      throw new Error(redact(`${provider}: request failed after ${attempt} attempt(s): ${reason}`, secrets));
    }

    if (response.ok) {
      const text = await response.text();
      try {
        return { json: JSON.parse(text) as unknown, attempts: attempt };
      } catch {
        throw new Error(redact(`${provider}: the response is not JSON: ${text.slice(0, 200)}`, secrets));
      }
    }

    const body = await response.text().catch(() => '');
    const retryable = response.status === 408 || response.status === 429 || response.status >= 500;
    if (retryable && attempt <= options.retries) {
      const wait = retryAfterMs(response.headers) ?? backoffMs(attempt);
      options.onRetry?.(`${provider}: HTTP ${response.status}; retry ${attempt}/${options.retries} in ${seconds(wait)}`);
      await options.sleep(wait);
      continue;
    }
    throw new HttpError(redact(`${provider}: HTTP ${response.status}: ${errorMessage(body)}`, secrets), response.status);
  }
}

/** 1 s, 2 s, 4 s… capped at 60 s, with equal jitter. */
export function backoffMs(attempt: number, random: () => number = Math.random): number {
  const base = Math.min(MAX_WAIT_MS, 1000 * 2 ** (attempt - 1));
  return Math.round(base / 2 + (random() * base) / 2);
}

export function retryAfterMs(headers: Headers): number | null {
  const ms = headers.get('retry-after-ms');
  if (ms !== null && ms.trim() !== '' && Number.isFinite(Number(ms))) return clampWait(Number(ms));
  const after = headers.get('retry-after');
  if (after === null || after.trim() === '') return null;
  if (Number.isFinite(Number(after))) return clampWait(Number(after) * 1000);
  const date = Date.parse(after);
  return Number.isNaN(date) ? null : clampWait(date - Date.now());
}

export function redact(text: string, secrets: readonly string[]): string {
  let out = text;
  for (const secret of secrets) if (secret.length >= 8) out = out.split(secret).join('[redacted]');
  return out;
}

export function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** `{ "error": { "message": … } }` is the shape all three vendors use; anything else is shown raw, shortened. */
function errorMessage(body: string): string {
  try {
    const parsed = JSON.parse(body) as { error?: { message?: unknown } };
    if (typeof parsed.error?.message === 'string') return parsed.error.message;
  } catch {
    // not JSON
  }
  return body.length > 500 ? `${body.slice(0, 500)}…` : body;
}

function clampWait(ms: number): number {
  return Math.min(Math.max(0, Math.round(ms)), MAX_WAIT_MS);
}

function seconds(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`;
}
