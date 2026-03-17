// Responsável por construir um player desacoplado em duas camadas: gameplay autoritativo e visual.
import {
  AbstractMesh,
  Color3,
  DynamicTexture,
  MeshBuilder,
  Scene,
  StandardMaterial,
  TransformNode,
  Vector3,
  type Observer
} from "@babylonjs/core";
import {
  getHeroRuntimeCalibration,
  setHeroRuntimeCalibration
} from "../config/hero-calibration.store";
import {
  createAnimationController,
  type AnimationController
} from "../animation/animation-controller";
import {
  isVisualOffsetEnabled,
  resolveAnimationContainmentMode
} from "../animation/animation-motion-containment";
import type { AnimationCommand } from "../animation/animation-command";
import { loadHeroVisualAssets } from "../animation/animation-loader";
import {
  createDefaultAnimationGameplayState,
  type AnimationGameplayState
} from "../animation/animation-state";
import { resolveHeroAnimationConfig } from "../animation/animation-registry";
import {
  createCharacterRoot,
  syncCharacterRuntimeRigAnchors
} from "../character/character-root";
import {
  cloneCharacterRuntimeConfig,
  type CharacterRuntimeConfig
} from "../character/character-config";
import { resolveCharacterDefinition } from "../character/character-registry";
import {
  resolveHeroVisualConfig,
  type HeroVisualConfig
} from "../animation/hero-visual-config";
import { createColliderDebug } from "../debug/collider-debug";
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

function isColliderDebugEnabled(): boolean {
  const globals = globalThis as {
    __DAB_COLLIDER_DEBUG__?: unknown;
    __DAB_ADVANCED_MOVEMENT_DEBUG__?: unknown;
  };
  if (globals.__DAB_COLLIDER_DEBUG__ === true) {
    return true;
  }

  if (globals.__DAB_COLLIDER_DEBUG__ === false) {
    return false;
  }

  if (globals.__DAB_ADVANCED_MOVEMENT_DEBUG__ === true) {
    return true;
  }

  if (typeof window !== "undefined") {
    try {
      const params = new URLSearchParams(window.location.search);
      return params.get("debugCollider") === "1";
    } catch {
      return false;
    }
  }

  return false;
}

