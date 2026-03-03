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
      // O fluxo inicial não deve quebrar se algum asset falhar.
    });
  }

  return cacheWarmupPromise;
}
