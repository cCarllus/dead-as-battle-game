// Responsável por orquestrar a cena da partida global com arquitetura modular de gameplay (movimento, câmera, colisão, iluminação).
import {
  Color4,
  Engine,
  Matrix,
  Scene,
  Vector3,
  type AbstractMesh,
  type ArcRotateCamera,
  type TransformNode
} from "@babylonjs/core";
import type {
  MatchCombatUltimatePayload,
  MatchPlayerLocomotionState,
  MatchPlayerState,
  MatchPlayerWallRunSide
} from "../../models/match-player.model";
import { createCharacterAudioController, type CharacterAudioController } from "../audio/character-audio-controller";
import { resolveLocomotionCameraHooks } from "../camera/locomotion-camera-hooks";
import { createMotionLinesEffect } from "../effects/motion-lines";
import { createWindParticlesSystem } from "../effects/wind-particles";
import { createEffectManager } from "../effects/effect-manager";
import { createCameraController } from "../controllers/camera.controller";
import {
  createCharacterLocomotionSystem,
  type CharacterLocomotionSystem
} from "../locomotion/character-locomotion-system";
import { createGroundedSystem } from "../locomotion/grounded-system";
import { createCharacterLeanSystem } from "../movement/character-lean";
import { MAX_FRAME_DELTA_SECONDS } from "../physics/player-physics";
import { createCollisionSystem, type CollisionSystem } from "../systems/collision.system";
import { createCombatInputSystem } from "../systems/combat-input.system";
import { createLightingSystem } from "../systems/lighting.system";
import { GLOBAL_MATCH_MAP_URL, loadGlobalMatchMap } from "../systems/map-loader.system";
import { createMovementInputSystem } from "../systems/movement-input.system";
import { createPlayerViewManager } from "../systems/player-view-manager";
import { createPointerLockSystem } from "../systems/pointer-lock.system";

const LOCAL_MOVEMENT_SYNC_INTERVAL_MS = 50;
const LOCAL_MOVEMENT_SYNC_THRESHOLD = 0.015;
const LOCAL_SPRINT_INPUT_SYNC_INTERVAL_MS = 50;
const LOCAL_ATTACK_INTERVAL_MS = 300;
const LOCAL_COMBO_RESET_TIME_MS = 1000;
const LOCAL_ATTACK_ANIMATION_WINDOW_MS = 260;
const LOCAL_ATTACK_INPUT_BUFFER_MS = 120;
const LOCAL_BLOCK_MAX_HOLD_MS = 2500;

export type GlobalMatchSceneOptions = {
  canvas: HTMLCanvasElement;
  localSessionId: string;
  initialPlayers?: MatchPlayerState[];
  onLocalPlayerMoved?: (position: {
    x: number;
    y: number;
    z: number;
    rotationY: number;
    locomotionState: MatchPlayerLocomotionState;
    isCrouching: boolean;
    isRolling: boolean;
    isWallRunning: boolean;
    wallRunSide: MatchPlayerWallRunSide;
    verticalVelocity: number;
  }) => void;
  onLocalSprintIntentChanged?: (intent: { isShiftPressed: boolean; isForwardPressed: boolean }) => void;
  onLocalAttackRequested?: () => void;
  onLocalBlockStartRequested?: () => void;
  onLocalBlockEndRequested?: () => void;
};

export type GlobalMatchSceneHandle = {
  setPlayers: (players: MatchPlayerState[]) => void;
  addPlayer: (player: MatchPlayerState) => void;
  updatePlayer: (player: MatchPlayerState) => void;
  removePlayer: (sessionId: string) => void;
  setTeamMemberUserIds: (userIds: string[]) => void;
  setFlyModeEnabled: (enabled: boolean) => void;
  toggleFlyMode: () => boolean;
  isFlyModeEnabled: () => boolean;
  setInputEnabled: (enabled: boolean) => void;
  requestPointerLock: () => void;
  exitPointerLock: () => void;
  isPointerLocked: () => boolean;
  onPointerLockChanged: (listener: (locked: boolean) => void) => () => void;
  triggerPlayerUltimateEffect: (payload: Pick<MatchCombatUltimatePayload, "sessionId" | "characterId" | "durationMs">) => void;
  getPlayerScreenPosition: (sessionId: string) => { x: number; y: number } | null;
  getPlayerNameplateScreenPosition: (sessionId: string) => { x: number; y: number } | null;
  getPlayerWorldPosition: (sessionId: string) => { x: number; y: number; z: number } | null;
  getCameraGroundForward: () => { x: number; z: number };
  dispose: () => void;
};

