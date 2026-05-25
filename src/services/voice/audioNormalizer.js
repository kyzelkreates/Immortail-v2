// ================================================================
// IMMORTAIL™ Run 21 — AUDIO NORMALIZER
// Prepares audio buffers for transcription APIs.
// Converts Float32Array → PCM16 → Base64 or WAV Blob.
// ================================================================

export function float32ToPCM16(float32Array) {
  const buffer = new ArrayBuffer(float32Array.length * 2);
  const view   = new DataView(buffer);
  for (let i = 0; i < float32Array.length; i++) {
    const clamped = Math.max(-1, Math.min(1, float32Array[i]));
    view.setInt16(i * 2, clamped < 0 ? clamped * 32768 : clamped * 32767, true);
  }
  return buffer;
}

export function pcm16ToBase64(pcm16Buffer) {
  const bytes  = new Uint8Array(pcm16Buffer);
  let binary   = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

export function float32ToBase64PCM(float32Array) {
  return pcm16ToBase64(float32ToPCM16(float32Array));
}

export function buildWavBlob(float32Array, sampleRate = 16000) {
  const pcm    = float32ToPCM16(float32Array);
  const header = _wavHeader(pcm.byteLength, sampleRate, 1, 16);
  return new Blob([header, pcm], { type: 'audio/wav' });
}

export function concatenateFloat32(arrays) {
  const total  = arrays.reduce((s, a) => s + a.length, 0);
  const result = new Float32Array(total);
  let offset   = 0;
  for (const arr of arrays) { result.set(arr, offset); offset += arr.length; }
  return result;
}

export function normalizeGain(float32Array, targetRMS = 0.1) {
  const rms = Math.sqrt(float32Array.reduce((s, v) => s + v * v, 0) / float32Array.length);
  if (rms === 0) return float32Array;
  const gain = targetRMS / rms;
  return float32Array.map(v => Math.max(-1, Math.min(1, v * gain)));
}

export function trimSilence(float32Array, threshold = 0.01) {
  let start = 0, end = float32Array.length - 1;
  while (start < end && Math.abs(float32Array[start]) < threshold) start++;
  while (end > start && Math.abs(float32Array[end])   < threshold) end--;
  return float32Array.slice(start, end + 1);
}

// ── WAV header builder ─────────────────────────────────────────

function _wavHeader(dataLen, sampleRate, channels, bitDepth) {
  const buffer = new ArrayBuffer(44);
  const view   = new DataView(buffer);
  const byteRate = sampleRate * channels * (bitDepth / 8);
  const blockAlign = channels * (bitDepth / 8);
  _writeStr(view, 0, 'RIFF');
  view.setUint32(4,  36 + dataLen, true);
  _writeStr(view, 8, 'WAVE');
  _writeStr(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1,          true);
  view.setUint16(22, channels,   true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate,   true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth,   true);
  _writeStr(view, 36, 'data');
  view.setUint32(40, dataLen, true);
  return buffer;
}

function _writeStr(view, offset, str) {
  for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
}
