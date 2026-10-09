// Anthropic Messages API: POST /v1/messages.

import { postJson } from './http.ts';
import { list, num, record, str, sum } from './json.ts';
import { BASE_URL_ENV, DEFAULT_BASE_URL, type GenerateRequest, type Generation, type ModelSpec, type Provider, type ResolvedDeps } from './types.ts';

export const ANTHROPIC_VERSION = '2023-06-01';

export function anthropicProvider(spec: ModelSpec, key: string, deps: ResolvedDeps): Provider {
  const base = (deps.env[BASE_URL_ENV.anthropic] ?? DEFAULT_BASE_URL.anthropic).replace(/\/+$/, '');
  return {
    spec,
    async generate(request) {
      const started = performance.now();
      const { json, attempts } = await postJson({
        provider: 'anthropic',
        url: `${base}/v1/messages`,
        headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': ANTHROPIC_VERSION },
        body: anthropicBody(spec.model, request),
        secrets: [key],
        fetch: deps.fetch,
        sleep: deps.sleep,
        retries: deps.retries,
        timeoutMs: deps.timeoutMs,
        onRetry: deps.onRetry,
      });
      return { ...parseAnthropic(json), latencyMs: Math.round(performance.now() - started), attempts };
    },
  };
}

export function anthropicBody(model: string, { system, user, maxTokens }: GenerateRequest): Record<string, unknown> {
  return {
    model,
    max_tokens: maxTokens,
    // The system prompt is the same for every brief of a context: cache it.
    system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: user }],
  };
}

export function parseAnthropic(json: unknown): Pick<Generation, 'text' | 'usage' | 'stopReason'> {
  const body = record(json) ?? {};
  const text = list(body.content)
    .map(record)
    .filter((block) => str(block?.type) === 'text')
    .map((block) => str(block?.text) ?? '')
    .join('');
  const usage = record(body.usage) ?? {};
  const cacheRead = num(usage.cache_read_input_tokens);
  return {
    text,
    usage: {
      // input_tokens excludes cache reads and writes; the prompt size is all three.
      inputTokens: sum(num(usage.input_tokens), cacheRead, num(usage.cache_creation_input_tokens)),
      outputTokens: num(usage.output_tokens),
      cachedInputTokens: cacheRead,
    },
    stopReason: str(body.stop_reason) ?? null,
  };
}
