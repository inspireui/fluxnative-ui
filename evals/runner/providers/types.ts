// The provider contract: one system + user prompt in, one text reply out,
// with whatever usage numbers the API returns. Adapters call the vendor's
// HTTP API with `fetch`; there is no SDK dependency.

export const PROVIDERS = ['anthropic', 'openai', 'google'] as const;
export type ProviderName = (typeof PROVIDERS)[number];

/** `--model anthropic:<id>`. `fixture` is the dry run's stand-in provider. */
export interface ModelSpec {
  provider: ProviderName | 'fixture';
  model: string;
}

export interface Usage {
  inputTokens?: number;
  /** Billed output, reasoning included. */
  outputTokens?: number;
  reasoningTokens?: number;
  cachedInputTokens?: number;
}

export interface GenerateRequest {
  system: string;
  user: string;
  maxTokens: number;
}

export interface Generation {
  text: string;
  usage: Usage;
  /** The API's own word for why it stopped (`end_turn`, `incomplete:max_output_tokens`, `MAX_TOKENS`). */
  stopReason: string | null;
  latencyMs: number;
  /** HTTP attempts, retries included. */
  attempts: number;
}

export interface Provider {
  readonly spec: ModelSpec;
  generate(request: GenerateRequest): Promise<Generation>;
}

export type Fetch = (url: string, init: RequestInit) => Promise<Response>;

export interface ProviderDeps {
  fetch?: Fetch;
  env?: Record<string, string | undefined>;
  sleep?: (ms: number) => Promise<void>;
  /** Retries after the first attempt, on 408/429/5xx and network errors. Default 4. */
  retries?: number;
  /** Per attempt. Default 10 minutes (reasoning models are slow). */
  timeoutMs?: number;
  onRetry?: (message: string) => void;
}

export interface ResolvedDeps {
  fetch: Fetch;
  env: Record<string, string | undefined>;
  sleep: (ms: number) => Promise<void>;
  retries: number;
  timeoutMs: number;
  onRetry: (message: string) => void;
}

export const KEY_ENV: Record<ProviderName, string> = {
  anthropic: 'ANTHROPIC_API_KEY',
  openai: 'OPENAI_API_KEY',
  google: 'GEMINI_API_KEY',
};

/** Optional overrides, e.g. an OpenAI-compatible server for a small open model. */
export const BASE_URL_ENV: Record<ProviderName, string> = {
  anthropic: 'ANTHROPIC_BASE_URL',
  openai: 'OPENAI_BASE_URL',
  google: 'GEMINI_BASE_URL',
};

export const DEFAULT_BASE_URL: Record<ProviderName, string> = {
  anthropic: 'https://api.anthropic.com',
  openai: 'https://api.openai.com/v1',
  google: 'https://generativelanguage.googleapis.com/v1beta',
};

export function modelLabel(spec: ModelSpec): string {
  return `${spec.provider}:${spec.model}`;
}
