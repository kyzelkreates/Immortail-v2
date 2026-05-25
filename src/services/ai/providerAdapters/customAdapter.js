// ================================================================
// IMMORTAIL™ Gen2 — CUSTOM ENDPOINT ADAPTER
// Generic OpenAI-compatible endpoint. Used for any unknown provider.
// ================================================================

export const ADAPTER_ID = 'custom';

export function buildHeaders(apiKey, authType = 'bearer') {
  const h = { 'Content-Type': 'application/json' };
  if (authType === 'bearer' && apiKey) h.Authorization = `Bearer ${apiKey}`;
  if (authType === 'x-api-key' && apiKey) h['x-api-key'] = apiKey;
  return h;
}

export function parseResponse(json) {
  // Try OpenAI format, then Anthropic, then Ollama
  return (
    json?.choices?.[0]?.message?.content ??
    json?.content?.[0]?.text ??
    json?.message?.content ??
    json?.response ??
    ''
  );
}

export async function ping(baseUrl, apiKey, authType = 'bearer') {
  const url = baseUrl.replace(/\/$/, '') + '/models';
  const t0  = Date.now();
  const r   = await fetch(url, {
    headers: buildHeaders(apiKey, authType),
    signal:  AbortSignal.timeout(8000),
  });
  // Some custom endpoints don't have /models — 404 is still "reachable"
  if (r.status >= 500) throw new Error(`HTTP ${r.status}`);
  return { latencyMs: Date.now() - t0 };
}

export async function fetchModels(baseUrl, apiKey, authType = 'bearer') {
  const url = baseUrl.replace(/\/$/, '') + '/models';
  const r   = await fetch(url, {
    headers: buildHeaders(apiKey, authType),
    signal:  AbortSignal.timeout(5000),
  });
  if (!r.ok) return [];
  const json = await r.json().catch(() => ({}));
  return (json?.data ?? []).map(m => m.id).filter(Boolean);
}

export async function chat(baseUrl, apiKey, model, messages, options = {}, authType = 'bearer') {
  const url = baseUrl.replace(/\/$/, '') + '/chat/completions';
  const t0  = Date.now();
  const r   = await fetch(url, {
    method:  'POST',
    headers: buildHeaders(apiKey, authType),
    body:    JSON.stringify({ model, messages, stream: false }),
    signal:  AbortSignal.timeout(options.timeout ?? 45000),
  });
  if (!r.ok) {
    const text = await r.text().catch(() => '');
    throw new Error(`HTTP ${r.status}: ${text.slice(0, 200)}`);
  }
  const json    = await r.json();
  const content = parseResponse(json);
  return { content, latencyMs: Date.now() - t0, model, provider: ADAPTER_ID };
}
