import "@babylonjs/loaders/glTF";

import {
  Color3,
  Mesh,
  MeshBuilder,
  PBRMaterial,
  StandardMaterial,
  TransformNode,
  Vector3,
  type Scene,
} from "@babylonjs/core";

import { SceneLoader } from "@babylonjs/core/Loading/sceneLoader";
import type { CharacterId, PlayerEntity } from "./player.types";

type CreatePlayerOptions = {
  position?: Vector3;
  collisions?: boolean;
  showCollider?: boolean;
};

const CHARACTER_MODEL_PATH: Record<CharacterId, string> = {
  ryomen_sukuna: "ryomen_sukuna.glb",
  kaiju_n8: "kaiju_n8.glb",
  ainz_ooal_gown: "ainz_ooal_gown.glb",
};

function getCharacterColor(character: CharacterId): Color3 {
  if (character === "ryomen_sukuna") return new Color3(0.75, 0.2, 0.2);
  if (character === "kaiju_n8") return new Color3(0.55, 0.15, 0.6);
  return new Color3(0.2, 0.7, 0.9); // ainz_ooal_gown
}

function applyStylizedMaterialIfNeeded(scene: Scene, character: CharacterId, mesh: Mesh) {
  const mat = mesh.material;

  // Se não tem material, aplica um padrão colorido
  if (!mat) {
    const sm = new StandardMaterial(`${character}-fallback-mat`, scene);
    sm.diffuseColor = getCharacterColor(character);
    sm.specularColor = new Color3(0.05, 0.05, 0.05);
    mesh.material = sm;
    return;
  }

  // Se for PBR, puxa pro "stylized"
  if (mat instanceof PBRMaterial) {
    mat.metallic = 0.1;
    mat.roughness = 0.6;
    return;
  }

  // Se for Standard, reduz brilho “realista”
  if (mat instanceof StandardMaterial) {
    mat.specularColor = new Color3(0.05, 0.05, 0.05);
  }
}

async function attachCharacterModel(
  scene: Scene,
  character: CharacterId,
  collider: Mesh,
  showCollider: boolean
): Promise<void> {
  const modelFile = CHARACTER_MODEL_PATH[character];

  try {
    const result = await SceneLoader.ImportMeshAsync(
      "",
      "/assets/models/characters/",
      modelFile,
      scene
    );

    if (scene.isDisposed) return;

    // Nó raiz do visual (o collider continua sendo o "corpo" com colisão)
    const anchor = new TransformNode(`${character}-visual-root`, scene);
    anchor.parent = collider;

    // Só pega Meshes renderizáveis
    const meshes = result.meshes.filter((m): m is Mesh => m instanceof Mesh);

    // Reparent todos ao anchor
    meshes.forEach((m) => {
      m.parent = anchor;
      m.isPickable = false;
    });

    // 🔥 NORMALIZA ESCALA PELO BOUNDING BOX (altura alvo ~2.2)
    const desiredHeight = 2.2;

    // Bounding da hierarquia (antes)
    const bounds = anchor.getHierarchyBoundingVectors(true);
    const size = bounds.max.subtract(bounds.min);
    const height = Math.max(size.y, 0.0001);

    const scale = desiredHeight / height;
    anchor.scaling = new Vector3(scale, scale, scale);

    // 🔥 ALINHAR NO "CHÃO" (encaixar o pé)
    // Recalcula bounding após scale
    const bounds2 = anchor.getHierarchyBoundingVectors(true);
    const minY = bounds2.min.y;

    // Coloca o menor Y em 0 dentro do collider
    anchor.position = new Vector3(0, -minY, 0);

    // 🎨 Materiais: se vier cinza/sem textura, aplica fallback; se vier PBR, estiliza
    meshes.forEach((m) => applyStylizedMaterialIfNeeded(scene, character, m));

    // collider visível só se você quiser debugar
    collider.isVisible = showCollider;
  } catch (error) {
    console.warn("Falha ao carregar modelo GLB, fallback de cápsula mantido.", error);
  }
}

export function createPlayer(
  scene: Scene,
  character: CharacterId,
  options: CreatePlayerOptions = {}
): PlayerEntity {
  // Collider (colisão + movimentação): sempre simples e estável
  const collider = MeshBuilder.CreateCapsule(
    `${character}-player`,
    { height: 2.2, radius: 0.45, tessellation: 12 },
    scene
  );

  collider.position = options.position?.clone() ?? new Vector3(0, 1.1, 0);
  collider.checkCollisions = options.collisions ?? true;

  // Material do collider (só pra debug visual caso showCollider=true)
  const material = new StandardMaterial(`${character}-material`, scene);
  material.diffuseColor = getCharacterColor(character);
  material.specularColor = new Color3(0.05, 0.05, 0.05);
  collider.material = material;

  void attachCharacterModel(scene, character, collider, options.showCollider ?? false);

  return {
    character,
    mesh: collider,
  };
}