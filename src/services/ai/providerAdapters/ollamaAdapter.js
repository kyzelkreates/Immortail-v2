// ================================================================
// IMMORTAIL™ Gen2 — OLLAMA ADAPTER
// Primary persistent brain. Offline-safe. Never bypassed.
// ================================================================

export const ADAPTER_ID = 'ollama';

export function buildHeaders(_apiKey) {
  return { 'Content-Type': 'application/json' };
}

export function buildChatBody(messages, model, stream = false) {
  return JSON.stringify({ model, messages, stream });
}

export function parseResponse(json) {
  // Non-streaming: { message: { content } }
  return json?.message?.content ?? json?.choices?.[0]?.message?.content ?? '';
}

export function parseDelta(chunk) {
  // Streaming chunk line from /api/chat
  try {
    const obj = typeof chunk === 'string' ? JSON.parse(chunk) : chunk;
    return obj?.message?.content ?? '';
  } catch { return ''; }
}

export async function fetchModels(baseUrl) {
  const url = baseUrl.replace(/\/$/, '') + '/api/tags';
  const r   = await fetch(url, { signal: AbortSignal.timeout(5000) });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const json = await r.json();
  return (json?.models ?? []).map(m => m.name ?? m.model ?? m);
}

export async function ping(baseUrl) {
  const url = baseUrl.replace(/\/$/, '') + '/api/tags';
  const t0  = Date.now();
  const r   = await fetch(url, { signal: AbortSignal.timeout(6000) });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return { latencyMs: Date.now() - t0 };
}

export async function chat(baseUrl, apiKey, model, messages, options = {}) {
  const url     = baseUrl.replace(/\/$/, '') + '/api/chat';
  const body    = buildChatBody(messages, model, false);
  const headers = buildHeaders(apiKey);
  const t0      = Date.now();
  const r = await fetch(url, {
    method:  'POST',
    headers,
    body,
    signal:  AbortSignal.timeout(options.timeout ?? 60000),
  });
  if (!r.ok) {
    const text = await r.text().catch(() => '');
    throw new Error(`Ollama HTTP ${r.status}: ${text.slice(0, 200)}`);
  }
  const json    = await r.json();
  const content = parseResponse(json);
  return { content, latencyMs: Date.now() - t0, model, provider: ADAPTER_ID };
}
