// ================================================================
// IMMORTAIL™ — CENTRAL THREE.JS RENDERER FOUNDATION
// WebGL lifecycle, frame loop, viewport sync, cleanup.
// DOES NOT OWN STATE. NO BUSINESS LOGIC. VISUALIZATION ONLY.
// ================================================================

import { SystemLogger } from '../utils/logger.js';

const RendererLogger = SystemLogger;

export const PERFORMANCE_TIER = {
  LOW:    'low',
  MEDIUM: 'medium',
  HIGH:   'high',
};

const DEFAULT_CONFIG = {
  antialias:            true,
  alpha:                true,
  powerPreference:      'high-performance',
  pixelRatio:           1,
  maxPixelRatio:        2,
  shadowMap:            false,
  outputColorSpace:     'srgb',
  toneMapping:          'neutral',
  toneMappingExposure:  1.0,
  clearColor:           0x000000,
  clearAlpha:           0,
};

let _renderer        = null;
let _renderLoop      = null;
let _initialized     = false;
let _running         = false;
let _canvas          = null;
let _performanceTier = PERFORMANCE_TIER.MEDIUM;
let _frameCount      = 0;
let _lastFrameTime   = 0;
let _config          = { ...DEFAULT_CONFIG };
let _contextLost     = false;

export function initializeRenderer(options = {}) {
  if (_initialized) {
    RendererLogger.warn('[Renderer] Already initialized.');
    return getRendererConfig();
  }

  _performanceTier = options.performanceTier || _detectPerformanceTier();

  const devicePixelRatio = typeof window !== 'undefined'
    ? Math.min(window.devicePixelRatio || 1, _config.maxPixelRatio) : 1;

  const tierPixelRatio = {
    [PERFORMANCE_TIER.LOW]:    1,
    [PERFORMANCE_TIER.MEDIUM]: Math.min(devicePixelRatio, 1.5),
    [PERFORMANCE_TIER.HIGH]:   devicePixelRatio,
  }[_performanceTier];

  _config = {
    ...DEFAULT_CONFIG,
    ...options,
    pixelRatio: options.pixelRatio || tierPixelRatio,
    shadowMap:  options.shadowMap  ?? (_performanceTier === PERFORMANCE_TIER.HIGH),
    width:      options.width  || (typeof window !== 'undefined' ? window.innerWidth  : 800),
    height:     options.height || (typeof window !== 'undefined' ? window.innerHeight : 600),
  };

  _canvas      = options.canvas || null;
  _initialized = true;
  _frameCount  = 0;

  if (_canvas) {
    _canvas.addEventListener('webglcontextlost',     _onContextLost,     false);
    _canvas.addEventListener('webglcontextrestored', _onContextRestored, false);
  }
  if (typeof window !== 'undefined') {
    window.addEventListener('resize', _onWindowResize, false);
  }

  RendererLogger.info(
    `[Renderer] Initialized — tier: ${_performanceTier}, ` +
    `pixelRatio: ${_config.pixelRatio}, size: ${_config.width}x${_config.height}`
  );

  if (typeof window !== 'undefined' && typeof CustomEvent !== 'undefined') {
    window.dispatchEvent(new CustomEvent('immortail:renderer:renderer_initialized', {
      detail: { performanceTier: _performanceTier, timestamp: Date.now() },
    }));
  }

  return getRendererConfig();
}

export function startRenderLoop(onFrame) {
  if (!_initialized) { RendererLogger.error('[Renderer] Not initialized.'); return; }
  if (_running)       { RendererLogger.warn('[Renderer] Already running.'); return; }
  if (typeof onFrame !== 'function') { RendererLogger.error('[Renderer] onFrame must be a function.'); return; }

  _running       = true;
  _lastFrameTime = performance.now();
  RendererLogger.info('[Renderer] Render loop started.');

  const tick = (now) => {
    if (!_running) return;
    const delta = now - _lastFrameTime;
    _lastFrameTime = now;
    _frameCount++;
    if (!_contextLost) {
      try { onFrame(delta, _frameCount); }
      catch (err) { RendererLogger.error(`[Renderer] Frame error: ${err.message}`); }
    }
    _renderLoop = requestAnimationFrame(tick);
  };
  _renderLoop = requestAnimationFrame(tick);
}

export function stopRenderLoop() {
  if (!_running) return;
  _running = false;
  if (_renderLoop !== null) { cancelAnimationFrame(_renderLoop); _renderLoop = null; }
  RendererLogger.info(`[Renderer] Loop stopped at frame ${_frameCount}.`);
}

export function resizeRenderer(width, height) {
  if (!_initialized) return;
  if (typeof width !== 'number' || typeof height !== 'number' || width <= 0 || height <= 0) return;
  _config.width  = width;
  _config.height = height;
  RendererLogger.debug(`[Renderer] Resized → ${width}x${height}`);
}

export function destroyRenderer() {
  RendererLogger.info('[Renderer] Destroying...');
  stopRenderLoop();
  if (_canvas) {
    _canvas.removeEventListener('webglcontextlost',     _onContextLost);
    _canvas.removeEventListener('webglcontextrestored', _onContextRestored);
    _canvas = null;
  }
  if (typeof window !== 'undefined') window.removeEventListener('resize', _onWindowResize);
  _renderer    = null;
  _initialized = false;
  _contextLost = false;
  _frameCount  = 0;
  _config      = { ...DEFAULT_CONFIG };
  RendererLogger.info('[Renderer] Destroyed.');
}

export function setRendererInstance(inst) { _renderer = inst; }
export function getRendererInstance()     { return _renderer; }
export function isRendererInitialized()   { return _initialized; }
export function isRendererRunning()       { return _running; }
export function getFrameCount()           { return _frameCount; }

export function getRendererConfig() {
  return {
    initialized: _initialized, running: _running,
    performanceTier: _performanceTier, contextLost: _contextLost,
    frameCount: _frameCount,
    config: {
      antialias: _config.antialias, alpha: _config.alpha,
      powerPreference: _config.powerPreference, pixelRatio: _config.pixelRatio,
      shadowMap: _config.shadowMap, outputColorSpace: _config.outputColorSpace,
      toneMapping: _config.toneMapping, toneMappingExposure: _config.toneMappingExposure,
      width: _config.width, height: _config.height,
    },
  };
}

function _onContextLost(event) {
  event.preventDefault(); _contextLost = true; _running = false;
  RendererLogger.warn('[Renderer] WebGL context lost.');
}
function _onContextRestored() {
  _contextLost = false; RendererLogger.info('[Renderer] WebGL context restored.');
}
function _onWindowResize() {
  if (typeof window !== 'undefined') resizeRenderer(window.innerWidth, window.innerHeight);
}
function _detectPerformanceTier() {
  if (typeof navigator === 'undefined') return PERFORMANCE_TIER.MEDIUM;
  const cores = navigator.hardwareConcurrency || 4;
  const mem   = navigator.deviceMemory       || 4;
  if (cores <= 2 || mem <= 2) return PERFORMANCE_TIER.LOW;
  if (cores >= 8 && mem >= 8) return PERFORMANCE_TIER.HIGH;
  return PERFORMANCE_TIER.MEDIUM;
}
