const TRUE_VALUES = new Set(["1", "true", "yes", "on"]);

function parseBooleanFlag(
  value: string | undefined,
  fallback: boolean
): boolean {
  if (value === undefined) {
    return fallback;
  }

  return TRUE_VALUES.has(value.toLowerCase());
}

export interface AppEnvironment {
  readonly isDev: boolean;
  readonly isProd: boolean;
  readonly debugEnabled: boolean;
  readonly showFps: boolean;
  readonly inspectorEnabled: boolean;
  readonly inspectorAutoOpen: boolean;
  readonly serverUrl: string;
}

export const environment: AppEnvironment = Object.freeze({
  isDev: import.meta.env.DEV,
  isProd: import.meta.env.PROD,
  debugEnabled: parseBooleanFlag(import.meta.env.VITE_DEBUG, import.meta.env.DEV),
  showFps: parseBooleanFlag(import.meta.env.VITE_SHOW_FPS, import.meta.env.DEV),
  inspectorEnabled: parseBooleanFlag(
    import.meta.env.VITE_INSPECTOR,
    import.meta.env.DEV
  ),
  inspectorAutoOpen: parseBooleanFlag(import.meta.env.VITE_INSPECTOR_AUTO_OPEN, false),
  serverUrl: import.meta.env.VITE_SERVER_URL ?? "http://localhost:2567"
});
