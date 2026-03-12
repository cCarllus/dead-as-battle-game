// Responsável por padronizar marcação explícita e leitura de superfícies válidas para ledge grab.
import { AbstractMesh, Node } from "@babylonjs/core";

type ClimbableMetadata = {
  isClimbable?: boolean;
};

function readClimbableFlag(node: Node | null): boolean | null {
  if (!node) {
    return null;
  }

  const metadata = node.metadata;
  if (!metadata || typeof metadata !== "object") {
    return null;
  }

  const candidate = metadata as ClimbableMetadata;
  return typeof candidate.isClimbable === "boolean" ? candidate.isClimbable : null;
}

export function setMeshClimbable(mesh: AbstractMesh, isClimbable: boolean = true): void {
  const currentMetadata =
    mesh.metadata && typeof mesh.metadata === "object"
      ? { ...(mesh.metadata as Record<string, unknown>) }
      : {};

  currentMetadata.isClimbable = isClimbable;
  mesh.metadata = currentMetadata;
}

export function isClimbableSurfaceMesh(mesh: AbstractMesh | null): boolean {
  let currentNode: Node | null = mesh;

  while (currentNode) {
    const explicitFlag = readClimbableFlag(currentNode);
    if (explicitFlag !== null) {
      return explicitFlag;
    }

    currentNode = currentNode.parent;
  }

  return false;
}
