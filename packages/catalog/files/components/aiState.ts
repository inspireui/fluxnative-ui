// The AI pack's state, with no React in it: a chat reducer (the messages,
// a reply that grows by deltas, stop, retry), a task reducer for one-shot
// calls (`describeImage`, `generateImage`, `transcribe`), and the two
// controllers that run them against the host's `ai` with an
// AbortController. `useAiChat` and `useAiTask` are thin hooks over the
// controllers. Only type imports, so `node --test` loads this file as is.

import type { AiError, AiMessage, AiResult, FluxAi } from './bridge';

/** How a failed call shows: `quota` and `unavailable` are states of their own; the rest is an error to retry. */
export type AiFailureStatus = 'error' | 'quota' | 'unavailable';

export function aiErrorStatus(error: AiError): AiFailureStatus {
  return error === 'quota' || error === 'unavailable' ? error : 'error';
}

const AI_ERRORS: readonly string[] = ['rate_limited', 'quota', 'blocked', 'offline', 'unavailable'];

type ReadResult<T> = { ok: true; value: T } | { ok: false; error: AiError; retryAfterMs: number | null };

/** A host's answer, read defensively: anything that is not a well-formed `AiResult` counts as `unavailable`. */
function readResult<T>(result: unknown): ReadResult<T> {
  if (typeof result === 'object' && result !== null) {
    const { ok, value, error, retryAfterMs } = result as { ok?: unknown; value?: unknown; error?: unknown; retryAfterMs?: unknown };
    if (ok === true) return { ok: true, value: value as T };
    if (ok === false) {
      const wait = typeof retryAfterMs === 'number' && Number.isFinite(retryAfterMs) && retryAfterMs >= 0 ? retryAfterMs : null;
      return { ok: false, error: AI_ERRORS.includes(error as string) ? (error as AiError) : 'unavailable', retryAfterMs: wait };
    }
  }
  return { ok: false, error: 'unavailable', retryAfterMs: null };
}

function abortController(): AbortController | null {
  return typeof AbortController === 'function' ? new AbortController() : null;
}

function store<S, A>(initial: S, reducer: (state: S, action: A) => S) {
  let state = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => state,
    apply(action: A): S {
      const next = reducer(state, action);
      if (next !== state) {
        state = next;
        for (const listener of [...listeners]) listener();
      }
      return next;
    },
    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

// ---------------------------------------------------------------- chat

export type AiChatStatus = 'idle' | 'streaming' | 'error' | 'quota' | 'unavailable';

export interface AiChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
}

export interface AiChatState {
  readonly messages: AiChatMessage[];
  readonly status: AiChatStatus;
  /** The assistant message the reply streams into, while `status` is 'streaming'. */
  readonly streamingId: string | null;
  /** Why the last call failed; null after a reply, a stop or a reset. */
  readonly error: AiError | null;
  /** How long the host asks to wait (with `rate_limited`). */
  readonly retryAfterMs: number | null;
  /** The call in flight; deltas and results of any other call are dropped. */
  readonly request: number | null;
  /** Counter behind message ids and call numbers. */
  readonly seq: number;
}

export type AiChatAction =
  | { type: 'send'; text: string; available: boolean }
  | { type: 'retry'; available: boolean }
  | { type: 'delta'; request: number; text: string }
  | { type: 'done'; request: number; text: string }
  | { type: 'fail'; request: number; error: AiError; retryAfterMs?: number | null }
  | { type: 'stop' }
  | { type: 'reset'; available: boolean };

export function initialAiChatState(options: { messages?: readonly AiChatMessage[]; available?: boolean } = {}): AiChatState {
  return {
    messages: options.messages ? [...options.messages] : [],
    status: options.available === false ? 'unavailable' : 'idle',
    streamingId: null,
    error: null,
    retryAfterMs: null,
    request: null,
    seq: 0,
  };
}

const streams = (state: AiChatState, request: number) => state.status === 'streaming' && state.request === request;

