import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { HttpError, backoffMs, redact, retryAfterMs } from './http.ts';
import { createProvider, missingKeys, parseModelSpec, type Fetch } from './index.ts';

const KEY = 'sk-test-0123456789abcdef';
const REQUEST = { system: 'SYSTEM', user: 'USER', maxTokens: 1234 };

interface Call {
  url: string;
  headers: Record<string, string>;
  body: Record<string, unknown>;
}

/** A fetch that records calls and plays back canned responses in order (no network). */
function fakeFetch(...responses: (Response | Error)[]): { fetch: Fetch; calls: Call[] } {
  const calls: Call[] = [];
  const fetch: Fetch = async (url, init) => {
    calls.push({ url, headers: init.headers as Record<string, string>, body: JSON.parse(String(init.body)) as Record<string, unknown> });
    const next = responses.shift();
    if (next === undefined) throw new Error('unexpected extra call');
    if (next instanceof Error) throw next;
    return next;
  };
  return { fetch, calls };
}

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });

const noSleep = async () => undefined;

describe('model specs and keys', () => {
  test('parseModelSpec splits at the first colon and checks the provider', () => {
    assert.deepEqual(parseModelSpec('anthropic:claude-x'), { provider: 'anthropic', model: 'claude-x' });
    assert.deepEqual(parseModelSpec('openai:ft:gpt-x:org::id'), { provider: 'openai', model: 'ft:gpt-x:org::id' });
    assert.throws(() => parseModelSpec('mistral:large'), /provider anthropic, openai, google/);
    assert.throws(() => parseModelSpec('google:'), /model id after "google:" is missing/);
    assert.throws(() => parseModelSpec('fixture:canned'), /expected <provider>:<model-id>/);
    assert.deepEqual(parseModelSpec('fixture:canned', { allowFixture: true }), { provider: 'fixture', model: 'canned' });
  });

  test('a missing key is a clear error that names the variable, before any call', () => {
    const specs = [parseModelSpec('anthropic:a'), parseModelSpec('anthropic:b'), parseModelSpec('google:g'), parseModelSpec('openai:o')];
    const messages = missingKeys(specs, { OPENAI_API_KEY: KEY });
    assert.equal(messages.length, 2);
    assert.match(messages[0] ?? '', /^ANTHROPIC_API_KEY is not set \(needed for anthropic:a, anthropic:b\)/);
    assert.match(messages[1] ?? '', /^GEMINI_API_KEY is not set \(needed for google:g\)/);
    assert.throws(() => createProvider(parseModelSpec('openai:o'), { env: {} }), /OPENAI_API_KEY is not set/);
  });
});

describe('anthropic', () => {
  test('sends a Messages API request and reads text and usage', async () => {
    const { fetch, calls } = fakeFetch(
      json({
        content: [
          { type: 'thinking', thinking: '…' },
          { type: 'text', text: 'Here:\n```tsx\n' },
          { type: 'text', text: 'export default 1;\n```' },
        ],
        stop_reason: 'end_turn',
        usage: { input_tokens: 100, cache_read_input_tokens: 900, cache_creation_input_tokens: 0, output_tokens: 50 },
      }),
    );
    const provider = createProvider(parseModelSpec('anthropic:claude-test'), { fetch, env: { ANTHROPIC_API_KEY: KEY }, sleep: noSleep });
    const out = await provider.generate(REQUEST);
    assert.equal(out.text, 'Here:\n```tsx\nexport default 1;\n```');
    assert.deepEqual(out.usage, { inputTokens: 1000, outputTokens: 50, cachedInputTokens: 900 });
    assert.equal(out.stopReason, 'end_turn');
    assert.equal(out.attempts, 1);
    const call = calls[0] as Call;
    assert.equal(call.url, 'https://api.anthropic.com/v1/messages');
    assert.equal(call.headers['x-api-key'], KEY);
    assert.equal(call.headers['anthropic-version'], '2023-06-01');
    assert.equal(call.body.model, 'claude-test');
    assert.equal(call.body.max_tokens, 1234);
    assert.deepEqual(call.body.messages, [{ role: 'user', content: 'USER' }]);
    assert.deepEqual(call.body.system, [{ type: 'text', text: 'SYSTEM', cache_control: { type: 'ephemeral' } }]);
  });
});

describe('openai', () => {
  test('sends a Responses API request and reads output_text and reasoning tokens', async () => {
    const { fetch, calls } = fakeFetch(
      json({
        status: 'incomplete',
        incomplete_details: { reason: 'max_output_tokens' },
        output: [
          { type: 'reasoning', summary: [] },
          { type: 'message', role: 'assistant', content: [{ type: 'output_text', text: 'partial' }] },
        ],
        usage: { input_tokens: 10, output_tokens: 1234, output_tokens_details: { reasoning_tokens: 1200 }, input_tokens_details: { cached_tokens: 0 } },
      }),
    );
    const provider = createProvider(parseModelSpec('openai:gpt-test'), {
      fetch,
      env: { OPENAI_API_KEY: KEY, OPENAI_BASE_URL: 'http://compat.example/v1/' },
      sleep: noSleep,
    });
    const out = await provider.generate(REQUEST);
    assert.equal(out.text, 'partial');
    assert.equal(out.stopReason, 'incomplete:max_output_tokens');
    assert.deepEqual(out.usage, { inputTokens: 10, outputTokens: 1234, reasoningTokens: 1200, cachedInputTokens: 0 });
    const call = calls[0] as Call;
    assert.equal(call.url, 'http://compat.example/v1/responses');
    assert.equal(call.headers.authorization, `Bearer ${KEY}`);
    assert.deepEqual(call.body, { model: 'gpt-test', instructions: 'SYSTEM', input: 'USER', max_output_tokens: 1234, store: false });
  });
});

