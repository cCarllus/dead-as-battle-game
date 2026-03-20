// Responsável por aquecer cache de assets críticos para melhorar a percepção de carregamento.
import { UI_TEXTURE_ASSET_URLS } from "@/shared/assets/game-assets";

const ASSETS_TO_WARM_UP = [
  UI_TEXTURE_ASSET_URLS.loadingScreenPrimary,
  UI_TEXTURE_ASSET_URLS.loadingScreenSecondary
] as const;

let cacheWarmupPromise: Promise<void> | null = null;

async function cacheAsset(url: string): Promise<void> {
  const response = await fetch(url, { cache: "force-cache" });
  if (!response.ok) {
    throw new Error(`Falha ao carregar asset: ${url}`);
  }

  await response.blob();
}

export function warmUpAssetCache(): Promise<void> {
  if (!cacheWarmupPromise) {
    cacheWarmupPromise = Promise.allSettled(ASSETS_TO_WARM_UP.map((url) => cacheAsset(url))).then(() => {
      // O fluxo inicial não deve falhar por erro de preload de assets.
    });
  }

  return cacheWarmupPromise;
}
