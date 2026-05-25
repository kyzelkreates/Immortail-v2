// ================================================================
// IMMORTAIL™ Gen2 — GROQ ADAPTER
// Acceleration layer only. Cannot mutate identity or memory directly.
// ================================================================

export const ADAPTER_ID = 'groq';

const BASE = 'https://api.groq.com/openai/v1';

export function buildHeaders(apiKey) {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` };
}

export function parseResponse(json) {
  return json?.choices?.[0]?.message?.content ?? '';
}

export async function fetchModels(baseUrl, apiKey) {
  const url = (baseUrl || BASE).replace(/\/$/, '') + '/models';
  const r   = await fetch(url, {
    headers: buildHeaders(apiKey),
    signal:  AbortSignal.timeout(5000),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const json = await r.json();
  return (json?.data ?? []).map(m => m.id);
}

export async function ping(baseUrl, apiKey) {
  const url = (baseUrl || BASE).replace(/\/$/, '') + '/models';
  const t0  = Date.now();
  const r   = await fetch(url, {
    headers: buildHeaders(apiKey),
    signal:  AbortSignal.timeout(6000),
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
    body:    JSON.stringify({ model, messages, stream: false }),
    signal:  AbortSignal.timeout(options.timeout ?? 30000),
  });
  if (!r.ok) {
    const text = await r.text().catch(() => '');
    throw new Error(`Groq HTTP ${r.status}: ${text.slice(0, 200)}`);
  }
  const json    = await r.json();
  const content = parseResponse(json);
  return { content, latencyMs: Date.now() - t0, model, provider: ADAPTER_ID };
}
