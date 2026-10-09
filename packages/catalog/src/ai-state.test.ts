// The AI pack's state machines and controllers (components/aiState.ts),
// driven against a fake host: what useAiChat and useAiTask do underneath.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import type { AiMessage, AiResult, FluxAi } from '../files/components/bridge.ts';
import {
  aiChatReducer,
  aiChatRequest,
  aiErrorStatus,
  aiTaskReducer,
  createAiChatController,
  createAiTaskController,
  initialAiChatState,
  initialAiTaskState,
} from '../files/components/aiState.ts';
import { FILES_DIR, componentDeps } from './emit.ts';

const flush = () => new Promise<void>((resolve) => setImmediate(resolve));

// ---------------------------------------------------------------- chat reducer

const sent = (text = 'Plan a weekend in Kyoto', state = initialAiChatState()) => aiChatReducer(state, { type: 'send', text, available: true });

test('send adds the user turn and an empty reply that streams; blank or mid-stream sends change nothing', () => {
  const state = sent('  Plan a weekend in Kyoto  ');
  assert.equal(state.status, 'streaming');
  assert.deepEqual(
    state.messages.map(({ role, text }) => [role, text]),
    [
      ['user', 'Plan a weekend in Kyoto'],
      ['assistant', ''],
    ],
  );
  assert.equal(state.streamingId, state.messages[1]?.id);
  assert.notEqual(state.messages[0]?.id, state.messages[1]?.id);
  assert.equal(aiChatReducer(state, { type: 'send', text: 'again', available: true }), state, 'one reply at a time');
  const idle = initialAiChatState();
  assert.equal(aiChatReducer(idle, { type: 'send', text: '   ', available: true }), idle);
});

test('deltas grow only the streaming reply of the current request; other messages keep their identity', () => {
  const start = sent();
  const request = start.request ?? -1;
  const one = aiChatReducer(start, { type: 'delta', request, text: 'Day 1: ' });
  const two = aiChatReducer(one, { type: 'delta', request, text: 'Fushimi Inari' });
  assert.equal(two.messages[1]?.text, 'Day 1: Fushimi Inari');
  assert.equal(two.messages[0], start.messages[0], 'the user message object is reused');
  assert.equal(aiChatReducer(two, { type: 'delta', request: request + 1, text: 'stale' }), two);
  assert.equal(aiChatReducer(two, { type: 'delta', request, text: '' }), two);
});

test('done keeps the final text, or what streamed when the result is empty; an empty reply is dropped', () => {
  const start = sent();
  const request = start.request ?? -1;
  const streamed = aiChatReducer(start, { type: 'delta', request, text: 'partial' });
  const done = aiChatReducer(streamed, { type: 'done', request, text: 'The whole reply.' });
  assert.equal(done.status, 'idle');
  assert.equal(done.streamingId, null);
  assert.equal(done.messages[1]?.text, 'The whole reply.');
  assert.equal(aiChatReducer(streamed, { type: 'done', request, text: '' }).messages[1]?.text, 'partial');
  assert.equal(aiChatReducer(start, { type: 'done', request, text: '' }).messages.length, 1);
  assert.equal(aiChatReducer(done, { type: 'done', request, text: 'late' }), done, 'a settled request is over');
});

test('a failure maps to quota, unavailable or error, keeps partial text and drops an empty reply', () => {
  const start = sent();
  const request = start.request ?? -1;
  const quota = aiChatReducer(start, { type: 'fail', request, error: 'quota' });
  assert.equal(quota.status, 'quota');
  assert.equal(quota.error, 'quota');
  assert.equal(quota.messages.length, 1, 'no empty bubble under the user turn');
  assert.equal(aiChatReducer(start, { type: 'fail', request, error: 'unavailable' }).status, 'unavailable');
  for (const error of ['offline', 'blocked', 'rate_limited'] as const) assert.equal(aiChatReducer(start, { type: 'fail', request, error }).status, 'error', error);
  const limited = aiChatReducer(start, { type: 'fail', request, error: 'rate_limited', retryAfterMs: 3000 });
  assert.equal(limited.retryAfterMs, 3000);
  const partial = aiChatReducer(aiChatReducer(start, { type: 'delta', request, text: 'Half a' }), { type: 'fail', request, error: 'offline' });
  assert.equal(partial.messages[1]?.text, 'Half a');
  assert.deepEqual(
    (['rate_limited', 'quota', 'blocked', 'offline', 'unavailable'] as const).map(aiErrorStatus),
    ['error', 'quota', 'error', 'error', 'unavailable'],
  );
});

