// ================================================================
// IMMORTAIL™ Gen2 — ANTHROPIC CLAUDE ADAPTER
// Uses Anthropic Messages API (not OpenAI-compatible format).
// ================================================================

export const ADAPTER_ID = 'claude';
const BASE     = 'https://api.anthropic.com/v1';
const API_VER  = '2023-06-01';

export function buildHeaders(apiKey) {
  return {
    'Content-Type':      'application/json',
    'x-api-key':         apiKey,
    'anthropic-version': API_VER,
  };
}

export function parseResponse(json) {
  return json?.content?.[0]?.text ?? '';
}

/** Claude uses a different message format — system is separate */
function toClaudeMessages(messages) {
  const system  = messages.filter(m => m.role === 'system').map(m => m.content).join('\n');
  const history = messages.filter(m => m.role !== 'system');
  return { system: system || undefined, messages: history };
}

export async function ping(baseUrl, apiKey) {
  // Anthropic has no /models endpoint on basic keys — do a minimal chat call
  const url = (baseUrl || BASE).replace(/\/$/, '') + '/messages';
  const t0  = Date.now();
  const { system, messages } = toClaudeMessages([{ role: 'user', content: 'ping' }]);
  const body = { model: 'claude-3-haiku-20240307', max_tokens: 1, messages };
  if (system) body.system = system;
  const r = await fetch(url, {
    method:  'POST',
    headers: buildHeaders(apiKey),
    body:    JSON.stringify(body),
    signal:  AbortSignal.timeout(10000),
  });
  if (!r.ok) {
    const j = await r.json().catch(() => ({}));
    throw new Error(`Claude HTTP ${r.status}: ${j?.error?.message ?? ''}`);
  }
  return { latencyMs: Date.now() - t0 };
}

export function fetchModels() {
  // Anthropic doesn't expose a public /models list — return static list
  return Promise.resolve([
    'claude-3-5-haiku-20241022',
    'claude-3-5-sonnet-20241022',
    'claude-3-opus-20240229',
    'claude-3-sonnet-20240229',
    'claude-3-haiku-20240307',
  ]);
}

export async function chat(baseUrl, apiKey, model, messages, options = {}) {
  const url = (baseUrl || BASE).replace(/\/$/, '') + '/messages';
  const t0  = Date.now();
  const { system, messages: msgs } = toClaudeMessages(messages);
  const body = { model, max_tokens: options.maxTokens ?? 1024, messages: msgs };
  if (system) body.system = system;
  const r = await fetch(url, {
    method:  'POST',
    headers: buildHeaders(apiKey),
    body:    JSON.stringify(body),
    signal:  AbortSignal.timeout(options.timeout ?? 45000),
  });
  if (!r.ok) {
    const j = await r.json().catch(() => ({}));
    throw new Error(`Claude HTTP ${r.status}: ${j?.error?.message ?? ''}`);
  }
  const json    = await r.json();
  const content = parseResponse(json);
  return { content, latencyMs: Date.now() - t0, model, provider: ADAPTER_ID };
}
