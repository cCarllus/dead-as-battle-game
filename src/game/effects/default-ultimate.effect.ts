// Responsável por reproduzir o V1 visual da ultimate padrão (aura azul, sparks e ring) em um player.
import {
  Color3,
  Color4,
  DynamicTexture,
  MeshBuilder,
  ParticleSystem,
  Scene,
  StandardMaterial,
  TransformNode,
  Vector3
} from "@babylonjs/core";

const MIN_DURATION_MS = 3000;
const MAX_DURATION_MS = 5000;
const DEFAULT_DURATION_MS = 3800;
const FADE_OUT_MS = 420;
const DISPOSE_AFTER_STOP_MS = 820;
const BASE_RING_ALPHA = 0.56;
const BODY_GLOW_COLOR = new Color3(0.34, 0.84, 1);

type EmissiveMaterialLike = {
  emissiveColor: Color3;
  emissiveIntensity?: number;
};

export type DefaultUltimateEffectHandle = {
  stop: () => void;
  dispose: () => void;
  isDisposed: () => boolean;
};

export type PlayDefaultUltimateEffectOptions = {
  scene: Scene;
  sessionId: string;
  gameplayRoot: TransformNode;
  visualRoot: TransformNode;
  durationMs?: number;
  onDisposed?: () => void;
};

type MaterialSnapshot = {
  emissiveColor: Color3;
  emissiveIntensity: number | null;
};

function clampDuration(durationMs: number | undefined): number {
  if (typeof durationMs !== "number" || !Number.isFinite(durationMs)) {
    return DEFAULT_DURATION_MS;
  }

  return Math.max(MIN_DURATION_MS, Math.min(MAX_DURATION_MS, Math.floor(durationMs)));
}

function isEmissiveMaterialLike(material: unknown): material is EmissiveMaterialLike {
  if (!material || typeof material !== "object") {
    return false;
  }

  return (material as { emissiveColor?: unknown }).emissiveColor instanceof Color3;
}

function createAuraParticleTexture(scene: Scene, name: string): DynamicTexture {
  const size = 128;
  const texture = new DynamicTexture(name, { width: size, height: size }, scene, false);
  texture.hasAlpha = true;

  const context = texture.getContext();
  context.clearRect(0, 0, size, size);

  const gradient = context.createRadialGradient(size * 0.5, size * 0.5, size * 0.08, size * 0.5, size * 0.5, size * 0.48);
  gradient.addColorStop(0, "rgba(255,255,255,0.96)");
  gradient.addColorStop(0.24, "rgba(118,235,255,0.92)");
  gradient.addColorStop(0.58, "rgba(52,145,255,0.68)");
  gradient.addColorStop(1, "rgba(13,36,96,0)");

  context.fillStyle = gradient;
  context.beginPath();
  context.arc(size * 0.5, size * 0.5, size * 0.48, 0, Math.PI * 2);
  context.fill();

  texture.update(false);
  return texture;
}

function createRingTexture(scene: Scene, name: string): DynamicTexture {
  const size = 256;
  const texture = new DynamicTexture(name, { width: size, height: size }, scene, false);
  texture.hasAlpha = true;

  const context = texture.getContext();
  context.clearRect(0, 0, size, size);

  context.beginPath();
  context.arc(size * 0.5, size * 0.5, size * 0.29, 0, Math.PI * 2);
  context.lineWidth = size * 0.12;
  context.strokeStyle = "rgba(105,225,255,0.92)";
  context.stroke();

  context.beginPath();
  context.arc(size * 0.5, size * 0.5, size * 0.29, 0, Math.PI * 2);
  context.lineWidth = size * 0.2;
  context.strokeStyle = "rgba(46,130,255,0.34)";
  context.stroke();

  const centerGlow = context.createRadialGradient(size * 0.5, size * 0.5, 0, size * 0.5, size * 0.5, size * 0.24);
  centerGlow.addColorStop(0, "rgba(34,180,255,0.24)");
  centerGlow.addColorStop(1, "rgba(34,180,255,0)");
  context.fillStyle = centerGlow;
  context.beginPath();
  context.arc(size * 0.5, size * 0.5, size * 0.24, 0, Math.PI * 2);
  context.fill();

  texture.update(false);
  return texture;
}

