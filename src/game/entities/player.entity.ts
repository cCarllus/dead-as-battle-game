// Responsável por construir e descartar a representação visual base de um jogador no mapa da partida.
import {
  AbstractMesh,
  Color3,
  DynamicTexture,
  MeshBuilder,
  Scene,
  SceneLoader,
  StandardMaterial,
  TransformNode,
  Vector3
} from "@babylonjs/core";
import "@babylonjs/loaders/glTF";
import { DEFAULT_CHAMPION_ID, getBaseChampionById, isChampionId } from "../../data/champions.catalog";
import type { MatchPlayerState } from "../../models/match-player.model";

const TARGET_PLAYER_HEIGHT = 2.4;
const CAMERA_TARGET_OFFSET_Y = 1.28;

function splitModelPath(modelUrl: string): { rootUrl: string; fileName: string } {
  const lastSlash = modelUrl.lastIndexOf("/");
  if (lastSlash < 0) {
    return { rootUrl: "/", fileName: modelUrl };
  }

  return {
    rootUrl: modelUrl.slice(0, lastSlash + 1),
    fileName: modelUrl.slice(lastSlash + 1)
  };
}

function normalizeAvatar(root: TransformNode): void {
  const bounds = root.getHierarchyBoundingVectors(true);
  const size = bounds.max.subtract(bounds.min);
  const height = Math.max(size.y, 0.001);
  const scaleFactor = TARGET_PLAYER_HEIGHT / height;

  root.scaling = new Vector3(scaleFactor, scaleFactor, scaleFactor);

  const scaledBounds = root.getHierarchyBoundingVectors(true);
  const center = scaledBounds.min.add(scaledBounds.max).scale(0.5);
  root.position = new Vector3(-center.x, -scaledBounds.min.y, -center.z);
}

function createPlayerLabel(scene: Scene, nickname: string, textColor: string): AbstractMesh {
  const texture = new DynamicTexture("matchPlayerLabelTexture", { width: 512, height: 128 }, scene, true);
  texture.hasAlpha = true;
  texture.drawText(
    nickname,
    null,
    88,
    "bold 56px Rajdhani",
    textColor,
    "transparent",
    true
  );

  const material = new StandardMaterial("matchPlayerLabelMaterial", scene);
  material.diffuseTexture = texture;
  material.emissiveColor = Color3.White();
  material.specularColor = Color3.Black();
  material.backFaceCulling = false;

  const plane = MeshBuilder.CreatePlane("matchPlayerLabel", { width: 2.6, height: 0.58 }, scene);
  plane.material = material;
  plane.billboardMode = AbstractMesh.BILLBOARDMODE_ALL;
  plane.position = new Vector3(0, TARGET_PLAYER_HEIGHT + 0.52, 0);
  plane.isPickable = false;

  return plane;
}

export type MatchPlayerEntity = {
  sessionId: string;
  setPosition: (position: MatchPlayerState["position"]) => void;
  getCameraTarget: () => Vector3;
  dispose: () => void;
};

export type CreateMatchPlayerEntityOptions = {
  scene: Scene;
  player: MatchPlayerState;
  accentColorHex: string;
  labelColorHex: string;
  labelPrefix?: string;
};

export function createMatchPlayerEntity(options: CreateMatchPlayerEntityOptions): MatchPlayerEntity {
  const root = new TransformNode(`matchPlayerRoot_${options.player.sessionId}`, options.scene);
  const avatarRoot = new TransformNode(`matchPlayerAvatar_${options.player.sessionId}`, options.scene);
  avatarRoot.parent = root;

  const labelText = `${options.labelPrefix ?? ""}${options.player.nickname}`;
  const label = createPlayerLabel(options.scene, labelText, options.labelColorHex);
  label.parent = root;

  const accentColor = Color3.FromHexString(options.accentColorHex);
  const fallbackMaterial = new StandardMaterial(`matchPlayerFallback_${options.player.sessionId}`, options.scene);
  fallbackMaterial.diffuseColor = accentColor;
  fallbackMaterial.emissiveColor = accentColor.scale(0.22);
  fallbackMaterial.specularColor = accentColor.scale(0.35);

  const fallbackBody = MeshBuilder.CreateCapsule(
    `matchPlayerFallbackBody_${options.player.sessionId}`,
    {
      height: TARGET_PLAYER_HEIGHT,
      radius: 0.44,
      tessellation: 18
    },
    options.scene
  );
  fallbackBody.material = fallbackMaterial;
  fallbackBody.parent = avatarRoot;

  const fallbackBase = MeshBuilder.CreateCylinder(
    `matchPlayerFallbackBase_${options.player.sessionId}`,
    {
      height: 0.12,
      diameter: 1.35,
      tessellation: 30
    },
    options.scene
  );
  fallbackBase.material = fallbackMaterial;
  fallbackBase.position.y = -TARGET_PLAYER_HEIGHT / 2 + 0.05;
  fallbackBase.parent = avatarRoot;

  normalizeAvatar(avatarRoot);

  let disposed = false;

  const resolvedHeroId = isChampionId(options.player.selectedHeroId)
    ? options.player.selectedHeroId
    : DEFAULT_CHAMPION_ID;
  const heroModelUrl = getBaseChampionById(resolvedHeroId).modelUrl;

  if (heroModelUrl) {
    const { rootUrl, fileName } = splitModelPath(heroModelUrl);

    void SceneLoader.ImportMeshAsync("", rootUrl, fileName, options.scene)
      .then((result) => {
        if (disposed) {
          result.meshes.forEach((mesh) => {
            mesh.dispose();
          });
          result.skeletons.forEach((skeleton) => {
            skeleton.dispose();
          });
          result.animationGroups.forEach((group) => {
            group.dispose();
          });
          return;
        }

        let attachedMeshCount = 0;

        result.meshes.forEach((mesh) => {
          if (!mesh.parent) {
            mesh.parent = avatarRoot;
            attachedMeshCount += 1;
          }
        });

        if (attachedMeshCount === 0) {
          return;
        }

        fallbackBody.dispose();
        fallbackBase.dispose();
        normalizeAvatar(avatarRoot);
      })
      .catch(() => {
        // Mantém o placeholder quando o modelo remoto falhar.
      });
  }

  root.position = new Vector3(options.player.position.x, options.player.position.y, options.player.position.z);

  return {
    sessionId: options.player.sessionId,
    setPosition: (position) => {
      root.position.set(position.x, position.y, position.z);
    },
    getCameraTarget: () => {
      return new Vector3(root.position.x, root.position.y + CAMERA_TARGET_OFFSET_Y, root.position.z);
    },
    dispose: () => {
      if (disposed) {
        return;
      }

      disposed = true;
      root.dispose(false, true);
    }
  };
}