/** Opens a reply after the last message, or records that there is no AI to answer. */
function begin(state: AiChatState, available: boolean): AiChatState {
  if (!available) return { ...state, status: 'unavailable', streamingId: null, request: null, error: 'unavailable', retryAfterMs: null };
  const id = `chat-${state.seq}-assistant`;
  return {
    ...state,
    messages: [...state.messages, { id, role: 'assistant', text: '' }],
    status: 'streaming',
    streamingId: id,
    request: state.seq,
    error: null,
    retryAfterMs: null,
  };
}

/** Closes the reply: it keeps `text` (or what has arrived when null); an empty reply is dropped. */
function settle(state: AiChatState, text: string | null, status: AiChatStatus, error: AiError | null, retryAfterMs: number | null): AiChatState {
  const messages: AiChatMessage[] = [];
  for (const message of state.messages) {
    if (message.id !== state.streamingId) {
      messages.push(message);
      continue;
    }
    const final = text ?? message.text;
    if (final !== '') messages.push(final === message.text ? message : { ...message, text: final });
  }
  return { ...state, messages, status, streamingId: null, request: null, error, retryAfterMs };
}

export function aiChatReducer(state: AiChatState, action: AiChatAction): AiChatState {
  switch (action.type) {
    case 'send': {
      const text = action.text.trim();
      if (state.status === 'streaming' || text === '') return state;
      const seq = state.seq + 1;
      return begin({ ...state, seq, messages: [...state.messages, { id: `chat-${seq}-user`, role: 'user', text }] }, action.available);
    }
    case 'retry': {
      if (state.status === 'streaming') return state;
      let last = state.messages.length - 1;
      while (last >= 0 && state.messages[last]?.role !== 'user') last -= 1;
      if (last < 0) return state;
      if (!action.available) return { ...state, status: 'unavailable', error: 'unavailable', retryAfterMs: null };
      // Regenerate: drop the replies after the last user turn and ask again.
      return begin({ ...state, seq: state.seq + 1, messages: state.messages.slice(0, last + 1) }, true);
    }
    case 'delta': {
      if (!streams(state, action.request) || action.text === '') return state;
      const messages = state.messages.map((message) => (message.id === state.streamingId ? { ...message, text: message.text + action.text } : message));
      return { ...state, messages };
    }
    case 'done':
      if (!streams(state, action.request)) return state;
      return settle(state, action.text === '' ? null : action.text, 'idle', null, null);
    case 'fail':
      if (!streams(state, action.request)) return state;
      return settle(state, null, aiErrorStatus(action.error), action.error, action.retryAfterMs ?? null);
    case 'stop':
      if (state.status !== 'streaming') return state;
      return settle(state, null, 'idle', null, null);
    case 'reset':
      // Ids keep counting, so a list never sees an old key again.
      return { ...initialAiChatState({ available: action.available }), seq: state.seq };
  }
}

/** The `messages` for `ai.chat`: the system prompt, then the conversation without the reply being written. */
export function aiChatRequest(state: AiChatState, system?: string): AiMessage[] {
  const out: AiMessage[] = [];
  if (system !== undefined && system.trim() !== '') out.push({ role: 'system', content: system });
  for (const message of state.messages) {
    if (message.id === state.streamingId || message.text === '') continue;
    out.push({ role: message.role, content: message.text });
  }
  return out;
}

export interface AiChatControllerOptions {
  /** The host's AI, read at every call (the bridge's `ai`). */
  host: () => FluxAi | null;
  purpose?: () => string | undefined;
  system?: () => string | undefined;
  /** The conversation so far (a restored history). */
  messages?: readonly AiChatMessage[];
}

export interface AiChatController {
  getState: () => AiChatState;
  subscribe: (listener: () => void) => () => void;
  /** Adds a user turn and streams the reply. False when nothing was added (blank text, or a reply still streaming). */
  send: (text: string) => boolean;
  /** Stops the reply in flight (its signal aborts) and keeps what has arrived. */
  stop: () => void;
  /** Asks again for the reply to the last user turn, replacing the reply after it. */
  retry: () => void;
  /** Stops and empties the conversation. */
  reset: () => void;
}

