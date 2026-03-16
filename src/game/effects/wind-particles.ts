// Responsável por emitir partículas leves de vento e poeira para reforçar sensação de velocidade e impacto.
import {
  Color4,
  DynamicTexture,
  ParticleSystem,
  Vector3,
  type Scene
} from "@babylonjs/core";

export type WindParticlesFrameInput = {
  speedFeedback: number;
  isSprinting: boolean;
  isGrounded: boolean;
  didLand: boolean;
  landingImpact: number;
  cameraPosition: Vector3;
  cameraForward: Vector3;
  playerPosition: { x: number; y: number; z: number };
};

export type WindParticlesSystem = {
  update: (input: WindParticlesFrameInput) => void;
  dispose: () => void;
};

function createSoftParticleTexture(scene: Scene, name: string): DynamicTexture {
  const texture = new DynamicTexture(name, { width: 64, height: 64 }, scene, true);
  const context = texture.getContext();

  context.clearRect(0, 0, 64, 64);
  const gradient = context.createRadialGradient(32, 32, 1, 32, 32, 30);
  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(0.4, "rgba(255,255,255,0.45)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, 64, 64);

  texture.update();
  return texture;
}

export function createWindParticlesSystem(scene: Scene): WindParticlesSystem {
  const sharedTexture = createSoftParticleTexture(scene, "gameFeelParticleTexture");
  const windEmitterPosition = Vector3.Zero();
  const dustEmitterPosition = Vector3.Zero();

  const wind = new ParticleSystem("gameFeelWindParticles", 130, scene);
  wind.particleTexture = sharedTexture;
  wind.emitter = windEmitterPosition;
  wind.emitRate = 0;
  wind.minSize = 0.012;
  wind.maxSize = 0.028;
  wind.minLifeTime = 0.08;
  wind.maxLifeTime = 0.2;
  wind.minEmitPower = 1.8;
  wind.maxEmitPower = 3.4;
  wind.color1 = new Color4(0.8, 0.92, 1, 0.22);
  wind.color2 = new Color4(0.7, 0.86, 1, 0.08);
  wind.colorDead = new Color4(0.7, 0.86, 1, 0);
  wind.minEmitBox = new Vector3(-0.24, -0.12, -0.12);
  wind.maxEmitBox = new Vector3(0.24, 0.12, 0.12);
  wind.direction1 = new Vector3(0, 0, -1);
  wind.direction2 = new Vector3(0, 0, -1);
  wind.start();

  const dust = new ParticleSystem("gameFeelDustParticles", 96, scene);
  dust.particleTexture = sharedTexture;
  dust.emitter = dustEmitterPosition;
  dust.emitRate = 0;
  dust.minSize = 0.04;
  dust.maxSize = 0.11;
  dust.minLifeTime = 0.18;
  dust.maxLifeTime = 0.35;
  dust.minEmitPower = 0.35;
  dust.maxEmitPower = 1.4;
  dust.color1 = new Color4(0.75, 0.72, 0.66, 0.26);
  dust.color2 = new Color4(0.68, 0.65, 0.6, 0.15);
  dust.colorDead = new Color4(0.64, 0.62, 0.58, 0);
  dust.minEmitBox = new Vector3(-0.16, 0, -0.16);
  dust.maxEmitBox = new Vector3(0.16, 0.04, 0.16);
  dust.gravity = new Vector3(0, -2.2, 0);
  dust.direction1 = new Vector3(-0.2, 0.5, -0.2);
  dust.direction2 = new Vector3(0.2, 1.1, 0.2);
  dust.start();

  return {
    update: (input) => {
      const safeFeedback = Math.max(0, Math.min(1, input.speedFeedback));
      const forward = input.cameraForward.lengthSquared() > 0.0001
        ? input.cameraForward.normalizeToNew()
        : Vector3.Forward();
      const backward = forward.scale(-1);
      const sideways = new Vector3(forward.z, 0, -forward.x);

      windEmitterPosition.copyFrom(input.cameraPosition.add(forward.scale(0.45)).add(new Vector3(0, -0.08, 0)));

      wind.direction1.copyFrom(
        backward.scale(2.2).add(sideways.scale(-0.55)).add(new Vector3(0, -0.08, 0))
      );
      wind.direction2.copyFrom(
        backward.scale(3.2).add(sideways.scale(0.55)).add(new Vector3(0, 0.08, 0))
      );
      // Disable camera-attached wind sprites because they read as floating white orbs in gameplay.
      wind.emitRate = 0;

      dustEmitterPosition.set(input.playerPosition.x, input.playerPosition.y + 0.03, input.playerPosition.z);
      dust.emitRate = input.isGrounded && input.isSprinting ? 8 + Math.floor(26 * safeFeedback) : 0;

      if (input.didLand) {
        const burstCount = 8 + Math.floor(24 * Math.max(0, Math.min(1, input.landingImpact)));
        dust.manualEmitCount = burstCount;
      }
    },
    dispose: () => {
      wind.stop();
      dust.stop();
      wind.dispose();
      dust.dispose();
      sharedTexture.dispose();
    }
  };
}