function applyHeroVisualConfig(
  visualRoot: TransformNode,
  heroConfig: HeroVisualConfig,
  calibration?: HeroRuntimeCalibration | null,
  poseOffset: Vector3 = Vector3.Zero()
): Vector3 {
  const standingVisualOffset = heroConfig.visualAlignment.standingVisualOffset;
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

  const resolvedVisualOffset = new Vector3(
    standingVisualOffset.x,
    standingVisualOffset.y + normalizedOffsetY + poseOffset.y,
    standingVisualOffset.z
  );
  resolvedVisualOffset.x += poseOffset.x;
  resolvedVisualOffset.z += poseOffset.z;

  visualRoot.position.copyFrom(resolvedVisualOffset);
  visualRoot.rotation.set(0, heroConfig.visualYaw, 0);
  visualRoot.scaling.set(finalScale, finalScale, finalScale);
  return resolvedVisualOffset;
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
  const rootDebugBody = runtimeRig.rootDebugBody;
  const collisionMaterial = collisionBody.material as StandardMaterial;
  const rootDebugMaterial = rootDebugBody.material as StandardMaterial;
  collisionBody.isVisible = true;
  const colliderDebug = createColliderDebug({
    scene: options.scene,
    characterRoot: gameplayRoot,
    visualRoot,
    collisionBody,
    runtimeConfig
  });

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
  let expectedVisualRootOffset = Vector3.Zero();
  let lastContainmentDebugAtMs = 0;
  let visualGroundingObserver: Observer<Scene> | null = null;
  let lastColliderDebugEnabled = false;

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

  const applyColliderDebugState = (): void => {
    const debugEnabled = isColliderDebugEnabled();
    const hasVisualSkin = !!skinHandle?.animationController;
    rootDebugBody.position.copyFrom(collisionBody.position);
    rootDebugBody.scaling.copyFrom(collisionBody.scaling);

    collisionBody.isVisible = debugEnabled || !hasVisualSkin;
    rootDebugBody.isVisible = debugEnabled;
    colliderDebug.setEnabled(debugEnabled);
    collisionMaterial.wireframe = debugEnabled;
    collisionMaterial.disableLighting = debugEnabled;
    collisionMaterial.alpha = debugEnabled ? 0.65 : 0.28;
    rootDebugMaterial.alpha = debugEnabled ? 0.9 : 0;

    if (debugEnabled) {
      collisionMaterial.diffuseColor = new Color3(0.08, 0.95, 0.22);
      collisionMaterial.emissiveColor = new Color3(0.1, 0.35, 0.12);
      collisionMaterial.specularColor = new Color3(0, 0, 0);
    } else {
      const accentColor = Color3.FromHexString(style.accentColorHex);
      collisionMaterial.diffuseColor = accentColor;
      collisionMaterial.emissiveColor = accentColor.scale(0.22);
      collisionMaterial.specularColor = accentColor.scale(0.35);
    }

    if (debugEnabled !== lastColliderDebugEnabled) {
      lastColliderDebugEnabled = debugEnabled;
      console.debug("[physics][collider-debug]", {
        sessionId: options.player.sessionId,
        enabled: debugEnabled,
        standingCollider: runtimeConfig.collider.standing,
        crouchCollider: runtimeConfig.collider.crouch,
        currentCollider: {
          positionY: Math.round(collisionBody.position.y * 1000) / 1000,
          scaleY: Math.round(collisionBody.scaling.y * 1000) / 1000
        },
        visualAlignment: {
          standingVisualOffsetY: currentHeroConfig.visualAlignment.standingVisualOffset.y,
          crouchVisualOffsetY: currentHeroConfig.visualAlignment.crouchVisualOffsetY
        }
      });
    }
  };

  const isGroundAnchoredVisualState = (): boolean => {
    switch (animationGameplayState.locomotionState) {
      case "Idle":
      case "Grounded":
      case "Walk":
      case "Run":
      case "Running":
      case "Crouch":
      case "Rolling":
        return true;
      default:
        return false;
    }
  };

  const resolvePoseOffset = (): Vector3 => {
    const isOffsetEnabled = isVisualOffsetEnabled();
    if (!isOffsetEnabled) {
      return Vector3.Zero();
    }

    switch (animationGameplayState.locomotionState) {
      case "Crouch":
        return new Vector3(0, currentHeroConfig.visualAlignment.crouchVisualOffsetY, 0);
      case "LedgeHang":
      case "Hanging":
        return new Vector3(
          currentHeroConfig.visualAlignment.hangVisualOffset.x,
          currentHeroConfig.visualAlignment.ledgeHangVisualOffsetY +
            currentHeroConfig.visualAlignment.hangVisualOffset.y,
          currentHeroConfig.visualAlignment.hangVisualOffset.z
        );
      case "LedgeClimb":
      case "ClimbingUp":
      case "MantlingLowObstacle":
        return new Vector3(0, currentHeroConfig.visualAlignment.ledgeClimbVisualOffsetY, 0);
      default:
        return Vector3.Zero();
    }
  };

  const debugVisualContainment = (): void => {
    const explicitDebugEnabled = (globalThis as { __DAB_ADVANCED_MOVEMENT_DEBUG__?: unknown })
      .__DAB_ADVANCED_MOVEMENT_DEBUG__;
    if (explicitDebugEnabled !== true) {
      return;
    }

    const now = Date.now();
    if (now - lastContainmentDebugAtMs < 160) {
      return;
    }
    lastContainmentDebugAtMs = now;

    const rootToMeshOffset = visualRoot.position.clone();
    const residual = rootToMeshOffset.subtract(expectedVisualRootOffset);
    const horizontalResidual = Math.hypot(residual.x, residual.z);
    const verticalResidual = Math.abs(residual.y);

    console.debug("[animation][containment][visual-metrics]", {
      sessionId: options.player.sessionId,
      locomotionState: animationGameplayState.locomotionState ?? "Idle",
      clip: skinHandle?.animationController?.getCurrentCommand() ?? "none",
      containmentMode: resolveAnimationContainmentMode(),
      visualOffsetEnabled: isVisualOffsetEnabled(),
      rootToMeshOffset: {
        x: Math.round(rootToMeshOffset.x * 1000) / 1000,
        y: Math.round(rootToMeshOffset.y * 1000) / 1000,
        z: Math.round(rootToMeshOffset.z * 1000) / 1000
      },
      expectedVisualOffset: {
        x: Math.round(expectedVisualRootOffset.x * 1000) / 1000,
        y: Math.round(expectedVisualRootOffset.y * 1000) / 1000,
        z: Math.round(expectedVisualRootOffset.z * 1000) / 1000
      },
      visualHeightError: Math.round(verticalResidual * 1000) / 1000,
      driftVerticalResidual: Math.round(verticalResidual * 1000) / 1000,
      driftHorizontalResidual: Math.round(horizontalResidual * 1000) / 1000
    });
  };

  const applyGroundAnchoringCorrection = (): void => {
    if (!isGroundAnchoredVisualState()) {
      visualRoot.position.copyFrom(expectedVisualRootOffset);
      return;
    }

    const meshes = visualRoot.getChildMeshes(false);
    if (meshes.length === 0) {
      visualRoot.position.copyFrom(expectedVisualRootOffset);
      return;
    }

    visualRoot.position.copyFrom(expectedVisualRootOffset);
    visualRoot.computeWorldMatrix(true);

    const bounds = visualRoot.getHierarchyBoundingVectors(true);
    const targetFloorY =
      gameplayRoot.getAbsolutePosition().y - Math.max(0, runtimeConfig.collider.collisionClearanceY);
    const floorDelta = bounds.min.y - targetFloorY;

    if (Math.abs(floorDelta) <= currentHeroConfig.visualAlignment.compactGroundingToleranceY) {
      return;
    }

    const clampedCorrectionY = Math.max(
      -currentHeroConfig.visualAlignment.compactGroundingMaxCorrectionY,
      Math.min(currentHeroConfig.visualAlignment.compactGroundingMaxCorrectionY, floorDelta)
    );
    visualRoot.position.y -= clampedCorrectionY;
    visualRoot.computeWorldMatrix(true);
  };

  const applyCurrentVisualPose = (): void => {
    const poseOffset = resolvePoseOffset();
    expectedVisualRootOffset = applyHeroVisualConfig(
      visualRoot,
      currentHeroConfig,
      currentHeroCalibration,
      poseOffset
    );
    applyGroundAnchoringCorrection();
    debugVisualContainment();
  };

  visualGroundingObserver = options.scene.onBeforeRenderObservable.add(() => {
    if (isDisposed) {
      return;
    }

    if (!skinHandle?.animationController) {
      applyColliderDebugState();
      colliderDebug.render();
      return;
    }

    applyColliderDebugState();
    applyGroundAnchoringCorrection();
    colliderDebug.render();
  });

  const applyDisplay = (): void => {
    applyColliderDebugState();

    label.setText(`${style.labelPrefix ?? ""}${nickname}`, style.labelColorHex);
  };

  const applyHeroSkin = (heroConfig: HeroVisualConfig): void => {
    runtimeConfig = resolveCharacterDefinition(heroConfig.id).runtimeConfig;
    collisionBody.scaling.set(1, 1, 1);
    collisionBody.position.y = runtimeConfig.collider.standing.centerY;
    rootDebugBody.scaling.set(1, 1, 1);
    rootDebugBody.position.y = runtimeConfig.collider.standing.centerY;
    syncCharacterRuntimeRigAnchors(runtimeRig, runtimeConfig);
    colliderDebug.syncRuntimeConfig(runtimeConfig);
    const animationConfig = resolveHeroAnimationConfig(heroConfig.id);
    currentHeroConfig = heroConfig;
    currentHeroCalibration = getHeroRuntimeCalibration(heroConfig.id);
    applyCurrentVisualPose();
    skinLoadVersion += 1;
    const currentLoadVersion = skinLoadVersion;
    disposeSkinHandle();
    applyColliderDebugState();

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
          runtimeConfig.collider.standing.height
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

        applyColliderDebugState();
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
      return cloneCharacterRuntimeConfig(runtimeConfig);
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
        activeSkillId: nextState.activeSkillId,
        isHitReacting: nextState.isHitReacting,
        locomotionState: nextState.locomotionState,
        restartCommand: nextState.restartCommand ?? null
      };
      applyCurrentVisualPose();
      syncAnimationFromGameplay();
      debugVisualContainment();
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
      if (visualGroundingObserver) {
        options.scene.onBeforeRenderObservable.remove(visualGroundingObserver);
        visualGroundingObserver = null;
      }
      colliderDebug.dispose();
      runtimeRig.dispose();
    }
  };
}