const canChat = (host: FluxAi | null): host is FluxAi => host !== null && typeof host.chat === 'function';

export function createAiChatController(options: AiChatControllerOptions): AiChatController {
  const chat = store(initialAiChatState({ messages: options.messages, available: canChat(options.host()) }), aiChatReducer);
  let inflight: AbortController | null = null;

  const abort = () => {
    const controller = inflight;
    inflight = null;
    return controller;
  };

  const call = (state: AiChatState) => {
    const request = state.request;
    if (state.status !== 'streaming' || request === null) return;
    const host = options.host();
    if (!canChat(host)) {
      chat.apply({ type: 'fail', request, error: 'unavailable' });
      return;
    }
    const controller = abortController();
    inflight = controller;
    const messages = aiChatRequest(state, options.system?.());
    const purpose = options.purpose?.();
    const onDelta = (text: string) => {
      if (typeof text === 'string') chat.apply({ type: 'delta', request, text });
    };
    let pending: Promise<unknown>;
    try {
      pending = Promise.resolve(
        host.chat(purpose === undefined ? { messages } : { messages, purpose }, controller ? { onDelta, signal: controller.signal } : { onDelta }),
      );
    } catch (error) {
      pending = Promise.reject(error);
    }
    const finish = (action: AiChatAction) => {
      if (inflight === controller) inflight = null;
      chat.apply(action);
    };
    pending.then(
      (raw) => {
        const result = readResult<{ text?: unknown } | undefined>(raw);
        if (!result.ok) finish({ type: 'fail', request, error: result.error, retryAfterMs: result.retryAfterMs });
        else finish({ type: 'done', request, text: typeof result.value?.text === 'string' ? result.value.text : '' });
      },
      () => finish({ type: 'fail', request, error: 'unavailable' }),
    );
  };

  return {
    getState: chat.get,
    subscribe: chat.subscribe,
    send(text) {
      if (typeof text !== 'string') return false;
      const before = chat.get();
      const next = chat.apply({ type: 'send', text, available: canChat(options.host()) });
      if (next === before) return false;
      call(next);
      return true;
    },
    stop() {
      const controller = abort();
      chat.apply({ type: 'stop' });
      controller?.abort();
    },
    retry() {
      const before = chat.get();
      const next = chat.apply({ type: 'retry', available: canChat(options.host()) });
      if (next !== before) call(next);
    },
    reset() {
      const controller = abort();
      chat.apply({ type: 'reset', available: canChat(options.host()) });
      controller?.abort();
    },
  };
}

// ---------------------------------------------------------------- task

export type AiTaskStatus = 'idle' | 'running' | 'done' | 'error' | 'quota' | 'unavailable';

export interface AiTaskState<T> {
  readonly status: AiTaskStatus;
  /** The last successful result. It stays while a new run goes, and after a cancel or a failure. */
  readonly result: T | null;
  /** 0–1 while running, when the host reports progress; null otherwise. */
  readonly progress: number | null;
  readonly error: AiError | null;
  readonly retryAfterMs: number | null;
  /** The run in flight (0 before the first); progress and results of any other run are dropped. */
  readonly run: number;
}

export type AiTaskAction<T> =
  | { type: 'start'; available: boolean }
  | { type: 'progress'; run: number; value: number }
  | { type: 'done'; run: number; value: T }
  | { type: 'fail'; run: number; error: AiError; retryAfterMs?: number | null }
  | { type: 'cancel' }
  | { type: 'reset'; available: boolean };

export function initialAiTaskState<T>(available = true): AiTaskState<T> {
  return { status: available ? 'idle' : 'unavailable', result: null, progress: null, error: null, retryAfterMs: null, run: 0 };
}

const runs = <T>(state: AiTaskState<T>, run: number) => state.status === 'running' && state.run === run;

