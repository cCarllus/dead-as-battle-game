// Responsável por construir um player desacoplado em duas camadas: gameplay autoritativo e visual.
import {
  AbstractMesh,
  Color3,
  DynamicTexture,
  MeshBuilder,
  Scene,
  StandardMaterial,
  TransformNode,
  Vector3
} from "@babylonjs/core";
import {
  getHeroRuntimeCalibration,
  setHeroRuntimeCalibration
} from "../config/hero-calibration.store";
import {
  createAnimationController,
  type AnimationController
} from "../animation/animation-controller";
import type { AnimationCommand } from "../animation/animation-command";
import { loadHeroVisualAssets } from "../animation/animation-loader";
import {
  createDefaultAnimationGameplayState,
  type AnimationGameplayState
} from "../animation/animation-state";
import { resolveHeroAnimationConfig } from "../animation/animation-registry";
import { createCharacterRoot } from "../character/character-root";
import type { CharacterRuntimeConfig } from "../character/character-config";
import { resolveCharacterDefinition } from "../character/character-registry";
import {
  resolveHeroVisualConfig,
  type HeroVisualConfig
} from "../animation/hero-visual-config";
import type { MatchPlayerState } from "../../models/match-player.model";

type PlayerLabelHandle = {
  mesh: AbstractMesh;
  setText: (text: string, textColor: string) => void;
  dispose: () => void;
};

type HeroSkinHandle = {
  animationController: AnimationController | null;
  dispose: () => void;
};

type HeroRuntimeCalibration = {
  normalizedScale: number;
  normalizedOffsetY: number;
};

function createPlayerLabel(scene: Scene, sessionId: string): PlayerLabelHandle {
  const texture = new DynamicTexture(
    `matchPlayerLabelTexture_${sessionId}`,
    { width: 512, height: 128 },
    scene,
    true
  );
  texture.hasAlpha = true;

  const material = new StandardMaterial(`matchPlayerLabelMaterial_${sessionId}`, scene);
  material.diffuseTexture = texture;
  material.emissiveColor = Color3.White();
  material.specularColor = Color3.Black();
  material.backFaceCulling = false;

  const plane = MeshBuilder.CreatePlane(
    `matchPlayerLabel_${sessionId}`,
    { width: 2.6, height: 0.58 },
    scene
  );
  plane.material = material;
  plane.billboardMode = AbstractMesh.BILLBOARDMODE_ALL;
  plane.position = Vector3.Zero();
  plane.isPickable = false;

  return {
    mesh: plane,
    setText: (text, textColor) => {
      texture.clear();
      texture.drawText(
        text,
        null,
        88,
        "bold 56px Rajdhani",
        textColor,
        "transparent",
        true
      );
    },
    dispose: () => {
      if (!plane.isDisposed()) {
        plane.dispose(false, true);
      }
      material.dispose(true, true);
      texture.dispose();
    }
  };
}

function applyHeroVisualConfig(
  visualRoot: TransformNode,
  heroConfig: HeroVisualConfig,
  calibration?: HeroRuntimeCalibration | null,
  poseOffsetY = 0
): void {
  const safeScale =
    Number.isFinite(heroConfig.visualScale) && heroConfig.visualScale > 0
      ? heroConfig.visualScale
      : 1;
  const normalizedScale =
    calibration && Number.isFinite(calibration.normalizedScale) && calibration.normalizedScale > 0
      ? calibration.normalizedScale
      : 1;
  const normalizedOffsetY =
    calibration && Number.isFinite(calibration.normalizedOffsetY)
      ? calibration.normalizedOffsetY
      : 0;
  const finalScale = safeScale * normalizedScale;

  visualRoot.position.set(
    heroConfig.visualOffset.x,
    heroConfig.visualOffset.y + normalizedOffsetY + poseOffsetY,
    heroConfig.visualOffset.z
  );
  visualRoot.rotation.set(0, heroConfig.visualYaw, 0);
  visualRoot.scaling.set(finalScale, finalScale, finalScale);
}

