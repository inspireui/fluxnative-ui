// OpenAI Responses API: POST /v1/responses. `OPENAI_BASE_URL` points it at
// any server that speaks the same API (a small open model, for the canary).

import { postJson } from './http.ts';
import { list, num, record, str } from './json.ts';
import { BASE_URL_ENV, DEFAULT_BASE_URL, type GenerateRequest, type Generation, type ModelSpec, type Provider, type ResolvedDeps } from './types.ts';

export function openaiProvider(spec: ModelSpec, key: string, deps: ResolvedDeps): Provider {
  const base = (deps.env[BASE_URL_ENV.openai] ?? DEFAULT_BASE_URL.openai).replace(/\/+$/, '');
  return {
    spec,
    async generate(request) {
      const started = performance.now();
      const { json, attempts } = await postJson({
        provider: 'openai',
        url: `${base}/responses`,
        headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
        body: openaiBody(spec.model, request),
        secrets: [key],
        fetch: deps.fetch,
        sleep: deps.sleep,
        retries: deps.retries,
        timeoutMs: deps.timeoutMs,
        onRetry: deps.onRetry,
      });
      return { ...parseOpenAI(json), latencyMs: Math.round(performance.now() - started), attempts };
    },
  };
}

export function openaiBody(model: string, { system, user, maxTokens }: GenerateRequest): Record<string, unknown> {
  // max_output_tokens includes reasoning tokens; `store: false` keeps eval traffic out of the account's logs.
  return { model, instructions: system, input: user, max_output_tokens: maxTokens, store: false };
}

export function parseOpenAI(json: unknown): Pick<Generation, 'text' | 'usage' | 'stopReason'> {
  const body = record(json) ?? {};
  const parts: string[] = [];
  for (const item of list(body.output).map(record)) {
    if (str(item?.type) !== 'message') continue;
    for (const content of list(item?.content).map(record)) {
      if (str(content?.type) === 'output_text') parts.push(str(content?.text) ?? '');
    }
  }
  const usage = record(body.usage) ?? {};
  const status = str(body.status) ?? null;
  const reason = str(record(body.incomplete_details)?.reason);
  return {
    // Some compatible servers only fill the SDK-style `output_text`.
    text: parts.length > 0 ? parts.join('') : (str(body.output_text) ?? ''),
    usage: {
      inputTokens: num(usage.input_tokens),
      outputTokens: num(usage.output_tokens),
      reasoningTokens: num(record(usage.output_tokens_details)?.reasoning_tokens),
      cachedInputTokens: num(record(usage.input_tokens_details)?.cached_tokens),
    },
    stopReason: status === 'incomplete' && reason !== undefined ? `incomplete:${reason}` : status,
  };
}
