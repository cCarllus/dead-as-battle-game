// Responsável por aplicar um fallback visual de ragdoll/collapse após morte autoritativa sem acoplar ao controlador de locomoção.
import { Quaternion, Vector3, type TransformNode } from "@babylonjs/core";

type RagdollRuntime = {
  visualRoot: TransformNode;
  basePosition: Vector3;
  targetPosition: Vector3;
  targetRotation: Quaternion;
};

export type RagdollSystem = {
  enable: (sessionId: string) => void;
  disable: (sessionId: string) => void;
  tick: (deltaSeconds: number) => void;
  dispose: () => void;
};

export function createRagdollSystem(options: {
  resolveVisualRoot: (sessionId: string) => TransformNode | null;
}): RagdollSystem {
  const runtimeBySessionId = new Map<string, RagdollRuntime>();

  return {
    enable: (sessionId) => {
      if (runtimeBySessionId.has(sessionId)) {
        return;
      }

      const visualRoot = options.resolveVisualRoot(sessionId);
      if (!visualRoot) {
        return;
      }

      const basePosition = visualRoot.position.clone();
      const targetPosition = basePosition.add(new Vector3(0, -0.42, 0));
      const targetRotation = Quaternion.FromEulerAngles(1.24, visualRoot.rotation.y, sessionId.length % 2 === 0 ? 0.22 : -0.22);
      visualRoot.rotationQuaternion ??= Quaternion.FromEulerAngles(
        visualRoot.rotation.x,
        visualRoot.rotation.y,
        visualRoot.rotation.z
      );

      runtimeBySessionId.set(sessionId, {
        visualRoot,
        basePosition,
        targetPosition,
        targetRotation
      });
    },
    disable: (sessionId) => {
      const runtime = runtimeBySessionId.get(sessionId);
      if (!runtime) {
        return;
      }

      runtime.visualRoot.position.copyFrom(runtime.basePosition);
      runtime.visualRoot.rotationQuaternion = null;
      runtime.visualRoot.rotation.set(0, runtime.visualRoot.rotation.y, 0);
      runtimeBySessionId.delete(sessionId);
    },
    tick: (deltaSeconds) => {
      const lerpFactor = Math.min(1, deltaSeconds * 8);
      runtimeBySessionId.forEach((runtime) => {
        runtime.visualRoot.position = Vector3.Lerp(runtime.visualRoot.position, runtime.targetPosition, lerpFactor);

        const currentRotation =
          runtime.visualRoot.rotationQuaternion ??
          Quaternion.FromEulerAngles(runtime.visualRoot.rotation.x, runtime.visualRoot.rotation.y, runtime.visualRoot.rotation.z);
        runtime.visualRoot.rotationQuaternion = Quaternion.Slerp(currentRotation, runtime.targetRotation, lerpFactor);
      });
    },
    dispose: () => {
      Array.from(runtimeBySessionId.keys()).forEach((sessionId) => {
        const runtime = runtimeBySessionId.get(sessionId);
        if (!runtime) {
          return;
        }

        runtime.visualRoot.rotationQuaternion = null;
        runtime.visualRoot.position.copyFrom(runtime.basePosition);
      });
      runtimeBySessionId.clear();
    }
  };
}
