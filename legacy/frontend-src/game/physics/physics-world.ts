// Responsável por registrar geometria estática do cenário no Physics V2 para colisão robusta do character controller.
import type { AbstractMesh, Scene } from "@babylonjs/core";
import { PhysicsShapeType } from "@babylonjs/core/Physics/v2/IPhysicsEnginePlugin";
import { PhysicsAggregate } from "@babylonjs/core/Physics/v2/physicsAggregate";
import type { PhysicsBody } from "@babylonjs/core/Physics/v2/physicsBody";

export type PhysicsWorld = {
  registerStaticMeshes: (meshes: AbstractMesh[]) => void;
  resolveMeshFromBody: (body: PhysicsBody | null | undefined) => AbstractMesh | null;
  getStaticBodyCount: () => number;
  dispose: () => void;
};

export type CreatePhysicsWorldOptions = {
  scene: Scene;
  loggerPrefix?: string;
};

type StaticBodyEntry = {
  mesh: AbstractMesh;
  aggregate: PhysicsAggregate;
};

function canCreateStaticBody(mesh: AbstractMesh): boolean {
  if (mesh.isDisposed()) {
    return false;
  }

  const indices = mesh.getIndices();
  return !!indices && indices.length > 0;
}

export function createPhysicsWorld(options: CreatePhysicsWorldOptions): PhysicsWorld {
  const prefix = options.loggerPrefix ? `${options.loggerPrefix} ` : "";
  const staticBodyEntriesByMeshId = new Map<number, StaticBodyEntry>();
  const meshByBody = new WeakMap<PhysicsBody, AbstractMesh>();

  return {
    registerStaticMeshes: (meshes) => {
      if (!options.scene.getPhysicsEngine()) {
        return;
      }

      meshes.forEach((mesh) => {
        if (!canCreateStaticBody(mesh)) {
          return;
        }

        if (staticBodyEntriesByMeshId.has(mesh.uniqueId)) {
          return;
        }

        try {
          mesh.computeWorldMatrix(true);
          const aggregate = new PhysicsAggregate(
            mesh,
            PhysicsShapeType.MESH,
            {
              mass: 0,
              friction: 0.92,
              restitution: 0
            },
            options.scene
          );
          staticBodyEntriesByMeshId.set(mesh.uniqueId, {
            mesh,
            aggregate
          });
          meshByBody.set(aggregate.body, mesh);
        } catch (error) {
          console.warn(`${prefix}Failed to register static physics body for mesh '${mesh.name}'.`, error);
        }
      });
    },
    resolveMeshFromBody: (body) => {
      if (!body) {
        return null;
      }

      return meshByBody.get(body) ?? null;
    },
    getStaticBodyCount: () => {
      return staticBodyEntriesByMeshId.size;
    },
    dispose: () => {
      staticBodyEntriesByMeshId.forEach((entry) => {
        entry.aggregate.dispose();
      });
      staticBodyEntriesByMeshId.clear();
    }
  };
}
