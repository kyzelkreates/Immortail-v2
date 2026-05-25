// ================================================================
// IMMORTAIL™ Gen2 — GOOGLE GEMINI ADAPTER
// Uses Generative Language API (not OpenAI-compatible).
// ================================================================

export const ADAPTER_ID = 'gemini';
const BASE = 'https://generativelanguage.googleapis.com/v1beta';

export function buildUrl(baseUrl, model, apiKey, path = 'generateContent') {
  const base = (baseUrl || BASE).replace(/\/$/, '');
  return `${base}/models/${model}:${path}?key=${apiKey}`;
}

export function parseResponse(json) {
  return json?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
}

function toGeminiContents(messages) {
  return messages
    .filter(m => m.role !== 'system')
    .map(m => ({
      role:  m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));
}

export async function fetchModels(baseUrl, apiKey) {
  const url = `${(baseUrl || BASE).replace(/\/$/, '')}/models?key=${apiKey}`;
  const r   = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const json = await r.json();
  return (json?.models ?? []).map(m => m.name?.replace('models/', '') ?? m.name).filter(Boolean);
}

export async function ping(baseUrl, apiKey) {
  const url = `${(baseUrl || BASE).replace(/\/$/, '')}/models?key=${apiKey}`;
  const t0  = Date.now();
  const r   = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return { latencyMs: Date.now() - t0 };
}

export async function chat(baseUrl, apiKey, model, messages, options = {}) {
  const url = buildUrl(baseUrl, model, apiKey);
  const t0  = Date.now();
  const r   = await fetch(url, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ contents: toGeminiContents(messages) }),
    signal:  AbortSignal.timeout(options.timeout ?? 45000),
  });
  if (!r.ok) {
    const j = await r.json().catch(() => ({}));
    throw new Error(`Gemini HTTP ${r.status}: ${j?.error?.message ?? ''}`);
  }
  const json    = await r.json();
  const content = parseResponse(json);
  return { content, latencyMs: Date.now() - t0, model, provider: ADAPTER_ID };
}
