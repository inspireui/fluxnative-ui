// The host bridge, when there is one. FluxBuilder's WebView exposes
// `globalThis.flux`; FluxNative provides `storage.get/set` and `ui.toast`;
// the dashboard preview has none. Always optional-chain.

/**
 * Why an AI call failed. `quota`: out of credits or messages for now;
 * `rate_limited`: too many calls, wait `retryAfterMs`; `blocked`: the host's
 * safety filter refused; `offline`: no connection; `unavailable`: no AI here.
 */
export type AiError = 'rate_limited' | 'quota' | 'blocked' | 'offline' | 'unavailable';

/** What every AI call resolves to. A known failure is a value, not a rejection. */
export type AiResult<T> = { ok: true; value: T } | { ok: false; error: AiError; retryAfterMs?: number };

export type AiMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
  attachments?: { uri: string; kind: 'image' | 'audio' }[];
};

/**
 * The host's AI, for a template that declares the `ai` capability. The host
 * picks the model and holds the keys; a template only says what a call is
 * for (`purpose`). `onDelta` receives each new piece of a reply as it arrives.
 */
export interface FluxAi {
  chat(
    input: { messages: AiMessage[]; purpose?: string },
    opts?: { onDelta?: (text: string) => void; signal?: AbortSignal },
  ): Promise<AiResult<{ text: string }>>;
  generateImage(
    prompt: string,
    opts?: { count?: number; aspect?: '1:1' | '3:4' | '9:16'; onProgress?: (p: number) => void; signal?: AbortSignal },
  ): Promise<AiResult<{ uris: string[] }>>;
  transcribe(audio: { uri: string }, opts?: { signal?: AbortSignal }): Promise<AiResult<{ text: string }>>;
  describeImage(image: { uri: string }, question?: string, opts?: { signal?: AbortSignal }): Promise<AiResult<{ text: string }>>;
  quota(): Promise<{ remaining: number | null; resetsAt?: string }>;
}

export interface FluxBridge {
  ui?: {
    haptic?: (kind: 'light' | 'selection' | 'medium') => void;
    toast?: (message: string) => void;
  };
  storage?: {
    get?: (key: string) => Promise<string | null> | string | null;
    set?: (key: string, value: string) => Promise<void> | void;
  };
  /** The host's AI, present when the host has the `ai` capability. Read it through `ai()`. */
  ai?: FluxAi;
}

export function bridge(): FluxBridge | null {
  const host = globalThis as { flux?: FluxBridge };
  return host.flux ?? null;
}

/** The host's AI, or null when the host has none: `ai()?.quota()`. */
export function ai(): FluxAi | null {
  return bridge()?.ai ?? null;
}

let reduceMotion = false;

/** Snapshot of the reduce-motion setting; `watchReduceMotion` keeps it fresh. */
export function prefersReducedMotion(): boolean {
  return reduceMotion;
}

export function setReducedMotion(value: boolean): void {
  reduceMotion = value;
}