describe('google', () => {
  test('sends generateContent with the key in a header and skips thought parts', async () => {
    const { fetch, calls } = fakeFetch(
      json({
        candidates: [{ content: { parts: [{ text: 'thinking…', thought: true }, { text: 'answer' }] }, finishReason: 'STOP' }],
        usageMetadata: { promptTokenCount: 20, candidatesTokenCount: 30, thoughtsTokenCount: 70 },
      }),
    );
    const provider = createProvider(parseModelSpec('google:gemini-test'), { fetch, env: { GEMINI_API_KEY: KEY }, sleep: noSleep });
    const out = await provider.generate(REQUEST);
    assert.equal(out.text, 'answer');
    assert.equal(out.stopReason, 'STOP');
    assert.deepEqual(out.usage, { inputTokens: 20, outputTokens: 100, reasoningTokens: 70, cachedInputTokens: undefined });
    const call = calls[0] as Call;
    assert.equal(call.url, 'https://generativelanguage.googleapis.com/v1beta/models/gemini-test:generateContent');
    assert.ok(!call.url.includes(KEY), 'the key never goes in the URL');
    assert.equal(call.headers['x-goog-api-key'], KEY);
    assert.deepEqual(call.body, {
      systemInstruction: { parts: [{ text: 'SYSTEM' }] },
      contents: [{ role: 'user', parts: [{ text: 'USER' }] }],
      generationConfig: { maxOutputTokens: 1234 },
    });
  });

  test('a blocked prompt is an empty reply with the block reason', async () => {
    const { fetch } = fakeFetch(json({ promptFeedback: { blockReason: 'SAFETY' } }));
    const out = await createProvider(parseModelSpec('google:g'), { fetch, env: { GEMINI_API_KEY: KEY } }).generate(REQUEST);
    assert.equal(out.text, '');
    assert.equal(out.stopReason, 'blocked:SAFETY');
  });
});

describe('retries', () => {
  const ok = () => json({ content: [{ type: 'text', text: 'ok' }], usage: {} });

  test('429 and 5xx are retried, honouring retry-after', async () => {
    const waits: number[] = [];
    const retries: string[] = [];
    const { fetch, calls } = fakeFetch(json({ error: { message: 'slow down' } }, 429, { 'retry-after': '2' }), json({}, 529), ok());
    const provider = createProvider(parseModelSpec('anthropic:a'), {
      fetch,
      env: { ANTHROPIC_API_KEY: KEY },
      sleep: async (ms) => {
        waits.push(ms);
      },
      onRetry: (message) => retries.push(message),
    });
    const out = await provider.generate(REQUEST);
    assert.equal(out.text, 'ok');
    assert.equal(out.attempts, 3);
    assert.equal(calls.length, 3);
    assert.equal(waits[0], 2000);
    assert.ok((waits[1] ?? 0) >= 1000 && (waits[1] ?? 0) <= 2000, `backoff for attempt 2: ${waits[1]}`);
    assert.match(retries[0] ?? '', /HTTP 429; retry 1\/4/);
  });

  test('network errors are retried too', async () => {
    const { fetch } = fakeFetch(new TypeError('fetch failed'), ok());
    const out = await createProvider(parseModelSpec('anthropic:a'), { fetch, env: { ANTHROPIC_API_KEY: KEY }, sleep: noSleep }).generate(REQUEST);
    assert.equal(out.attempts, 2);
  });

  test('gives up after the retries with the status', async () => {
    const { fetch, calls } = fakeFetch(json({}, 503), json({}, 503), json({}, 503));
    const provider = createProvider(parseModelSpec('openai:o'), { fetch, env: { OPENAI_API_KEY: KEY }, sleep: noSleep, retries: 2 });
    await assert.rejects(provider.generate(REQUEST), (error: unknown) => error instanceof HttpError && error.status === 503);
    assert.equal(calls.length, 3);
  });

  test('a 4xx is not retried, and an echoed key is redacted from the error', async () => {
    const { fetch, calls } = fakeFetch(json({ error: { message: `invalid x-api-key ${KEY}` } }, 401));
    const provider = createProvider(parseModelSpec('anthropic:a'), { fetch, env: { ANTHROPIC_API_KEY: KEY }, sleep: noSleep });
    await assert.rejects(provider.generate(REQUEST), (error: unknown) => {
      assert.ok(error instanceof HttpError);
      assert.equal(error.status, 401);
      assert.equal(error.message, 'anthropic: HTTP 401: invalid x-api-key [redacted]');
      assert.ok(!error.message.includes(KEY));
      return true;
    });
    assert.equal(calls.length, 1);
  });

  test('retry-after parsing and backoff bounds', () => {
    assert.equal(retryAfterMs(new Headers({ 'retry-after-ms': '250' })), 250);
    assert.equal(retryAfterMs(new Headers({ 'retry-after': '3' })), 3000);
    assert.equal(retryAfterMs(new Headers({ 'retry-after': '9999' })), 60_000);
    assert.equal(retryAfterMs(new Headers({ 'retry-after': 'soon' })), null);
    assert.equal(retryAfterMs(new Headers()), null);
    assert.equal(backoffMs(1, () => 0), 500);
    assert.equal(backoffMs(1, () => 1), 1000);
    assert.equal(backoffMs(3, () => 1), 4000);
    assert.equal(backoffMs(20, () => 1), 60_000);
    assert.equal(redact(`a ${KEY} b ${KEY}`, [KEY]), 'a [redacted] b [redacted]');
  });
});
