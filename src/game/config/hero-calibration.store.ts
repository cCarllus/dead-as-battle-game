// Responsável por armazenar e recuperar calibrações visuais por herói para manter escala consistente entre modelos 3D.
export type HeroRuntimeCalibration = {
  normalizedScale: number;
  normalizedOffsetY: number;
};

const STORAGE_KEY = "dab:hero-runtime-calibration:v2";
const calibrationByHeroId = new Map<string, HeroRuntimeCalibration>();

function canUseStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function loadFromStorage(): void {
  if (!canUseStorage() || calibrationByHeroId.size > 0) {
    return;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return;
    }

    const parsed = JSON.parse(raw) as Record<string, HeroRuntimeCalibration>;
    Object.entries(parsed).forEach(([heroId, calibration]) => {
      if (
        !calibration ||
        typeof calibration.normalizedScale !== "number" ||
        !Number.isFinite(calibration.normalizedScale) ||
        calibration.normalizedScale <= 0 ||
        typeof calibration.normalizedOffsetY !== "number" ||
        !Number.isFinite(calibration.normalizedOffsetY)
      ) {
        return;
      }

      calibrationByHeroId.set(heroId, {
        normalizedScale: calibration.normalizedScale,
        normalizedOffsetY: calibration.normalizedOffsetY
      });
    });
  } catch {
    // Ignora storage inválido e mantém mapa em memória.
  }
}

function persistToStorage(): void {
  if (!canUseStorage()) {
    return;
  }

  try {
    const payload = Array.from(calibrationByHeroId.entries()).reduce<Record<string, HeroRuntimeCalibration>>(
      (acc, [heroId, calibration]) => {
        acc[heroId] = calibration;
        return acc;
      },
      {}
    );

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Evita quebrar fluxo em ambientes sem quota de storage.
  }
}

export function getHeroRuntimeCalibration(heroId: string): HeroRuntimeCalibration | null {
  loadFromStorage();
  return calibrationByHeroId.get(heroId) ?? null;
}

export function setHeroRuntimeCalibration(heroId: string, calibration: HeroRuntimeCalibration): void {
  if (
    !Number.isFinite(calibration.normalizedScale) ||
    calibration.normalizedScale <= 0 ||
    !Number.isFinite(calibration.normalizedOffsetY)
  ) {
    return;
  }

  calibrationByHeroId.set(heroId, {
    normalizedScale: calibration.normalizedScale,
    normalizedOffsetY: calibration.normalizedOffsetY
  });
  persistToStorage();
}