type LocalGameplayRuntime = {
  collisionSystem: CollisionSystem;
  locomotionSystem: CharacterLocomotionSystem;
  audioController: CharacterAudioController;
  ownerCollisionBodyId: number;
  ownerHeroId: string;
};

function positionDistanceSquared(
  left: { x: number; y: number; z: number },
  right: { x: number; y: number; z: number }
): number {
  const dx = left.x - right.x;
  const dy = left.y - right.y;
  const dz = left.z - right.z;
  return dx * dx + dy * dy + dz * dz;
}

function shouldHideLocalVisualForCamera(
  visualRoot: TransformNode,
  cameraPosition: Vector3
): boolean {
  const meshes = visualRoot.getChildMeshes(false);
  if (meshes.length === 0) {
    return false;
  }

  const bounds = visualRoot.getHierarchyBoundingVectors(true);
  const size = bounds.max.subtract(bounds.min);
  const radius = Math.max(size.length() * 0.5, 0.001);
  const center = bounds.min.add(bounds.max).scale(0.5);
  const dx = center.x - cameraPosition.x;
  const dy = center.y - cameraPosition.y;
  const dz = center.z - cameraPosition.z;
  const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

  return distance <= radius * 1.05;
}

function resolveProjectedPoint(
  scene: Scene,
  camera: ArcRotateCamera,
  engine: Engine,
  worldPosition: Vector3
): { x: number; y: number } | null {
  const renderWidth = engine.getRenderWidth(true);
  const renderHeight = engine.getRenderHeight(true);
  if (renderWidth <= 0 || renderHeight <= 0) {
    return null;
  }

  const viewport = camera.viewport.toGlobal(renderWidth, renderHeight);
  const projected = Vector3.Project(worldPosition, Matrix.Identity(), scene.getTransformMatrix(), viewport);

  if (projected.z < 0 || projected.z > 1) {
    return null;
  }

  if (projected.x < 0 || projected.x > renderWidth || projected.y < 0 || projected.y > renderHeight) {
    return null;
  }

  return {
    x: projected.x,
    y: projected.y
  };
}

function resolveSafeAttackComboIndex(value: number): 0 | 1 | 2 | 3 {
  if (!Number.isFinite(value) || value <= 0) {
    return 0;
  }

  const clamped = Math.max(1, Math.min(3, Math.floor(value)));
  return clamped as 1 | 2 | 3;
}

