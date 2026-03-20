// Responsável por aquecer cache de assets críticos para melhorar a percepção de carregamento.
const ASSETS_TO_WARM_UP = [
  "/assets/images/ui/loading_1.png",
  "/assets/images/ui/loading_2.png"
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