test('stop keeps what arrived, drops an empty reply, and ignores the call from then on', () => {
  const start = sent();
  const request = start.request ?? -1;
  const streamed = aiChatReducer(start, { type: 'delta', request, text: 'Day 1' });
  const stopped = aiChatReducer(streamed, { type: 'stop' });
  assert.equal(stopped.status, 'idle');
  assert.equal(stopped.error, null);
  assert.equal(stopped.messages[1]?.text, 'Day 1');
  assert.equal(aiChatReducer(stopped, { type: 'delta', request, text: ' more' }), stopped);
  assert.equal(aiChatReducer(stopped, { type: 'done', request, text: 'Day 1 and 2' }), stopped);
  assert.equal(aiChatReducer(start, { type: 'stop' }).messages.length, 1);
  assert.equal(aiChatReducer(stopped, { type: 'stop' }), stopped);
});

test('retry asks again for the last user turn, replacing the reply after it', () => {
  const start = sent();
  const done = aiChatReducer(start, { type: 'done', request: start.request ?? -1, text: 'First answer' });
  const again = aiChatReducer(done, { type: 'retry', available: true });
  assert.equal(again.status, 'streaming');
  assert.deepEqual(
    again.messages.map((m) => m.text),
    ['Plan a weekend in Kyoto', ''],
  );
  assert.notEqual(again.streamingId, done.messages[1]?.id, 'the new reply has a new id');
  assert.notEqual(again.request, start.request);
  assert.equal(aiChatReducer(again, { type: 'retry', available: true }), again, 'not while streaming');
  const empty = initialAiChatState();
  assert.equal(aiChatReducer(empty, { type: 'retry', available: true }), empty, 'nothing to retry');
  const offline = aiChatReducer(done, { type: 'retry', available: false });
  assert.equal(offline.status, 'unavailable');
  assert.deepEqual(offline.messages, done.messages, 'the old reply stays when no AI can answer');
});

test('without AI the user turn is kept and the status is unavailable; reset empties and ids keep counting', () => {
  assert.equal(initialAiChatState({ available: false }).status, 'unavailable');
  const lone = aiChatReducer(initialAiChatState({ available: false }), { type: 'send', text: 'Hello', available: false });
  assert.equal(lone.status, 'unavailable');
  assert.equal(lone.error, 'unavailable');
  assert.deepEqual(
    lone.messages.map((m) => m.role),
    ['user'],
  );
  const used = aiChatReducer(sent(), { type: 'stop' });
  const fresh = aiChatReducer(used, { type: 'reset', available: true });
  assert.deepEqual(fresh.messages, []);
  assert.equal(fresh.status, 'idle');
  const next = sent('Next', fresh);
  const before = new Set(used.messages.map((m) => m.id));
  for (const message of next.messages) assert.ok(!before.has(message.id), `${message.id} is not reused`);
});

test('aiChatRequest sends the system prompt first and never the reply being written', () => {
  const history = initialAiChatState({ messages: [{ id: 'm1', role: 'assistant', text: 'Hi, I am Nova.' }] });
  const state = sent('Plan a weekend', history);
  assert.deepEqual(aiChatRequest(state, 'You plan trips.'), [
    { role: 'system', content: 'You plan trips.' },
    { role: 'assistant', content: 'Hi, I am Nova.' },
    { role: 'user', content: 'Plan a weekend' },
  ]);
  assert.equal(aiChatRequest(state, '  ').length, 2);
});

// ---------------------------------------------------------------- task reducer