export async function createGlobalMatchScene(
  options: GlobalMatchSceneOptions
): Promise<GlobalMatchSceneHandle> {
  const engine = new Engine(options.canvas, true, {
    antialias: true,
    preserveDrawingBuffer: false,
    stencil: true
  });

  const scene = new Scene(engine);
  scene.clearColor = new Color4(0.015, 0.03, 0.06, 1);

  const cameraController = createCameraController({ scene });
  const camera = cameraController.camera;
  const lightingSystem = createLightingSystem({ scene });
  const windParticles = createWindParticlesSystem(scene);
  const motionLines = createMotionLinesEffect(options.canvas);
  const characterLean = createCharacterLeanSystem();

  const mapHandle = await loadGlobalMatchMap(scene, GLOBAL_MATCH_MAP_URL);
  const mapMeshIds = new Set<number>(mapHandle.meshes.map((mesh) => mesh.uniqueId));
  lightingSystem.setMapMeshes(mapHandle.meshes);

  const playerViewManager = createPlayerViewManager({
    scene,
    localSessionId: options.localSessionId
  });

  const effectManager = createEffectManager({
    scene,
    resolvePlayerEffectAnchor: (sessionId) => {
      return playerViewManager.getPlayerEffectAnchor(sessionId);
    }
  });

  const movementInput = createMovementInputSystem();
  let inputEnabled = true;
  const pointerLockSystem = createPointerLockSystem({
    canvas: options.canvas,
    canRequestLock: () => inputEnabled
  });
  const pointerLockChangeListeners = new Set<(locked: boolean) => void>();

  let flyModeEnabled = false;
  let pointerLocked = pointerLockSystem.isLocked();
  let lastMovementSyncAtMs = 0;
  let lastSyncedLocalMovement: {
    x: number;
    y: number;
    z: number;
    rotationY: number;
    locomotionState: MatchPlayerLocomotionState;
    isCrouching: boolean;
    isRolling: boolean;
    isWallRunning: boolean;
    wallRunSide: MatchPlayerWallRunSide;
    verticalVelocity: number;
  } | null = null;
  let lastSprintInputSyncAtMs = 0;
  let lastSentSprintIntent: { isShiftPressed: boolean; isForwardPressed: boolean } | null = null;
  let isLocalVisualHiddenForCamera = false;

  let localGameplayRuntime: LocalGameplayRuntime | null = null;

  let localPredictedComboChainIndex: 0 | 1 | 2 | 3 = 0;
  let localPredictedActiveAttackComboIndex: 0 | 1 | 2 | 3 = 0;
  let localPredictedLastAttackAtMs = 0;
  let localPredictedAttackUntilMs = 0;
  let localBufferedAttackUntilMs = 0;
  let localPredictedBlockActive = false;
  let localPredictedBlockStartedAtMs = 0;

  const resetPredictedCombatState = (): void => {
    localPredictedComboChainIndex = 0;
    localPredictedActiveAttackComboIndex = 0;
    localPredictedLastAttackAtMs = 0;
    localPredictedAttackUntilMs = 0;
    localBufferedAttackUntilMs = 0;
    localPredictedBlockActive = false;
    localPredictedBlockStartedAtMs = 0;
  };

  const disposeLocalGameplayRuntime = (): void => {
    if (!localGameplayRuntime) {
      return;
    }

    localGameplayRuntime.audioController.dispose();
    localGameplayRuntime.collisionSystem.dispose();
    localGameplayRuntime = null;
  };

  const ensureLocalGameplayRuntime = (): LocalGameplayRuntime | null => {
    const localView = playerViewManager.getLocalPlayerView();
    if (!localView) {
      disposeLocalGameplayRuntime();
      return null;
    }

    if (
      localGameplayRuntime &&
      localGameplayRuntime.ownerCollisionBodyId === localView.collisionBody.uniqueId &&
      localGameplayRuntime.ownerHeroId === localView.heroId
    ) {
      return localGameplayRuntime;
    }

    disposeLocalGameplayRuntime();

    const collisionSystem = createCollisionSystem({
      scene,
      gameplayRoot: localView.gameplayRoot,
      collisionBody: localView.collisionBody
    });

    collisionSystem.configureStaticMeshes(mapHandle.meshes);
    const runtimeConfig = localView.getRuntimeConfig();

    const groundedSystem = createGroundedSystem({
      scene,
      runtimeConfig,
      isGroundMesh: (mesh: AbstractMesh) => {
        return mapMeshIds.has(mesh.uniqueId);
      }
    });

    const locomotionSystem = createCharacterLocomotionSystem({
      runtimeConfig,
      collisionSystem,
      groundedSystem
    });
    const audioController = createCharacterAudioController();

    localGameplayRuntime = {
      collisionSystem,
      locomotionSystem,
      audioController,
      ownerCollisionBodyId: localView.collisionBody.uniqueId,
      ownerHeroId: localView.heroId
    };

    return localGameplayRuntime;
  };

  const setPlayers = (players: MatchPlayerState[]): void => {
    playerViewManager.syncPlayers(players);
    ensureLocalGameplayRuntime();
  };

  const addPlayer = (player: MatchPlayerState): void => {
    playerViewManager.addPlayer(player);
    ensureLocalGameplayRuntime();
  };

  const updatePlayer = (player: MatchPlayerState): void => {
    playerViewManager.updatePlayer(player);
    ensureLocalGameplayRuntime();
  };

  const removePlayer = (sessionId: string): void => {
    effectManager.stopEffectsForPlayer(sessionId);
    playerViewManager.removePlayer(sessionId);

    if (sessionId === options.localSessionId) {
      disposeLocalGameplayRuntime();
      resetPredictedCombatState();
    }
  };

  const setTeamMemberUserIds = (userIds: string[]): void => {
    playerViewManager.setTeamMemberUserIds(userIds);
  };

  const setFlyModeEnabled = (enabled: boolean): void => {
    if (flyModeEnabled === enabled) {
      return;
    }

    flyModeEnabled = enabled;
  };

  const toggleFlyMode = (): boolean => {
    setFlyModeEnabled(!flyModeEnabled);
    return flyModeEnabled;
  };

  const requestPointerLock = (): void => {
    pointerLockSystem.requestLock();
  };

  const exitPointerLock = (): void => {
    pointerLockSystem.releaseLock();
  };

  const onMouseMove = (event: MouseEvent): void => {
    if (!pointerLocked || !inputEnabled) {
      return;
    }

    cameraController.addPointerDelta(event.movementX, event.movementY);
  };

  const canUseCombatInput = (): boolean => {
    const localPlayerState = playerViewManager.getLocalPlayerState();
    const now = Date.now();
    if (!inputEnabled || !localPlayerState || !localPlayerState.isAlive) {
      return false;
    }

    if (localPlayerState.isGuardBroken || now < localPlayerState.stunUntil) {
      return false;
    }

    return true;
  };

  const commitLocalAttackIntent = (now: number): void => {
    const shouldResetCombo =
      localPredictedComboChainIndex <= 0 ||
      now - localPredictedLastAttackAtMs > LOCAL_COMBO_RESET_TIME_MS;

    if (shouldResetCombo) {
      localPredictedComboChainIndex = 1;
    } else {
      localPredictedComboChainIndex =
        ((localPredictedComboChainIndex % 3) + 1) as 1 | 2 | 3;
    }

    localPredictedActiveAttackComboIndex = localPredictedComboChainIndex;
    localPredictedLastAttackAtMs = now;
    localPredictedAttackUntilMs = now + LOCAL_ATTACK_ANIMATION_WINDOW_MS;
    localBufferedAttackUntilMs = 0;
    localPredictedBlockActive = false;
    localPredictedBlockStartedAtMs = 0;
    options.onLocalAttackRequested?.();
  };

  const handleLocalAttackIntent = (): void => {
    const now = Date.now();
    const localPlayerState = playerViewManager.getLocalPlayerState();
    if (!localPlayerState || !localPlayerState.isAlive) {
      return;
    }

    if (localPlayerState.isGuardBroken || now < localPlayerState.stunUntil) {
      return;
    }

    const elapsedSinceLastAttack = now - localPredictedLastAttackAtMs;
    if (elapsedSinceLastAttack < LOCAL_ATTACK_INTERVAL_MS) {
      const remainingCooldown = LOCAL_ATTACK_INTERVAL_MS - elapsedSinceLastAttack;
      if (remainingCooldown <= LOCAL_ATTACK_INPUT_BUFFER_MS) {
        localBufferedAttackUntilMs = now + LOCAL_ATTACK_INPUT_BUFFER_MS;
      }
      return;
    }

    commitLocalAttackIntent(now);
  };

  const handleLocalBlockStartIntent = (): void => {
    const now = Date.now();
    const localPlayerState = playerViewManager.getLocalPlayerState();
    if (!localPlayerState || !localPlayerState.isAlive) {
      return;
    }

    if (localPlayerState.isGuardBroken || now < localPlayerState.stunUntil) {
      return;
    }

    if (now < localPredictedAttackUntilMs) {
      return;
    }

    if (localPredictedBlockActive) {
      return;
    }

    localPredictedBlockActive = true;
    localPredictedBlockStartedAtMs = now;
    options.onLocalBlockStartRequested?.();
  };

  const handleLocalBlockEndIntent = (): void => {
    if (!localPredictedBlockActive) {
      options.onLocalBlockEndRequested?.();
      return;
    }

    localPredictedBlockActive = false;
    localPredictedBlockStartedAtMs = 0;
    options.onLocalBlockEndRequested?.();
  };

  const combatInput = createCombatInputSystem({
    canProcessInput: canUseCombatInput,
    onAttackStart: handleLocalAttackIntent,
    onBlockStart: handleLocalBlockStartIntent,
    onBlockEnd: handleLocalBlockEndIntent
  });

  const setInputEnabled = (enabled: boolean): void => {
    inputEnabled = enabled;
    movementInput.setEnabled(enabled);
    pointerLockSystem.setEnabled(enabled);
    combatInput.setEnabled(enabled);

    if (!enabled) {
      resetPredictedCombatState();
      localGameplayRuntime?.locomotionSystem.reset();
      characterLean.reset(playerViewManager.getLocalPlayerView()?.visualRoot ?? null);
      exitPointerLock();
    }
  };

  const maybeEmitLocalMovement = (movement: {
    x: number;
    y: number;
    z: number;
    rotationY: number;
    locomotionState: MatchPlayerLocomotionState;
    isCrouching: boolean;
    isRolling: boolean;
    isWallRunning: boolean;
    wallRunSide: MatchPlayerWallRunSide;
    verticalVelocity: number;
  }): void => {
    if (!options.onLocalPlayerMoved) {
      return;
    }

    const nowMs = Date.now();
    const elapsedMs = nowMs - lastMovementSyncAtMs;

    const didTransformChange =
      !lastSyncedLocalMovement ||
      positionDistanceSquared(movement, lastSyncedLocalMovement) >=
        LOCAL_MOVEMENT_SYNC_THRESHOLD * LOCAL_MOVEMENT_SYNC_THRESHOLD ||
      Math.abs(movement.rotationY - lastSyncedLocalMovement.rotationY) >= 0.01;
    const didLocomotionChange =
      !lastSyncedLocalMovement ||
      lastSyncedLocalMovement.locomotionState !== movement.locomotionState ||
      lastSyncedLocalMovement.isCrouching !== movement.isCrouching ||
      lastSyncedLocalMovement.isRolling !== movement.isRolling ||
      lastSyncedLocalMovement.isWallRunning !== movement.isWallRunning ||
      lastSyncedLocalMovement.wallRunSide !== movement.wallRunSide ||
      Math.abs(lastSyncedLocalMovement.verticalVelocity - movement.verticalVelocity) >= 0.15;

    if ((!didTransformChange && !didLocomotionChange) || elapsedMs < LOCAL_MOVEMENT_SYNC_INTERVAL_MS) {
      return;
    }

    options.onLocalPlayerMoved(movement);
    lastSyncedLocalMovement = { ...movement };
    lastMovementSyncAtMs = nowMs;
  };

  const maybeEmitLocalSprintIntent = (intent: {
    isShiftPressed: boolean;
    isForwardPressed: boolean;
  }): void => {
    if (!options.onLocalSprintIntentChanged) {
      return;
    }

    const nowMs = Date.now();
    const changed =
      !lastSentSprintIntent ||
      lastSentSprintIntent.isShiftPressed !== intent.isShiftPressed ||
      lastSentSprintIntent.isForwardPressed !== intent.isForwardPressed;

    if (!changed && nowMs - lastSprintInputSyncAtMs < LOCAL_SPRINT_INPUT_SYNC_INTERVAL_MS) {
      return;
    }

    options.onLocalSprintIntentChanged(intent);
    lastSentSprintIntent = {
      isShiftPressed: intent.isShiftPressed,
      isForwardPressed: intent.isForwardPressed
    };
    lastSprintInputSyncAtMs = nowMs;
  };

  const applyLocalMovement = (deltaSeconds: number): void => {
    const runtime = ensureLocalGameplayRuntime();
    const inputState = movementInput.getState();
    const localPlayerState = playerViewManager.getLocalPlayerState();
    const localView = playerViewManager.getLocalPlayerView();

    if (!runtime || !localView) {
      maybeEmitLocalSprintIntent({
        isShiftPressed: false,
        isForwardPressed: false
      });
      return;
    }

    const nowMs = Date.now();
    const isLocallyStunned =
      !!localPlayerState &&
      (localPlayerState.isGuardBroken || nowMs < localPlayerState.stunUntil || !localPlayerState.isAlive);

    if (localPredictedAttackUntilMs > 0 && nowMs >= localPredictedAttackUntilMs) {
      localPredictedActiveAttackComboIndex = 0;
      localPredictedAttackUntilMs = 0;
    }

    if (
      localPredictedComboChainIndex > 0 &&
      nowMs - localPredictedLastAttackAtMs > LOCAL_COMBO_RESET_TIME_MS
    ) {
      localPredictedComboChainIndex = 0;
    }

    const canCommitBufferedAttack =
      localBufferedAttackUntilMs > 0 &&
      nowMs <= localBufferedAttackUntilMs &&
      nowMs - localPredictedLastAttackAtMs >= LOCAL_ATTACK_INTERVAL_MS &&
      canUseCombatInput();
    if (canCommitBufferedAttack) {
      commitLocalAttackIntent(nowMs);
    } else if (localBufferedAttackUntilMs > 0 && nowMs > localBufferedAttackUntilMs) {
      localBufferedAttackUntilMs = 0;
    }

    if (
      localPredictedBlockActive &&
      localPredictedBlockStartedAtMs > 0 &&
      nowMs - localPredictedBlockStartedAtMs >= LOCAL_BLOCK_MAX_HOLD_MS
    ) {
      localPredictedBlockActive = false;
      localPredictedBlockStartedAtMs = 0;
    }

    if (isLocallyStunned) {
      localPredictedBlockActive = false;
      localPredictedBlockStartedAtMs = 0;
    }

    const serverAttackComboIndex =
      localPlayerState && localPlayerState.isAttacking
        ? resolveSafeAttackComboIndex(localPlayerState.attackComboIndex)
        : 0;
    const activeAttackComboIndex =
      localPredictedActiveAttackComboIndex > 0
        ? localPredictedActiveAttackComboIndex
        : serverAttackComboIndex;

    const serverBlocking = !!localPlayerState?.isBlocking;
    const effectiveBlocking = (localPredictedBlockActive || serverBlocking) && activeAttackComboIndex === 0;
    const hasSprintResource =
      localPlayerState
        ? localPlayerState.currentStamina > 0 &&
          !localPlayerState.sprintBlocked &&
          !localPlayerState.isGuardBroken &&
          nowMs >= localPlayerState.stunUntil
        : true;

    const canRequestSprintIntent =
      inputEnabled &&
      !flyModeEnabled &&
      (localPlayerState?.isAlive ?? true) &&
      hasSprintResource &&
      !isLocallyStunned &&
      !effectiveBlocking &&
      activeAttackComboIndex === 0;

    const frameOutput = runtime.locomotionSystem.step({
      nowMs,
      deltaSeconds,
      currentTransform: localView.getTransform(),
      inputState,
      cameraForward: cameraController.getGroundForward(),
      isInputEnabled: inputEnabled,
      isFlyModeEnabled: flyModeEnabled,
      canSprint: canRequestSprintIntent,
      combat: {
        isAlive: localPlayerState?.isAlive ?? true,
        isUltimateActive: !!localPlayerState?.isUsingUltimate,
        isBlocking: effectiveBlocking,
        attackComboIndex: activeAttackComboIndex,
        isStunned: isLocallyStunned && !effectiveBlocking && activeAttackComboIndex === 0
      }
    });

    runtime.audioController.sync(frameOutput.snapshot);
    playerViewManager.updateLocalPlayerTransform(frameOutput.transform, frameOutput.animationState);
    maybeEmitLocalMovement({
      ...frameOutput.transform,
      locomotionState: frameOutput.snapshot.state,
      isCrouching: frameOutput.snapshot.isCrouching,
      isRolling: frameOutput.snapshot.isRolling,
      isWallRunning: frameOutput.snapshot.isWallRunning,
      wallRunSide: frameOutput.snapshot.wallRunSide,
      verticalVelocity: frameOutput.snapshot.verticalVelocity
    });
    maybeEmitLocalSprintIntent(frameOutput.snapshot.sprintIntent);

    characterLean.update(localView.visualRoot, {
      deltaSeconds,
      isGrounded: frameOutput.isGrounded,
      isSprinting: frameOutput.isSprinting,
      lateralInput: frameOutput.lateralInput,
      movementIntensity: frameOutput.speedFeedback
    });

    const cameraHooks = resolveLocomotionCameraHooks(frameOutput.snapshot);
    cameraController.tick({
      deltaSeconds,
      playerTransform: frameOutput.transform,
      isPointerLocked: pointerLocked,
      isInputEnabled: inputEnabled,
      isSprinting: frameOutput.isSprinting,
      isSprintBurstActive: frameOutput.isSprintBurstActive,
      speedFeedback: frameOutput.speedFeedback,
      isMoving: frameOutput.isMoving,
      isGrounded: frameOutput.isGrounded,
      turnInput: frameOutput.lateralInput,
      landingImpact: frameOutput.landingImpact,
      targetOffsetY: cameraHooks.targetOffsetY,
      lateralOffset: cameraHooks.lateralOffset,
      additionalFovRadians: cameraHooks.additionalFovRadians,
      wallRunTiltRadians: cameraHooks.wallRunTiltRadians
    });

    if (frameOutput.didStartSprint) {
      cameraController.triggerShake("light", 0.65);
    }

    windParticles.update({
      speedFeedback: frameOutput.speedFeedback,
      isSprinting: frameOutput.isSprinting,
      isGrounded: frameOutput.isGrounded,
      didLand: frameOutput.didLand,
      landingImpact: frameOutput.landingImpact,
      cameraPosition: camera.globalPosition.clone(),
      cameraForward: cameraController.getGroundForward(),
      playerPosition: {
        x: frameOutput.transform.x,
        y: frameOutput.transform.y,
        z: frameOutput.transform.z
      }
    });

    motionLines.update({
      deltaSeconds,
      enabled: frameOutput.isSprinting && frameOutput.speedFeedback > 0.45,
      intensity: frameOutput.speedFeedback
    });
  };

  const disposePointerLockChange = pointerLockSystem.onLockChange((locked) => {
    pointerLocked = locked;
    pointerLockChangeListeners.forEach((listener) => {
      listener(locked);
    });
  });

  document.addEventListener("mousemove", onMouseMove);

  setPlayers(options.initialPlayers ?? []);

  engine.runRenderLoop(() => {
    const deltaSeconds = Math.min(MAX_FRAME_DELTA_SECONDS, engine.getDeltaTime() / 1000);

    cameraController.syncLook(pointerLocked, inputEnabled);
    applyLocalMovement(deltaSeconds);
    playerViewManager.tick(Date.now());
    lightingSystem.syncPlayerShadowCasters(playerViewManager.getPlayerVisualRoots());

    const localView = playerViewManager.getLocalPlayerView();
    if (localView) {
      const shouldHideVisual = shouldHideLocalVisualForCamera(localView.visualRoot, camera.globalPosition);
      if (shouldHideVisual !== isLocalVisualHiddenForCamera) {
        localView.visualRoot.getChildMeshes(false).forEach((mesh) => {
          mesh.isVisible = !shouldHideVisual;
        });
        isLocalVisualHiddenForCamera = shouldHideVisual;
      }
    } else if (isLocalVisualHiddenForCamera) {
      isLocalVisualHiddenForCamera = false;
    }

    scene.render();
  });

  const onWindowResize = (): void => {
    engine.resize();
  };

  window.addEventListener("resize", onWindowResize);

  return {
    setPlayers,
    addPlayer,
    updatePlayer,
    removePlayer,
    setTeamMemberUserIds,
    setFlyModeEnabled,
    toggleFlyMode,
    isFlyModeEnabled: () => flyModeEnabled,
    setInputEnabled,
    requestPointerLock,
    exitPointerLock,
    isPointerLocked: () => pointerLocked,
    onPointerLockChanged: (listener) => {
      pointerLockChangeListeners.add(listener);
      return () => {
        pointerLockChangeListeners.delete(listener);
      };
    },
    triggerPlayerUltimateEffect: (payload) => {
      effectManager.playUltimateEffect({
        sessionId: payload.sessionId,
        characterId: payload.characterId,
        durationMs: payload.durationMs
      });
    },
    getPlayerScreenPosition: (sessionId) => {
      const target = playerViewManager.getPlayerCameraTarget(sessionId);
      if (!target) {
        return null;
      }

      return resolveProjectedPoint(
        scene,
        camera,
        engine,
        new Vector3(target.x, target.y + 0.45, target.z)
      );
    },
    getPlayerNameplateScreenPosition: (sessionId) => {
      const target = playerViewManager.getPlayerNameplateTarget(sessionId);
      if (!target) {
        return null;
      }

      return resolveProjectedPoint(scene, camera, engine, new Vector3(target.x, target.y, target.z));
    },
    getPlayerWorldPosition: (sessionId) => {
      return playerViewManager.getPlayerWorldPosition(sessionId);
    },
    getCameraGroundForward: () => {
      const forward = cameraController.getGroundForward();
      return {
        x: forward.x,
        z: forward.z
      };
    },
    dispose: () => {
      window.removeEventListener("resize", onWindowResize);
      document.removeEventListener("mousemove", onMouseMove);

      setInputEnabled(false);
      disposePointerLockChange();
      pointerLockChangeListeners.clear();
      pointerLockSystem.dispose();
      combatInput.dispose();
      movementInput.dispose();

      effectManager.dispose();
      playerViewManager.dispose();
      disposeLocalGameplayRuntime();
      characterLean.reset(null);

      lightingSystem.dispose();
      windParticles.dispose();
      motionLines.dispose();
      mapHandle.dispose();
      cameraController.dispose();

      scene.dispose();
      engine.stopRenderLoop();
      engine.dispose();
    }
  };
}
