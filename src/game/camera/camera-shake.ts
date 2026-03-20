// Responsável por fornecer um sistema reutilizável de camera shake com intensidades controladas.
import { clamp } from "@/utils/math";
export type CameraShakePreset = "light" | "medium" | "heavy";

export type CameraShakeImpulse = {
  intensity: number;
  durationMs: number;
  frequencyHz?: number;
};

export type CameraShakeOffset = {
  yaw: number;
  pitch: number;
};

export type CameraShakeSystem = {
  trigger: (impulse: CameraShakeImpulse) => void;
  triggerPreset: (preset: CameraShakePreset, scale?: number) => void;
  sample: (deltaSeconds: number) => CameraShakeOffset;
  reset: () => void;
};

type ActiveImpulse = {
  intensity: number;
  durationMs: number;
  frequencyHz: number;
  elapsedMs: number;
  seed: number;
};

const PRESET_TO_IMPULSE: Record<CameraShakePreset, CameraShakeImpulse> = {
  light: {
    intensity: 0.3,
    durationMs: 110,
    frequencyHz: 18
  },
  medium: {
    intensity: 0.56,
    durationMs: 170,
    frequencyHz: 20
  },
  heavy: {
    intensity: 0.9,
    durationMs: 230,
    frequencyHz: 23
  }
};

export function createCameraShakeSystem(): CameraShakeSystem {
  const impulses: ActiveImpulse[] = [];

  return {
    trigger: (impulse) => {
      if (impulse.intensity <= 0 || impulse.durationMs <= 0) {
        return;
      }

      impulses.push({
        intensity: impulse.intensity,
        durationMs: impulse.durationMs,
        frequencyHz: impulse.frequencyHz ?? 20,
        elapsedMs: 0,
        seed: Math.random() * Math.PI * 2
      });
    },
    triggerPreset: (preset, scale = 1) => {
      const base = PRESET_TO_IMPULSE[preset];
      const safeScale = Math.max(0, scale);
      if (safeScale <= 0) {
        return;
      }

      impulses.push({
        intensity: base.intensity * safeScale,
        durationMs: base.durationMs,
        frequencyHz: base.frequencyHz ?? 20,
        elapsedMs: 0,
        seed: Math.random() * Math.PI * 2
      });
    },
    sample: (deltaSeconds) => {
      if (impulses.length === 0) {
        return {
          yaw: 0,
          pitch: 0
        };
      }

      const deltaMs = Math.max(0, deltaSeconds) * 1000;
      let yaw = 0;
      let pitch = 0;

      for (let index = impulses.length - 1; index >= 0; index -= 1) {
        const impulse = impulses[index];
        impulse.elapsedMs += deltaMs;
        const t = clamp(impulse.elapsedMs / impulse.durationMs, 0, 1);
        const envelope = 1 - t;

        if (t >= 1) {
          impulses.splice(index, 1);
          continue;
        }

        const phase = impulse.seed + impulse.elapsedMs * 0.001 * impulse.frequencyHz * Math.PI * 2;
        const localStrength = impulse.intensity * envelope;
        yaw += Math.sin(phase * 1.3) * localStrength * 0.0044;
        pitch += Math.cos(phase) * localStrength * 0.0048;
      }

      return {
        yaw,
        pitch
      };
    },
    reset: () => {
      impulses.length = 0;
    }
  };
}