test('the task reducer runs, reports clamped progress, keeps the last result and drops stale runs', () => {
  const idle = initialAiTaskState<{ uris: string[] }>();
  const running = aiTaskReducer(idle, { type: 'start', available: true });
  assert.equal(running.status, 'running');
  const run = running.run;
  assert.equal(aiTaskReducer(running, { type: 'progress', run, value: 0.5 }).progress, 0.5);
  assert.equal(aiTaskReducer(running, { type: 'progress', run, value: 7 }).progress, 1);
  assert.equal(aiTaskReducer(running, { type: 'progress', run, value: Number.NaN }), running);
  assert.equal(aiTaskReducer(running, { type: 'progress', run: run + 1, value: 0.5 }), running);
  const done = aiTaskReducer(running, { type: 'done', run, value: { uris: ['a'] } });
  assert.equal(done.status, 'done');
  assert.equal(done.progress, null);
  assert.deepEqual(done.result, { uris: ['a'] });

  const again = aiTaskReducer(done, { type: 'start', available: true });
  assert.deepEqual(again.result, { uris: ['a'] }, 'the last result stays while a new run goes');
  assert.equal(aiTaskReducer(again, { type: 'done', run, value: { uris: ['old'] } }), again, 'a stale run is dropped');
  const cancelled = aiTaskReducer(again, { type: 'cancel' });
  assert.equal(cancelled.status, 'done', 'cancel goes back to the last result');
  assert.equal(aiTaskReducer(aiTaskReducer(idle, { type: 'start', available: true }), { type: 'cancel' }).status, 'idle');

  const failed = aiTaskReducer(again, { type: 'fail', run: again.run, error: 'quota' });
  assert.equal(failed.status, 'quota');
  assert.deepEqual(failed.result, { uris: ['a'] });
  assert.equal(aiTaskReducer(again, { type: 'fail', run: again.run, error: 'blocked', retryAfterMs: 10 }).status, 'error');
  assert.equal(aiTaskReducer(idle, { type: 'start', available: false }).status, 'unavailable');
  const reset = aiTaskReducer(failed, { type: 'reset', available: true });
  assert.equal(reset.status, 'idle');
  assert.equal(reset.result, null);
  assert.equal(initialAiTaskState(false).status, 'unavailable');
});

// ---------------------------------------------------------------- controllers

interface ChatCall {
  input: { messages: AiMessage[]; purpose?: string };
  onDelta?: (text: string) => void;
  signal?: AbortSignal;
  resolve: (result: unknown) => void;
  reject: (error: unknown) => void;
}

interface TaskCall {
  args: unknown[];
  signal: AbortSignal | undefined;
  onProgress: (progress: number) => void;
  resolve(result: unknown): void;
}

/** A host whose calls stay pending until the test settles them. */
function fakeAi(overrides: Partial<Record<keyof FluxAi, unknown>> = {}) {
  const chats: ChatCall[] = [];
  const pending = () => new Promise<never>(() => undefined);
  const host = {
    chat: (input: ChatCall['input'], opts?: { onDelta?: (text: string) => void; signal?: AbortSignal }) =>
      new Promise((resolve, reject) => {
        chats.push({ input, onDelta: opts?.onDelta, signal: opts?.signal, resolve, reject });
      }),
    generateImage: pending,
    transcribe: pending,
    describeImage: pending,
    quota: async () => ({ remaining: null }),
    ...overrides,
  };
  return { ai: host as unknown as FluxAi, chats };
}

function watch<S>(controller: { subscribe: (listener: () => void) => () => void; getState: () => S }): S[] {
  const seen: S[] = [];
  controller.subscribe(() => seen.push(controller.getState()));
  return seen;
}

test('the chat controller streams a reply through the host, with purpose, system prompt and a signal', async () => {
  const { ai, chats } = fakeAi();
  const chat = createAiChatController({ host: () => ai, purpose: () => 'trip-planner', system: () => 'You plan trips.' });
  const seen = watch(chat);
  assert.equal(chat.send('Plan a weekend'), true);
  assert.equal(chat.send('Twice'), false, 'one reply at a time');
  const call = chats[0];
  assert.ok(call);
  assert.equal(call.input.purpose, 'trip-planner');
  assert.deepEqual(call.input.messages, [
    { role: 'system', content: 'You plan trips.' },
    { role: 'user', content: 'Plan a weekend' },
  ]);
  assert.ok(call.signal && !call.signal.aborted);
  call.onDelta?.('Day 1: ');
  call.onDelta?.('Kyoto');
  assert.equal(chat.getState().messages[1]?.text, 'Day 1: Kyoto');
  call.resolve({ ok: true, value: { text: 'Day 1: Kyoto.' } });
  await flush();
  const state = chat.getState();
  assert.equal(state.status, 'idle');
  assert.equal(state.messages[1]?.text, 'Day 1: Kyoto.');
  assert.ok(seen.length >= 4, 'subscribers hear every change');
  assert.equal(seen.at(-1), state);
});

