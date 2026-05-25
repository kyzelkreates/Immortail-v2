// ================================================================
// IMMORTAIL™ Gen2 — OPENAI ADAPTER (OpenAI-compatible)
// Also used for: OpenRouter, LM Studio — all share this format.
// ================================================================

export const ADAPTER_ID = 'openai';

export function buildHeaders(apiKey, extra = {}) {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}`, ...extra };
}

export function parseResponse(json) {
  return json?.choices?.[0]?.message?.content ?? '';
}

export async function fetchModels(baseUrl, apiKey, extra = {}) {
  const url = baseUrl.replace(/\/$/, '') + '/models';
  const r   = await fetch(url, {
    headers: buildHeaders(apiKey, extra),
    signal:  AbortSignal.timeout(5000),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const json = await r.json();
  return (json?.data ?? []).map(m => m.id).sort();
}

export async function ping(baseUrl, apiKey, extra = {}) {
  const url = baseUrl.replace(/\/$/, '') + '/models';
  const t0  = Date.now();
  const r   = await fetch(url, {
    headers: buildHeaders(apiKey, extra),
    signal:  AbortSignal.timeout(6000),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return { latencyMs: Date.now() - t0 };
}

export async function chat(baseUrl, apiKey, model, messages, options = {}, extra = {}) {
  const url = baseUrl.replace(/\/$/, '') + '/chat/completions';
  const t0  = Date.now();
  const r   = await fetch(url, {
    method:  'POST',
    headers: buildHeaders(apiKey, extra),
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
