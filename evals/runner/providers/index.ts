// `--model <provider>:<model-id>` → a provider adapter. Model ids are never
// hardcoded: whatever the vendor serves today is passed through as-is.

import { anthropicProvider } from './anthropic.ts';
import { googleProvider } from './google.ts';
import { defaultSleep } from './http.ts';
import { openaiProvider } from './openai.ts';
import { KEY_ENV, PROVIDERS, modelLabel, type ModelSpec, type Provider, type ProviderDeps, type ProviderName, type ResolvedDeps } from './types.ts';

export * from './types.ts';

export function parseModelSpec(raw: string, { allowFixture = false } = {}): ModelSpec {
  const colon = raw.indexOf(':');
  const provider = (colon < 0 ? raw : raw.slice(0, colon)).trim();
  const model = colon < 0 ? '' : raw.slice(colon + 1).trim();
  const known = (PROVIDERS as readonly string[]).includes(provider) || (allowFixture && provider === 'fixture');
  if (!known) throw new Error(`--model ${raw}: expected <provider>:<model-id> with provider ${PROVIDERS.join(', ')}`);
  if (model === '') throw new Error(`--model ${raw}: the model id after "${provider}:" is missing`);
  return { provider: provider as ModelSpec['provider'], model };
}

export function missingKeyMessage(provider: ProviderName, models: readonly string[]): string {
  return `${KEY_ENV[provider]} is not set (needed for ${models.join(', ')}). Export it, or run with --dry-run to grade the canned outputs in evals/fixtures/dry-run/.`;
}

/** One message per missing key, before any call is made. */
export function missingKeys(specs: readonly ModelSpec[], env: Record<string, string | undefined>): string[] {
  const byProvider = new Map<ProviderName, string[]>();
  for (const spec of specs) {
    if (spec.provider === 'fixture' || env[KEY_ENV[spec.provider]]) continue;
    byProvider.set(spec.provider, [...(byProvider.get(spec.provider) ?? []), modelLabel(spec)]);
  }
  return [...byProvider].map(([provider, models]) => missingKeyMessage(provider, models));
}

export function createProvider(spec: ModelSpec, deps: ProviderDeps = {}): Provider {
  if (spec.provider === 'fixture') throw new Error('the fixture provider only exists in --dry-run');
  const resolved: ResolvedDeps = {
    fetch: deps.fetch ?? ((url, init) => fetch(url, init)),
    env: deps.env ?? process.env,
    sleep: deps.sleep ?? defaultSleep,
    retries: deps.retries ?? 4,
    timeoutMs: deps.timeoutMs ?? 600_000,
    onRetry: deps.onRetry ?? (() => undefined),
  };
  const key = resolved.env[KEY_ENV[spec.provider]];
  if (!key) throw new Error(missingKeyMessage(spec.provider, [modelLabel(spec)]));
  switch (spec.provider) {
    case 'anthropic':
      return anthropicProvider(spec, key, resolved);
    case 'openai':
      return openaiProvider(spec, key, resolved);
    case 'google':
      return googleProvider(spec, key, resolved);
  }
}
