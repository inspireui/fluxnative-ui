// Google Gemini API: POST /v1beta/models/<model>:generateContent. The key
// goes in the `x-goog-api-key` header, never in the URL.

import { postJson } from './http.ts';
import { list, num, record, str, sum } from './json.ts';
import { BASE_URL_ENV, DEFAULT_BASE_URL, type GenerateRequest, type Generation, type ModelSpec, type Provider, type ResolvedDeps } from './types.ts';

export function googleProvider(spec: ModelSpec, key: string, deps: ResolvedDeps): Provider {
  const base = (deps.env[BASE_URL_ENV.google] ?? DEFAULT_BASE_URL.google).replace(/\/+$/, '');
  const model = encodeURIComponent(spec.model.replace(/^models\//, ''));
  return {
    spec,
    async generate(request) {
      const started = performance.now();
      const { json, attempts } = await postJson({
        provider: 'google',
        url: `${base}/models/${model}:generateContent`,
        headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
        body: geminiBody(request),
        secrets: [key],
        fetch: deps.fetch,
        sleep: deps.sleep,
        retries: deps.retries,
        timeoutMs: deps.timeoutMs,
        onRetry: deps.onRetry,
      });
      return { ...parseGemini(json), latencyMs: Math.round(performance.now() - started), attempts };
    },
  };
}

export function geminiBody({ system, user, maxTokens }: GenerateRequest): Record<string, unknown> {
  return {
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: 'user', parts: [{ text: user }] }],
    // Includes thinking tokens on thinking models.
    generationConfig: { maxOutputTokens: maxTokens },
  };
}

export function parseGemini(json: unknown): Pick<Generation, 'text' | 'usage' | 'stopReason'> {
  const body = record(json) ?? {};
  const candidate = record(list(body.candidates)[0]);
  const text = list(record(candidate?.content)?.parts)
    .map(record)
    .filter((part) => part?.thought !== true)
    .map((part) => str(part?.text) ?? '')
    .join('');
  const usage = record(body.usageMetadata) ?? {};
  const thoughts = num(usage.thoughtsTokenCount);
  const blocked = str(record(body.promptFeedback)?.blockReason);
  return {
    text,
    usage: {
      inputTokens: num(usage.promptTokenCount),
      outputTokens: sum(num(usage.candidatesTokenCount), thoughts),
      reasoningTokens: thoughts,
      cachedInputTokens: num(usage.cachedContentTokenCount),
    },
    stopReason: str(candidate?.finishReason) ?? (blocked !== undefined ? `blocked:${blocked}` : null),
  };
}