export function playDefaultUltimateEffect(options: PlayDefaultUltimateEffectOptions): DefaultUltimateEffectHandle {
  const durationMs = clampDuration(options.durationMs);
  const startedAtMs = Date.now();
  const stopAtMs = startedAtMs + durationMs;

  const effectRoot = new TransformNode(
    `defaultUltimateFxRoot_${options.sessionId}_${startedAtMs}`,
    options.scene
  );
  effectRoot.parent = options.gameplayRoot;
  effectRoot.position.set(0, 0, 0);

  const auraEmitter = MeshBuilder.CreateBox(
    `defaultUltimateAuraEmitter_${options.sessionId}_${startedAtMs}`,
    { size: 0.01 },
    options.scene
  );
  auraEmitter.isVisible = false;
  auraEmitter.isPickable = false;
  auraEmitter.parent = effectRoot;
  auraEmitter.position.set(0, 1.04, 0);

  const sparkEmitter = MeshBuilder.CreateBox(
    `defaultUltimateSparkEmitter_${options.sessionId}_${startedAtMs}`,
    { size: 0.01 },
    options.scene
  );
  sparkEmitter.isVisible = false;
  sparkEmitter.isPickable = false;
  sparkEmitter.parent = effectRoot;
  sparkEmitter.position.set(0, 1.08, 0);

  const auraTexture = createAuraParticleTexture(
    options.scene,
    `defaultUltimateAuraParticleTexture_${options.sessionId}_${startedAtMs}`
  );
  const sparkTexture = createAuraParticleTexture(
    options.scene,
    `defaultUltimateSparkParticleTexture_${options.sessionId}_${startedAtMs}`
  );
  const ringTexture = createRingTexture(
    options.scene,
    `defaultUltimateGroundRingTexture_${options.sessionId}_${startedAtMs}`
  );

  const auraParticles = new ParticleSystem(
    `defaultUltimateAuraParticles_${options.sessionId}_${startedAtMs}`,
    420,
    options.scene
  );
  auraParticles.particleTexture = auraTexture;
  auraParticles.emitter = auraEmitter;
  auraParticles.minEmitBox = new Vector3(-0.46, -1.02, -0.46);
  auraParticles.maxEmitBox = new Vector3(0.46, 1.02, 0.46);
  auraParticles.color1 = new Color4(0.22, 0.7, 1, 0.88);
  auraParticles.color2 = new Color4(0.49, 0.93, 1, 0.8);
  auraParticles.colorDead = new Color4(0.02, 0.24, 0.66, 0);
  auraParticles.minSize = 0.1;
  auraParticles.maxSize = 0.29;
  auraParticles.minLifeTime = 0.36;
  auraParticles.maxLifeTime = 0.88;
  auraParticles.minInitialRotation = -Math.PI;
  auraParticles.maxInitialRotation = Math.PI;
  auraParticles.minAngularSpeed = -1.7;
  auraParticles.maxAngularSpeed = 1.7;
  auraParticles.emitRate = 240;
  auraParticles.gravity = Vector3.Zero();
  auraParticles.direction1 = new Vector3(-0.25, 1.2, -0.25);
  auraParticles.direction2 = new Vector3(0.25, 2.14, 0.25);
  auraParticles.minEmitPower = 0.38;
  auraParticles.maxEmitPower = 1.22;
  auraParticles.updateSpeed = 1 / 60;
  auraParticles.blendMode = ParticleSystem.BLENDMODE_ADD;
  auraParticles.start();

  const sparkParticles = new ParticleSystem(
    `defaultUltimateSparks_${options.sessionId}_${startedAtMs}`,
    220,
    options.scene
  );
  sparkParticles.particleTexture = sparkTexture;
  sparkParticles.emitter = sparkEmitter;
  sparkParticles.minEmitBox = new Vector3(-0.33, -0.88, -0.33);
  sparkParticles.maxEmitBox = new Vector3(0.33, 0.82, 0.33);
  sparkParticles.color1 = new Color4(0.67, 0.96, 1, 0.94);
  sparkParticles.color2 = new Color4(0.31, 0.79, 1, 0.84);
  sparkParticles.colorDead = new Color4(0.05, 0.22, 0.55, 0);
  sparkParticles.minSize = 0.03;
  sparkParticles.maxSize = 0.11;
  sparkParticles.minLifeTime = 0.14;
  sparkParticles.maxLifeTime = 0.34;
  sparkParticles.minInitialRotation = -Math.PI;
  sparkParticles.maxInitialRotation = Math.PI;
  sparkParticles.minAngularSpeed = -6;
  sparkParticles.maxAngularSpeed = 6;
  sparkParticles.emitRate = 130;
  sparkParticles.gravity = new Vector3(0, -0.2, 0);
  sparkParticles.direction1 = new Vector3(-1.2, 0.7, -1.2);
  sparkParticles.direction2 = new Vector3(1.2, 1.6, 1.2);
  sparkParticles.minEmitPower = 0.45;
  sparkParticles.maxEmitPower = 1.85;
  sparkParticles.updateSpeed = 1 / 60;
  sparkParticles.blendMode = ParticleSystem.BLENDMODE_ADD;
  sparkParticles.start();

  const groundRing = MeshBuilder.CreateDisc(
    `defaultUltimateGroundRing_${options.sessionId}_${startedAtMs}`,
    { radius: 1.1, tessellation: 52 },
    options.scene
  );
  groundRing.parent = effectRoot;
  groundRing.rotation.x = Math.PI / 2;
  groundRing.position.y = 0.04;
  groundRing.isPickable = false;

  const groundRingMaterial = new StandardMaterial(
    `defaultUltimateGroundRingMaterial_${options.sessionId}_${startedAtMs}`,
    options.scene
  );
  groundRingMaterial.diffuseColor = Color3.Black();
  groundRingMaterial.specularColor = Color3.Black();
  groundRingMaterial.emissiveColor = new Color3(0.2, 0.72, 1);
  groundRingMaterial.disableLighting = true;
  groundRingMaterial.backFaceCulling = false;
  groundRingMaterial.alpha = BASE_RING_ALPHA;
  groundRingMaterial.diffuseTexture = ringTexture;
  groundRingMaterial.emissiveTexture = ringTexture;
  groundRingMaterial.opacityTexture = ringTexture;
  groundRing.material = groundRingMaterial;

  const materialSnapshots = new Map<EmissiveMaterialLike, MaterialSnapshot>();
  options.visualRoot.getChildMeshes(false).forEach((mesh) => {
    const material = mesh.material;
    if (!isEmissiveMaterialLike(material) || materialSnapshots.has(material)) {
      return;
    }

    const emissiveIntensityValue = (material as { emissiveIntensity?: unknown }).emissiveIntensity;
    materialSnapshots.set(material, {
      emissiveColor: material.emissiveColor.clone(),
      emissiveIntensity:
        typeof emissiveIntensityValue === "number" && Number.isFinite(emissiveIntensityValue)
          ? emissiveIntensityValue
          : null
    });
  });

  let disposed = false;
  let stopped = false;
  let stopStartedAtMs: number | null = null;
  let particlesStopped = false;

  const updateBodyGlow = (energy: number, fadeFactor: number): void => {
    materialSnapshots.forEach((snapshot, material) => {
      const blend = (0.3 + 0.45 * energy) * fadeFactor;
      material.emissiveColor.copyFromFloats(
        snapshot.emissiveColor.r + (BODY_GLOW_COLOR.r - snapshot.emissiveColor.r) * blend,
        snapshot.emissiveColor.g + (BODY_GLOW_COLOR.g - snapshot.emissiveColor.g) * blend,
        snapshot.emissiveColor.b + (BODY_GLOW_COLOR.b - snapshot.emissiveColor.b) * blend
      );

      if (snapshot.emissiveIntensity !== null && typeof material.emissiveIntensity === "number") {
        material.emissiveIntensity = snapshot.emissiveIntensity + 0.4 * energy * fadeFactor;
      }
    });
  };

  const restoreBodyGlow = (): void => {
    materialSnapshots.forEach((snapshot, material) => {
      material.emissiveColor.copyFrom(snapshot.emissiveColor);
      if (snapshot.emissiveIntensity !== null && typeof material.emissiveIntensity === "number") {
        material.emissiveIntensity = snapshot.emissiveIntensity;
      }
    });
    materialSnapshots.clear();
  };

  const stop = (): void => {
    if (stopped || disposed) {
      return;
    }

    stopped = true;
    stopStartedAtMs = Date.now();
  };

  const dispose = (): void => {
    if (disposed) {
      return;
    }

    disposed = true;

    if (frameObserver !== null) {
      options.scene.onBeforeRenderObservable.remove(frameObserver);
    }

    if (!particlesStopped) {
      particlesStopped = true;
      auraParticles.stop();
      sparkParticles.stop();
    }

    restoreBodyGlow();

    auraParticles.dispose();
    sparkParticles.dispose();

    if (!groundRing.isDisposed()) {
      groundRing.dispose(false, false);
    }
    groundRingMaterial.dispose(true, false);

    auraTexture.dispose();
    sparkTexture.dispose();
    ringTexture.dispose();

    if (!auraEmitter.isDisposed()) {
      auraEmitter.dispose(false, false);
    }

    if (!sparkEmitter.isDisposed()) {
      sparkEmitter.dispose(false, false);
    }

    if (!effectRoot.isDisposed()) {
      effectRoot.dispose(false, false);
    }

    options.onDisposed?.();
  };

  const frameObserver = options.scene.onBeforeRenderObservable.add(() => {
    if (disposed) {
      return;
    }

    if (effectRoot.isDisposed()) {
      dispose();
      return;
    }

    const nowMs = Date.now();
    if (!stopped && nowMs >= stopAtMs) {
      stop();
    }

    const elapsedSeconds = (nowMs - startedAtMs) / 1000;
    const pulse = 0.5 + 0.5 * Math.sin(elapsedSeconds * 11.8);
    const instability = 0.5 + 0.5 * Math.sin(elapsedSeconds * 18.6 + 0.7);

    let fadeFactor = 1;
    if (stopped && stopStartedAtMs !== null) {
      if (!particlesStopped) {
        particlesStopped = true;
        auraParticles.stop();
        sparkParticles.stop();
      }

      const fadeProgress = Math.max(0, Math.min(1, (nowMs - stopStartedAtMs) / FADE_OUT_MS));
      fadeFactor = 1 - fadeProgress;

      if (nowMs - stopStartedAtMs >= DISPOSE_AFTER_STOP_MS) {
        dispose();
        return;
      }
    }

    if (!stopped) {
      auraParticles.emitRate = 190 + pulse * 120;
      sparkParticles.emitRate = 88 + instability * 118;
    }

    const ringScale = 1 + Math.sin(elapsedSeconds * 8.2 + 0.35) * 0.06;
    groundRing.scaling.set(ringScale, ringScale, ringScale);
    groundRingMaterial.alpha = (0.8 + pulse * 0.35) * BASE_RING_ALPHA * fadeFactor;

    updateBodyGlow(instability, fadeFactor);
  });

  return {
    stop,
    dispose,
    isDisposed: () => disposed
  };
}
