// Responsável por centralizar tuning visual do HUD/match UI sem acoplar widgets aos detalhes de gameplay.
export const MATCH_UI_CONFIG = {
  fullscreenNoticeTimeoutMs: 3000,
  bars: {
    minEmptyBarVisualPercent: 0,
    staminaPulseDurationMs: 450,
    healthBarMaxHue: 120
  },
  hudFeed: {
    maxItems: 5,
    ttlMs: 14000,
    fadeWindowMs: 4200,
    historySeedLimit: 3
  },
  killFeed: {
    maxItems: 5,
    ttlMs: 6500,
    fadeWindowMs: 1400,
    enterMs: 240
  },
  chatBubble: {
    ttlMs: 5200,
    fadeWindowMs: 1500,
    maxChars: 96
  },
  radar: {
    rangeMeters: 40,
    maxMarkers: 10,
    markerEdgePaddingPx: 10,
    compassRadiusRatio: 0.82
  },
  overheadBars: {
    rangeMeters: 25
  }
} as const;