function calculateNormalizedCalibration(
  skinRootNodes: TransformNode[],
  currentVisualScale: number,
  targetVisualHeight: number
): { normalizedScale: number; normalizedOffsetY: number } | null {
  if (skinRootNodes.length === 0) {
    return null;
  }

  const skinMeshes = skinRootNodes.flatMap((rootNode) => rootNode.getChildMeshes(false));
  if (skinMeshes.length === 0) {
    return null;
  }

  const min = new Vector3(Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY);
  const max = new Vector3(Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY);

  skinMeshes.forEach((mesh) => {
    mesh.computeWorldMatrix(true);
    const boundingBox = mesh.getBoundingInfo().boundingBox;
    const meshMin = boundingBox.minimumWorld;
    const meshMax = boundingBox.maximumWorld;

    min.x = Math.min(min.x, meshMin.x);
    min.y = Math.min(min.y, meshMin.y);
    min.z = Math.min(min.z, meshMin.z);
    max.x = Math.max(max.x, meshMax.x);
    max.y = Math.max(max.y, meshMax.y);
    max.z = Math.max(max.z, meshMax.z);
  });

  const height = max.y - min.y;
  if (!Number.isFinite(height) || height <= 0.000001) {
    return null;
  }

  const safeCurrentVisualScale =
    Number.isFinite(currentVisualScale) && currentVisualScale > 0 ? currentVisualScale : 1;
  const unscaledHeight = height / safeCurrentVisualScale;
  if (!Number.isFinite(unscaledHeight) || unscaledHeight <= 0.000001) {
    return null;
  }

  const normalizedScale = targetVisualHeight / unscaledHeight;
  if (!Number.isFinite(normalizedScale) || normalizedScale <= 0) {
    return null;
  }

  return {
    normalizedScale,
    normalizedOffsetY: (-min.y / safeCurrentVisualScale) * normalizedScale
  };
}

export type MatchPlayerEntity = {
  sessionId: string;
  gameplayRoot: TransformNode;
  collisionBody: AbstractMesh;
  groundCheck: TransformNode;
  wallCheckLeft: TransformNode;
  wallCheckRight: TransformNode;
  visualRoot: TransformNode;
  audioRoot: TransformNode;
  cameraTargetAnchor: TransformNode;
  nameplateNode: AbstractMesh;
  setTransform: (transform: { x: number; y: number; z: number; rotationY: number }) => void;
  getTransform: () => { x: number; y: number; z: number; rotationY: number };
  getCameraTarget: () => Vector3;
  getNameplateTarget: () => Vector3;
  getRuntimeConfig: () => CharacterRuntimeConfig;
  setNickname: (nickname: string) => void;
  setVisualStyle: (style: PlayerVisualStyle) => void;
  setAnimationGameplayState: (state: AnimationGameplayState) => void;
  playAnimationCommand: (command: AnimationCommand) => void;
  applyHeroConfig: (heroId: string) => void;
  dispose: () => void;
};

export type CreateMatchPlayerEntityOptions = {
  scene: Scene;
  player: MatchPlayerState;
  accentColorHex: string;
  labelColorHex: string;
  labelPrefix?: string;
};

export type PlayerVisualStyle = {
  accentColorHex: string;
  labelColorHex: string;
  labelPrefix?: string;
};

