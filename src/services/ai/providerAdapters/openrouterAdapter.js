// ================================================================
// IMMORTAIL™ Gen2 — OPENROUTER ADAPTER
// Multi-provider gateway. Free tiers. OpenAI-compatible.
// ================================================================

export const ADAPTER_ID = 'openrouter';
const BASE = 'https://openrouter.ai/api/v1';

export function buildHeaders(apiKey) {
  return {
    'Content-Type':  'application/json',
    Authorization:   `Bearer ${apiKey}`,
    'HTTP-Referer':  'https://immortail.app',
    'X-Title':       'IMMORTAIL™',
  };
}

export function parseResponse(json) {
  return json?.choices?.[0]?.message?.content ?? '';
}

export async function fetchModels(baseUrl, apiKey) {
  const url = (baseUrl || BASE).replace(/\/$/, '') + '/models';
  const r   = await fetch(url, {
    headers: buildHeaders(apiKey),
    signal:  AbortSignal.timeout(8000),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const json = await r.json();
  return (json?.data ?? []).map(m => m.id).filter(Boolean).slice(0, 50);
}

export async function ping(baseUrl, apiKey) {
  const url = (baseUrl || BASE).replace(/\/$/, '') + '/models';
  const t0  = Date.now();
  const r   = await fetch(url, {
    headers: buildHeaders(apiKey),
    signal:  AbortSignal.timeout(8000),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return { latencyMs: Date.now() - t0 };
}

export async function chat(baseUrl, apiKey, model, messages, options = {}) {
  const url = (baseUrl || BASE).replace(/\/$/, '') + '/chat/completions';
  const t0  = Date.now();
  const r   = await fetch(url, {
    method:  'POST',
    headers: buildHeaders(apiKey),
    body:    JSON.stringify({ model, messages }),
    signal:  AbortSignal.timeout(options.timeout ?? 45000),
  });
  if (!r.ok) {
    const text = await r.text().catch(() => '');
    throw new Error(`OpenRouter HTTP ${r.status}: ${text.slice(0, 200)}`);
  }
  const json    = await r.json();
  const content = parseResponse(json);
  return { content, latencyMs: Date.now() - t0, model, provider: ADAPTER_ID };
}
