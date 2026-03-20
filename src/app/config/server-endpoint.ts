const DEFAULT_SERVER_PORT = 2567;

function normalizeEndpoint(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) {
    return "";
  }

  try {
    const parsed = new URL(trimmed);

    if (parsed.protocol === "http:") {
      parsed.protocol = "ws:";
    } else if (parsed.protocol === "https:") {
      parsed.protocol = "wss:";
    }

    return parsed.toString().replace(/\/$/, "");
  } catch {
    return trimmed;
  }
}

function resolveFallbackEndpoint(): string {
  const protocol = window.location.protocol === "https:" ? "wss" : "ws";
  return `${protocol}://${window.location.hostname}:${DEFAULT_SERVER_PORT}`;
}

export function resolveServerEndpoint(): string {
  const endpointFromEnv = normalizeEndpoint(import.meta.env.VITE_SERVER_URL ?? "");
  if (endpointFromEnv) {
    return endpointFromEnv;
  }

  return resolveFallbackEndpoint();
}