export function createMatchPlayerEntity(options: CreateMatchPlayerEntityOptions): MatchPlayerEntity {
  let runtimeConfig = resolveCharacterDefinition(options.player.heroId).runtimeConfig;
  const runtimeRig = createCharacterRoot({
    scene: options.scene,
    sessionId: options.player.sessionId,
    runtimeConfig
  });
  const gameplayRoot = runtimeRig.characterRoot;
  const visualRoot = runtimeRig.visualRoot;
  const collisionBody = runtimeRig.collisionBody;
  const collisionMaterial = collisionBody.material as StandardMaterial;
  collisionBody.isVisible = true;

  const label = createPlayerLabel(options.scene, options.player.sessionId);
  label.mesh.parent = runtimeRig.nameplateAnchor;
  label.mesh.isVisible = false;

  let isDisposed = false;
  let skinLoadVersion = 0;
  let skinHandle: HeroSkinHandle | null = null;
  let animationGameplayState = createDefaultAnimationGameplayState();
  let style: PlayerVisualStyle = {
    accentColorHex: options.accentColorHex,
    labelColorHex: options.labelColorHex,
    labelPrefix: options.labelPrefix
  };
  let nickname = options.player.nickname;
  let currentHeroConfig = resolveHeroVisualConfig(options.player.heroId);
  let currentHeroCalibration: HeroRuntimeCalibration | null = getHeroRuntimeCalibration(currentHeroConfig.id);

  const disposeSkinHandle = (): void => {
    if (!skinHandle) {
      return;
    }

    skinHandle.animationController?.dispose();
    skinHandle.dispose();
    skinHandle = null;
  };

  const syncAnimationFromGameplay = (): void => {
    skinHandle?.animationController?.syncFromGameplay(animationGameplayState);
  };

  const resolvePoseOffsetY = (): number => {
    switch (animationGameplayState.locomotionState) {
      case "Crouch":
        return currentHeroConfig.crouchVisualOffsetY;
      case "LedgeHang":
      case "Hanging":
        return currentHeroConfig.ledgeHangVisualOffsetY;
      case "LedgeClimb":
      case "ClimbingUp":
      case "MantlingLowObstacle":
        return currentHeroConfig.ledgeClimbVisualOffsetY;
      default:
        return 0;
    }
  };

  const applyCurrentVisualPose = (): void => {
    const poseOffsetY = resolvePoseOffsetY();
    applyHeroVisualConfig(visualRoot, currentHeroConfig, currentHeroCalibration, poseOffsetY);
  };

  const applyDisplay = (): void => {
    const accentColor = Color3.FromHexString(style.accentColorHex);
    collisionMaterial.diffuseColor = accentColor;
    collisionMaterial.emissiveColor = accentColor.scale(0.22);
    collisionMaterial.specularColor = accentColor.scale(0.35);

    label.setText(`${style.labelPrefix ?? ""}${nickname}`, style.labelColorHex);
  };

  const applyHeroSkin = (heroConfig: HeroVisualConfig): void => {
    runtimeConfig = resolveCharacterDefinition(heroConfig.id).runtimeConfig;
    const animationConfig = resolveHeroAnimationConfig(heroConfig.id);
    currentHeroConfig = heroConfig;
    currentHeroCalibration = getHeroRuntimeCalibration(heroConfig.id);
    applyCurrentVisualPose();
    skinLoadVersion += 1;
    const currentLoadVersion = skinLoadVersion;
    disposeSkinHandle();
    collisionBody.isVisible = true;

    if (!heroConfig.modelUrl) {
      return;
    }

    void loadHeroVisualAssets({
      scene: options.scene,
      visualRoot,
      modelUrl: heroConfig.modelUrl,
      heroId: heroConfig.id,
      sessionId: options.player.sessionId,
      loadVersion: currentLoadVersion,
      animationConfig,
      animationOverrideBaseUrl: heroConfig.animationOverrideBaseUrl
    })
      .then((loadedVisual) => {
        if (isDisposed || currentLoadVersion !== skinLoadVersion) {
          loadedVisual.dispose();
          return;
        }

        const runtimeCalibration = calculateNormalizedCalibration(
          loadedVisual.rootNodes,
          visualRoot.scaling.x,
          runtimeConfig.colliderHeight
        );
        const effectiveCalibration = runtimeCalibration ?? currentHeroCalibration;
        if (runtimeCalibration) {
          setHeroRuntimeCalibration(heroConfig.id, runtimeCalibration);
        }
        currentHeroCalibration = effectiveCalibration;
        applyCurrentVisualPose();

        if (isDisposed || currentLoadVersion !== skinLoadVersion) {
          loadedVisual.dispose();
          return;
        }

        const animationController =
          loadedVisual.embeddedAnimationGroups.length > 0 ||
          Object.keys(loadedVisual.sharedAnimationGroupsByCommand).length > 0 ||
          Object.keys(loadedVisual.overrideAnimationGroupsByCommand).length > 0
            ? createAnimationController({
                embeddedAnimationGroups: loadedVisual.embeddedAnimationGroups,
                sharedAnimationGroupsByCommand: loadedVisual.sharedAnimationGroupsByCommand,
                overrideAnimationGroupsByCommand: loadedVisual.overrideAnimationGroupsByCommand,
                animationConfig,
                loggerPrefix: `[animation][hero:${heroConfig.id}][player:${options.player.sessionId}]`
              })
            : null;

        skinHandle = {
          animationController,
          dispose: loadedVisual.dispose
        };

        collisionBody.isVisible = false;
        syncAnimationFromGameplay();
      })
      .catch((error) => {
        console.warn(
          `[animation][hero:${heroConfig.id}][player:${options.player.sessionId}] Failed to load hero visual assets from '${heroConfig.modelUrl}'.`,
          error
        );
      });
  };

  applyDisplay();
  applyHeroSkin(currentHeroConfig);

  gameplayRoot.position.set(options.player.x, options.player.y, options.player.z);
  gameplayRoot.rotation.y = options.player.rotationY;

  return {
    sessionId: options.player.sessionId,
    gameplayRoot,
    collisionBody,
    groundCheck: runtimeRig.groundCheck,
    wallCheckLeft: runtimeRig.wallCheckLeft,
    wallCheckRight: runtimeRig.wallCheckRight,
    visualRoot,
    audioRoot: runtimeRig.audioRoot,
    cameraTargetAnchor: runtimeRig.cameraTargetAnchor,
    nameplateNode: label.mesh,
    setTransform: (transform) => {
      gameplayRoot.position.set(transform.x, transform.y, transform.z);
      gameplayRoot.rotation.y = transform.rotationY;
    },
    getTransform: () => {
      return {
        x: gameplayRoot.position.x,
        y: gameplayRoot.position.y,
        z: gameplayRoot.position.z,
        rotationY: gameplayRoot.rotation.y
      };
    },
    getCameraTarget: () => {
      return runtimeRig.cameraTargetAnchor.getAbsolutePosition().clone();
    },
    getNameplateTarget: () => {
      return runtimeRig.nameplateAnchor.getAbsolutePosition().clone();
    },
    getRuntimeConfig: () => {
      return {
        ...runtimeConfig,
        locomotion: { ...runtimeConfig.locomotion },
        ledge: { ...runtimeConfig.ledge }
      };
    },
    setNickname: (nextNickname) => {
      nickname = nextNickname;
      applyDisplay();
    },
    setVisualStyle: (nextStyle) => {
      style = {
        accentColorHex: nextStyle.accentColorHex,
        labelColorHex: nextStyle.labelColorHex,
        labelPrefix: nextStyle.labelPrefix
      };
      applyDisplay();
    },
    setAnimationGameplayState: (nextState) => {
      animationGameplayState = {
        isDead: nextState.isDead,
        isMoving: nextState.isMoving,
        movementDirection: nextState.movementDirection,
        isSprinting: nextState.isSprinting,
        isJumping: nextState.isJumping,
        isCrouching: nextState.isCrouching,
        isRolling: nextState.isRolling,
        isWallRunning: nextState.isWallRunning,
        isUltimateActive: nextState.isUltimateActive,
        isBlocking: nextState.isBlocking,
        attackComboIndex: nextState.attackComboIndex,
        isHitReacting: nextState.isHitReacting,
        locomotionState: nextState.locomotionState,
        restartCommand: nextState.restartCommand ?? null
      };
      applyCurrentVisualPose();
      syncAnimationFromGameplay();
    },
    playAnimationCommand: (command) => {
      skinHandle?.animationController?.play(command);
    },
    applyHeroConfig: (heroId) => {
      applyHeroSkin(resolveHeroVisualConfig(heroId));
    },
    dispose: () => {
      if (isDisposed) {
        return;
      }

      isDisposed = true;
      skinLoadVersion += 1;
      disposeSkinHandle();
      runtimeRig.dispose();
    }
  };
}