test('stop aborts the call, keeps the partial reply and ignores what the host sends afterwards', async () => {
  const { ai, chats } = fakeAi();
  const chat = createAiChatController({ host: () => ai });
  chat.send('Plan a weekend');
  const call = chats[0];
  assert.ok(call);
  call.onDelta?.('Day 1');
  chat.stop();
  assert.equal(call.signal?.aborted, true);
  const stopped = chat.getState();
  assert.equal(stopped.status, 'idle');
  assert.equal(stopped.messages[1]?.text, 'Day 1');
  call.onDelta?.(' and more');
  call.resolve({ ok: true, value: { text: 'Day 1 and more' } });
  await flush();
  assert.equal(chat.getState(), stopped);
  // A stopped reply can be asked for again.
  chat.retry();
  assert.equal(chats.length, 2);
  assert.equal(chat.getState().status, 'streaming');
  assert.deepEqual(
    chats[1]?.input.messages.map((m) => m.content),
    ['Plan a weekend'],
  );
});

test('without the ai capability the chat reports unavailable and never throws', async () => {
  for (const host of [null, { quota: async () => ({ remaining: null }) } as unknown as FluxAi]) {
    const chat = createAiChatController({ host: () => host });
    assert.equal(chat.getState().status, 'unavailable');
    assert.equal(chat.send('Hello'), true);
    assert.equal(chat.getState().status, 'unavailable');
    assert.equal(chat.getState().messages[0]?.text, 'Hello');
    chat.retry();
    chat.stop();
    chat.reset();
    assert.equal(chat.getState().messages.length, 0);
  }
  // A host that appears later is used on the next send.
  let late: FluxAi | null = null;
  const { ai, chats } = fakeAi();
  const chat = createAiChatController({ host: () => late });
  late = ai;
  chat.send('Now?');
  assert.equal(chat.getState().status, 'streaming');
  assert.equal(chats.length, 1);
});

test('a host that throws, rejects or answers garbage leaves the chat unavailable; typed errors pass through', async () => {
  const cases: [string, Partial<Record<keyof FluxAi, unknown>>, string, number | null][] = [
    [
      'throws',
      {
        chat: () => {
          throw new Error('boom');
        },
      },
      'unavailable',
      null,
    ],
    ['rejects', { chat: () => Promise.reject(new Error('network')) }, 'unavailable', null],
    ['garbage', { chat: async () => 'nope' }, 'unavailable', null],
    ['unknown error', { chat: async () => ({ ok: false, error: 'teapot' }) }, 'unavailable', null],
    ['rate limited', { chat: async () => ({ ok: false, error: 'rate_limited', retryAfterMs: 1500 }) }, 'error', 1500],
    ['quota', { chat: async () => ({ ok: false, error: 'quota', retryAfterMs: -1 }) }, 'quota', null],
  ];
  for (const [name, overrides, status, wait] of cases) {
    const { ai } = fakeAi(overrides);
    const chat = createAiChatController({ host: () => ai });
    assert.doesNotThrow(() => chat.send('Hello'), name);
    await flush();
    const state = chat.getState();
    assert.equal(state.status, status, name);
    assert.equal(state.retryAfterMs, wait, name);
    assert.equal(state.messages.length, 1, `${name}: the user turn stays, no empty reply`);
  }
});