export function aiTaskReducer<T>(state: AiTaskState<T>, action: AiTaskAction<T>): AiTaskState<T> {
  switch (action.type) {
    case 'start':
      if (!action.available) return { ...state, status: 'unavailable', progress: null, error: 'unavailable', retryAfterMs: null };
      return { ...state, status: 'running', progress: null, error: null, retryAfterMs: null, run: state.run + 1 };
    case 'progress': {
      if (!runs(state, action.run) || typeof action.value !== 'number' || !Number.isFinite(action.value)) return state;
      const progress = Math.min(1, Math.max(0, action.value));
      return progress === state.progress ? state : { ...state, progress };
    }
    case 'done':
      if (!runs(state, action.run)) return state;
      return { ...state, status: 'done', result: action.value, progress: null };
    case 'fail':
      if (!runs(state, action.run)) return state;
      return { ...state, status: aiErrorStatus(action.error), progress: null, error: action.error, retryAfterMs: action.retryAfterMs ?? null };
    case 'cancel':
      if (state.status !== 'running') return state;
      return { ...state, status: state.result === null ? 'idle' : 'done', progress: null };
    case 'reset':
      return { ...initialAiTaskState<T>(action.available), run: state.run };
  }
}

/** What a task's `run` receives besides its own arguments. */
export interface AiTaskContext {
  /** Pass it to the host call, so `cancel()` stops the call. */
  signal: AbortSignal | undefined;
  /** Pass it as `onProgress` (generateImage): 0–1. */
  onProgress: (progress: number) => void;
}

/** One host call: `(ai, { signal }, uri: string) => ai.describeImage({ uri }, 'What is this?', { signal })`. */
export type AiTaskRun<A extends unknown[], T> = (ai: FluxAi, task: AiTaskContext, ...args: A) => Promise<AiResult<T>>;

export interface AiTaskController<A extends unknown[], T> {
  getState: () => AiTaskState<T>;
  subscribe: (listener: () => void) => () => void;
  /** Runs the call with these arguments; a run still going is aborted first. */
  start: (...args: A) => void;
  /** Aborts the run in flight; the last result stays. */
  cancel: () => void;
  /** Aborts and forgets the result. */
  reset: () => void;
}

export function createAiTaskController<A extends unknown[], T>(options: {
  host: () => FluxAi | null;
  /** Read at every start, so a hook can pass the latest closure. */
  run: () => AiTaskRun<A, T>;
}): AiTaskController<A, T> {
  const task = store(initialAiTaskState<T>(options.host() !== null), (state: AiTaskState<T>, action: AiTaskAction<T>) => aiTaskReducer(state, action));
  let inflight: AbortController | null = null;

  const abort = () => {
    const controller = inflight;
    inflight = null;
    return controller;
  };

  return {
    getState: task.get,
    subscribe: task.subscribe,
    start(...args) {
      const previous = abort();
      const host = options.host();
      const next = task.apply({ type: 'start', available: host !== null });
      previous?.abort();
      if (next.status !== 'running' || host === null) return;
      const run = next.run;
      const controller = abortController();
      inflight = controller;
      const context: AiTaskContext = {
        signal: controller?.signal,
        onProgress: (value) => {
          task.apply({ type: 'progress', run, value });
        },
      };
      let pending: Promise<unknown>;
      try {
        pending = Promise.resolve(options.run()(host, context, ...args));
      } catch (error) {
        pending = Promise.reject(error);
      }
      const finish = (action: AiTaskAction<T>) => {
        if (inflight === controller) inflight = null;
        task.apply(action);
      };
      pending.then(
        (raw) => {
          const result = readResult<T>(raw);
          finish(result.ok ? { type: 'done', run, value: result.value } : { type: 'fail', run, error: result.error, retryAfterMs: result.retryAfterMs });
        },
        // A throw is most often a method this host lacks.
        () => finish({ type: 'fail', run, error: 'unavailable' }),
      );
    },
    cancel() {
      const controller = abort();
      task.apply({ type: 'cancel' });
      controller?.abort();
    },
    reset() {
      const controller = abort();
      task.apply({ type: 'reset', available: options.host() !== null });
      controller?.abort();
    },
  };
}