test('reset during a reply aborts it and empties the conversation', async () => {
  const { ai, chats } = fakeAi();
  const chat = createAiChatController({ host: () => ai, messages: [{ id: 'h1', role: 'assistant', text: 'Hi' }] });
  assert.equal(chat.getState().messages.length, 1, 'starts from the history');
  chat.send('Hello');
  chat.reset();
  assert.equal(chats[0]?.signal?.aborted, true);
  chats[0]?.resolve({ ok: true, value: { text: 'late' } });
  await flush();
  assert.deepEqual(chat.getState().messages, []);
  assert.equal(chat.getState().status, 'idle');
});

test('the task controller passes arguments, a signal and onProgress, and settles with the result', async () => {
  const calls: TaskCall[] = [];
  const { ai } = fakeAi();
  const task = createAiTaskController<[string, number], { uris: string[] }>({
    host: () => ai,
    run: () => (_ai, { signal, onProgress }, prompt, count) =>
      new Promise<AiResult<{ uris: string[] }>>((resolve) => {
        calls.push({ args: [prompt, count], signal, onProgress, resolve });
      }),
  });
  assert.equal(task.getState().status, 'idle');
  task.start('A lighthouse at dusk', 4);
  const call = calls[0];
  assert.ok(call);
  assert.deepEqual(call.args, ['A lighthouse at dusk', 4]);
  call.onProgress(0.25);
  call.onProgress(0.5);
  assert.equal(task.getState().progress, 0.5);
  call.resolve({ ok: true, value: { uris: ['one', 'two'] } });
  await flush();
  assert.equal(task.getState().status, 'done');
  assert.deepEqual(task.getState().result, { uris: ['one', 'two'] });
  assert.equal(task.getState().progress, null);
});

test('cancel aborts the run; a new start aborts the one going and its late result is dropped', async () => {
  const calls: TaskCall[] = [];
  const { ai } = fakeAi();
  const task = createAiTaskController<[string], { text: string }>({
    host: () => ai,
    run: () => (_ai, { signal, onProgress }, uri) =>
      new Promise<AiResult<{ text: string }>>((resolve) => {
        calls.push({ args: [uri], signal, onProgress, resolve });
      }),
  });
  task.start('file:///first.jpg');
  task.cancel();
  assert.equal(calls[0]?.signal?.aborted, true);
  assert.equal(task.getState().status, 'idle');
  calls[0]?.resolve({ ok: true, value: { text: 'too late' } });
  await flush();
  assert.equal(task.getState().result, null);

  task.start('file:///second.jpg');
  task.start('file:///third.jpg');
  assert.equal(calls[1]?.signal?.aborted, true, 'the second run was aborted by the third');
  calls[1]?.resolve({ ok: true, value: { text: 'second' } });
  calls[2]?.resolve({ ok: true, value: { text: 'third' } });
  await flush();
  assert.deepEqual(task.getState().result, { text: 'third' });
});

test('the task reports unavailable without a host or when the host lacks the method', async () => {
  const none = createAiTaskController<[], { text: string }>({ host: () => null, run: () => (ai) => ai.transcribe({ uri: 'x' }) });
  assert.equal(none.getState().status, 'unavailable');
  assert.doesNotThrow(() => none.start());
  assert.equal(none.getState().status, 'unavailable');

  const { ai } = fakeAi({ describeImage: undefined });
  const partial = createAiTaskController<[string], { text: string }>({
    host: () => ai,
    run: () => (host, { signal }, uri) => host.describeImage({ uri }, 'What is this?', { signal }),
  });
  assert.doesNotThrow(() => partial.start('file:///photo.jpg'));
  await flush();
  assert.equal(partial.getState().status, 'unavailable');
  assert.equal(partial.getState().error, 'unavailable');
});

// ---------------------------------------------------------------- emit

test('aiState imports types only, and each hook pulls the state file and the bridge', () => {
  const deps = componentDeps();
  assert.deepEqual(deps.aiState, ['bridge']);
  assert.deepEqual(deps.useAiChat, ['aiState', 'bridge']);
  assert.deepEqual(deps.useAiTask, ['aiState', 'bridge']);
  // node --test loads it as it is: type-only imports, and no React.
  const source = readFileSync(join(FILES_DIR, 'components', 'aiState.ts'), 'utf8');
  assert.doesNotMatch(source, /^import (?!type )/m);
  assert.doesNotMatch(source, /from 'react/);
});
