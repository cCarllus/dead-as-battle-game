// Responsável por orquestrar a cena da partida global com arquitetura modular de gameplay (movimento, câmera, colisão, iluminação).
import {
  Color3,
  Camera,
  Color4,
  Matrix,
  Scene,
  Vector3,
  type AbstractMesh,
  type Engine,
  type TransformNode
} from "@babylonjs/core";
import type {
  MatchCombatUltimatePayload,
  MatchCombatStateName,
  MatchPlayerLocomotionState,
  MatchPlayerMovedPayload,
  MatchPlayerState,
  MatchPlayerWallRunSide
} from "@/shared/match/match-player.model";
import type { GameSettings } from "@/app/services/settings.service";
import {
  createCombatStateMachine,
  type CombatStateMachineServerState
} from "../combat/combat-state-machine";
import { createRagdollSystem } from "../combat/ragdoll-system";
import {
  createLocalCharacterGameplayRuntime,
  type LocalCharacterGameplayRuntime
} from "../character/local-character-runtime";
import { createGameBootstrap } from "../core/game-bootstrap";
import type { GameContext } from "../core/game-context";
import type { GameFlowState } from "../core/game-state-machine";
import { createPhysicsDebugLogger } from "../debug/physics-debug";
import { GLOBAL_MATCH_RUNTIME_CONFIG } from "../config/match-runtime.config";
import { createMotionLinesEffect } from "../effects/motion-lines";
import { createWindParticlesSystem } from "../effects/wind-particles";
import { createEffectManager } from "../effects/effect-manager";
import { createCameraController } from "../camera/camera.controller";
import { isClimbableSurfaceMesh } from "../environment/climbable-surface-utils";
import { createCharacterLeanSystem } from "../locomotion/character-lean";
import { bootstrapHavokPhysics } from "../physics/havok-bootstrap";
import { MAX_FRAME_DELTA_SECONDS } from "../physics/player-physics";
import { createPhysicsWorld } from "../physics/physics-world";
import { createPlayerPresenceTracker } from "../multiplayer/player-presence-tracker";
import { createCombatInputSystem } from "../systems/combat-input.system";
import { createLightingSystem } from "../systems/lighting.system";
import { GLOBAL_MATCH_MAP_URL, loadGlobalMatchMap } from "../systems/map-loader.system";
import { createMovementInputSystem } from "../systems/movement-input.system";
import { createPlayerViewManager } from "../systems/player-view-manager";
import { createPointerLockSystem } from "../systems/pointer-lock.system";
import { clamp, lerp, squaredDistance3D } from "../utils/math";

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
  onLocalSkillRequested?: (slot: 1 | 2 | 3 | 4 | 5) => void;
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
  enablePlayerRagdoll: (sessionId: string) => void;
  getPlayerScreenPosition: (sessionId: string) => { x: number; y: number } | null;
  getPlayerNameplateScreenPosition: (sessionId: string) => { x: number; y: number } | null;
  getPlayerWorldPosition: (sessionId: string) => { x: number; y: number; z: number } | null;
  getCrosshairScreenPosition: () => {
    normalizedX: number;
    normalizedY: number;
    scale: number;
    opacity: number;
  } | null;
  getCameraAimPoint: () => { x: number; y: number; z: number } | null;
  getCameraAimRay: () => {
    origin: { x: number; y: number; z: number };
    direction: { x: number; y: number; z: number };
  } | null;
  toggleShoulderSide: () => number;
  getShoulderSide: () => number;
  getCameraGroundForward: () => { x: number; z: number };
  applyViewSettings: (
    settings: Pick<GameSettings, "cameraFovPercent" | "renderDistanceViewPercent">
  ) => void;
  getContext: () => GlobalMatchSceneContext;
  dispose: () => void;
};

type GlobalMatchRuntimeServices = {
  cameraController: ReturnType<typeof createCameraController>;
  movementInput: ReturnType<typeof createMovementInputSystem>;
  pointerLockSystem: ReturnType<typeof createPointerLockSystem>;
  combatInput: ReturnType<typeof createCombatInputSystem>;
  playerViewManager: ReturnType<typeof createPlayerViewManager>;
  effectManager: ReturnType<typeof createEffectManager>;
  lightingSystem: ReturnType<typeof createLightingSystem>;
  physicsWorld: ReturnType<typeof createPhysicsWorld>;
  physicsDebug: ReturnType<typeof createPhysicsDebugLogger>;
  windParticles: ReturnType<typeof createWindParticlesSystem>;
  motionLines: ReturnType<typeof createMotionLinesEffect>;
  localGameplayRuntime: LocalCharacterGameplayRuntime | null;
  ragdollSystem: ReturnType<typeof createRagdollSystem>;
};

type GlobalMatchRuntimeEvents = {
  playerSpawned: {
    player: MatchPlayerState;
    source: "snapshot" | "stream";
    isLocal: boolean;
  };
  playerUpdated: {
    player: MatchPlayerState;
    source: "snapshot" | "stream";
    isLocal: boolean;
  };
  playerRemoved: {
    sessionId: string;
    source: "snapshot" | "stream";
    isLocal: boolean;
  };
  pointerLockChanged: {
    locked: boolean;
  };
  localMovementSynced: {
    movement: MatchPlayerMovedPayload;
  };
  localSprintIntentSynced: {
    intent: {
      isShiftPressed: boolean;
      isForwardPressed: boolean;
    };
  };
  localAttackRequested: {
    comboIndex: 0 | 1 | 2 | 3;
    requestedAt: number;
  };
  localSkillRequested: {
    slot: 1 | 2 | 3 | 4 | 5;
    requestedAt: number;
    skillId: string;
  };
  localBlockStarted: {
    requestedAt: number;
  };
  localBlockEnded: {
    requestedAt: number;
  };
  ultimateEffectTriggered: {
    sessionId: string;
    characterId: string;
    durationMs: number;
  };
};

export type GlobalMatchSceneContext = GameContext<
  GlobalMatchRuntimeServices,
  GlobalMatchRuntimeEvents,
  GameFlowState
>;

function clampPercent(value: number, fallback = 50): number {
  if (!Number.isFinite(value)) {
    return fallback;
  }

  return clamp(Math.round(value), 1, 100);
}

function shouldHideLocalVisualForCamera(
  collisionBody: AbstractMesh,
  cameraPosition: Vector3,
  isCurrentlyHidden: boolean
): boolean {
  collisionBody.computeWorldMatrix(true);
  const boundingBox = collisionBody.getBoundingInfo().boundingBox;
  const center = boundingBox.centerWorld;
  const horizontalRadius = Math.max(boundingBox.extendSizeWorld.x, boundingBox.extendSizeWorld.z, 0.001);
  const halfHeight = Math.max(boundingBox.extendSizeWorld.y, 0.001);
  const horizontalThreshold =
    horizontalRadius *
    Math.max(
      isCurrentlyHidden
        ? GLOBAL_MATCH_RUNTIME_CONFIG.localVisualCulling.cameraShowRadiusMultiplier
        : GLOBAL_MATCH_RUNTIME_CONFIG.localVisualCulling.cameraHideRadiusMultiplier,
      0.001
    );
  const verticalThreshold =
    halfHeight *
    Math.max(
      isCurrentlyHidden
        ? GLOBAL_MATCH_RUNTIME_CONFIG.localVisualCulling.cameraShowVerticalHalfHeightMultiplier
        : GLOBAL_MATCH_RUNTIME_CONFIG.localVisualCulling.cameraHideVerticalHalfHeightMultiplier,
      0.001
    );
  const deltaX = center.x - cameraPosition.x;
  const deltaZ = center.z - cameraPosition.z;
  const horizontalDistanceSquared = deltaX * deltaX + deltaZ * deltaZ;
  const verticalDistance = Math.abs(center.y - cameraPosition.y);

  return (
    horizontalDistanceSquared <= horizontalThreshold * horizontalThreshold &&
    verticalDistance <= verticalThreshold
  );
}

function resolveProjectedPoint(
  scene: Scene,
  camera: Camera,
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

function inspectArenaMeshes(meshes: AbstractMesh[]): void {
  const verboseDebug =
    (globalThis as { __DAB_ADVANCED_MOVEMENT_DEBUG__?: unknown }).__DAB_ADVANCED_MOVEMENT_DEBUG__ === true ||
    import.meta.env.DEV;
  if (!verboseDebug) {
    return;
  }

  const validMeshes = meshes.filter((mesh) => !mesh.isDisposed() && !!mesh.getBoundingInfo());
  if (validMeshes.length === 0) {
    console.warn("[arena][diagnostic] No valid arena meshes found.");
    return;
  }

  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  const nonCollidable: string[] = [];

  validMeshes.forEach((mesh) => {
    mesh.computeWorldMatrix(true);
    const bounds = mesh.getBoundingInfo().boundingBox;
    minY = Math.min(minY, bounds.minimumWorld.y);
    maxY = Math.max(maxY, bounds.maximumWorld.y);
    if (!mesh.checkCollisions) {
      nonCollidable.push(mesh.name);
    }
  });

  const floorCandidates = validMeshes.filter((mesh) => /(ground|floor|arena)/i.test(mesh.name));
  const floorMesh = floorCandidates.length > 0 ? floorCandidates[0] : validMeshes[0];
  floorMesh.computeWorldMatrix(true);
  const floorBounds = floorMesh.getBoundingInfo().boundingBox;
  const floorTopY = floorBounds.maximumWorld.y;

  console.debug("[arena][diagnostic]", {
    meshCount: validMeshes.length,
    collidableMeshCount: validMeshes.length - nonCollidable.length,
    worldMinY: Math.round(minY * 1000) / 1000,
    worldMaxY: Math.round(maxY * 1000) / 1000,
    floorMesh: floorMesh.name,
    floorTopY: Math.round(floorTopY * 1000) / 1000,
    nonCollidableMeshes: nonCollidable.slice(0, 12)
  });

  if (Math.abs(floorTopY) > 0.25) {
    console.warn("[arena][diagnostic] Floor appears vertically offset from expected Y=0.", {
      floorMesh: floorMesh.name,
      floorTopY: Math.round(floorTopY * 1000) / 1000
    });
  }

  if (nonCollidable.length > 0) {
    console.warn("[arena][diagnostic] Arena meshes without collisions detected.", {
      count: nonCollidable.length,
      sample: nonCollidable.slice(0, 12)
    });
  }
}

export async function createGlobalMatchScene(
  options: GlobalMatchSceneOptions
): Promise<GlobalMatchSceneHandle> {
  const { engine, scene, context } = createGameBootstrap<
    GlobalMatchRuntimeServices,
    GlobalMatchRuntimeEvents,
    GameFlowState
  >({
    canvas: options.canvas,
    sceneId: "global_match_scene",
    localSessionId: options.localSessionId,
    initialState: "Boot",
    clearColor: new Color4(0.015, 0.03, 0.06, 1),
    metadata: {
      mapUrl: GLOBAL_MATCH_MAP_URL
    }
  });
  const physicsBootstrap = await bootstrapHavokPhysics(scene, {
    loggerPrefix: "[physics]",
    enableRecast: false
  });
  const physicsWorld = createPhysicsWorld({
    scene,
    loggerPrefix: "[physics][world]"
  });

  const cameraController = createCameraController({ scene });
  const camera = cameraController.camera;
  const lightingSystem = createLightingSystem({ scene });
  const windParticles = createWindParticlesSystem(scene);
  const motionLines = createMotionLinesEffect(options.canvas);
  const characterLean = createCharacterLeanSystem();
  const physicsDebug = createPhysicsDebugLogger();

  const mapHandle = await loadGlobalMatchMap(scene, GLOBAL_MATCH_MAP_URL);
  inspectArenaMeshes(mapHandle.meshes);
  const mapMeshIds = new Set<number>(mapHandle.meshes.map((mesh) => mesh.uniqueId));
  lightingSystem.setMapMeshes(mapHandle.meshes);
  if (physicsBootstrap.enabled && physicsBootstrap.usingHavok) {
    physicsWorld.registerStaticMeshes(mapHandle.meshes);
  }

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
  const ragdollSystem = createRagdollSystem({
    resolveVisualRoot: (sessionId) => {
      return playerViewManager.getPlayerEffectAnchor(sessionId)?.visualRoot ?? null;
    }
  });

  const movementInput = createMovementInputSystem();
  let inputEnabled = true;
  const pointerLockSystem = createPointerLockSystem({
    canvas: options.canvas,
    canRequestLock: () => inputEnabled
  });
  const pointerLockChangeListeners = new Set<(locked: boolean) => void>();
  const playerPresenceTracker = createPlayerPresenceTracker<MatchPlayerState>();
  const combatStateMachine = createCombatStateMachine(GLOBAL_MATCH_RUNTIME_CONFIG.combatPrediction);

  context.services.register("cameraController", cameraController);
  context.services.register("movementInput", movementInput);
  context.services.register("pointerLockSystem", pointerLockSystem);
  context.services.register("playerViewManager", playerViewManager);
  context.services.register("effectManager", effectManager);
  context.services.register("ragdollSystem", ragdollSystem);
  context.services.register("lightingSystem", lightingSystem);
  context.services.register("physicsWorld", physicsWorld);
  context.services.register("physicsDebug", physicsDebug);
  context.services.register("windParticles", windParticles);
  context.services.register("motionLines", motionLines);
  context.services.register("localGameplayRuntime", null);
  context.state.transitionTo("Loading", "global match scene bootstrap");

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
  let lastLocalLocomotionState: MatchPlayerLocomotionState = "Idle";
  let localGameplayRuntime: LocalCharacterGameplayRuntime | null = null;
  let currentViewSettings: Pick<GameSettings, "cameraFovPercent" | "renderDistanceViewPercent"> = {
    cameraFovPercent: 50,
    renderDistanceViewPercent: 50
  };

  const applyRenderDistanceView = (percent: number): void => {
    const safePercent = clampPercent(percent, currentViewSettings.renderDistanceViewPercent);
    if (safePercent >= 100) {
      scene.fogMode = Scene.FOGMODE_NONE;
      camera.maxZ = 5000;
      return;
    }

    const ratio = (safePercent - 1) / 99;
    const maxViewDistance = lerp(45, 320, ratio);
    const fogStart = maxViewDistance * 0.5;
    scene.fogMode = Scene.FOGMODE_LINEAR;
    scene.fogColor = new Color3(scene.clearColor.r, scene.clearColor.g, scene.clearColor.b);
    scene.fogStart = fogStart;
    scene.fogEnd = maxViewDistance;
    camera.maxZ = maxViewDistance;
  };

  const applyViewSettings = (
    settings: Pick<GameSettings, "cameraFovPercent" | "renderDistanceViewPercent">
  ): void => {
    currentViewSettings = {
      cameraFovPercent: clampPercent(
        settings.cameraFovPercent,
        currentViewSettings.cameraFovPercent
      ),
      renderDistanceViewPercent: clampPercent(
        settings.renderDistanceViewPercent,
        currentViewSettings.renderDistanceViewPercent
      )
    };

    cameraController.applyViewSettings({
      cameraFovPercent: currentViewSettings.cameraFovPercent
    });
    applyRenderDistanceView(currentViewSettings.renderDistanceViewPercent);
  };

  applyViewSettings(currentViewSettings);

  const disposeLocalGameplayRuntime = (): void => {
    if (!localGameplayRuntime) {
      return;
    }

    localGameplayRuntime.dispose();
    localGameplayRuntime = null;
    context.services.register("localGameplayRuntime", null);
  };

  const ensureLocalGameplayRuntime = (): LocalCharacterGameplayRuntime | null => {
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
    localGameplayRuntime = createLocalCharacterGameplayRuntime({
      scene,
      localPlayerView: localView,
      physicsBootstrap,
      physicsWorld,
      mapMeshes: mapHandle.meshes,
      isEnvironmentMesh: (mesh) => mapMeshIds.has(mesh.uniqueId),
      isClimbableMesh: (mesh) => isClimbableSurfaceMesh(mesh),
    });
    context.services.register("localGameplayRuntime", localGameplayRuntime);

    return localGameplayRuntime;
  };

  const emitSnapshotPresenceEvents = (players: MatchPlayerState[]): void => {
    const delta = playerPresenceTracker.applySnapshot(players);
    delta.spawned.forEach((player) => {
      context.events.emit("playerSpawned", {
        player,
        source: "snapshot",
        isLocal: player.sessionId === options.localSessionId
      });
    });
    delta.updated.forEach((player) => {
      context.events.emit("playerUpdated", {
        player,
        source: "snapshot",
        isLocal: player.sessionId === options.localSessionId
      });
    });
    delta.removed.forEach((sessionId) => {
      context.events.emit("playerRemoved", {
        sessionId,
        source: "snapshot",
        isLocal: sessionId === options.localSessionId
      });
    });
  };

  const setPlayers = (players: MatchPlayerState[]): void => {
    emitSnapshotPresenceEvents(players);
    playerViewManager.syncPlayers(players);
    players.forEach((player) => {
      if (player.isAlive) {
        ragdollSystem.disable(player.sessionId);
      }
    });
    ensureLocalGameplayRuntime();
  };

  const addPlayer = (player: MatchPlayerState): void => {
    const presenceChange = playerPresenceTracker.observe(player);
    context.events.emit(presenceChange.type === "spawned" ? "playerSpawned" : "playerUpdated", {
      player,
      source: "stream",
      isLocal: player.sessionId === options.localSessionId
    });
    playerViewManager.addPlayer(player);
    if (player.isAlive) {
      ragdollSystem.disable(player.sessionId);
    }
    ensureLocalGameplayRuntime();
  };

  const updatePlayer = (player: MatchPlayerState): void => {
    const presenceChange = playerPresenceTracker.observe(player);
    context.events.emit(presenceChange.type === "spawned" ? "playerSpawned" : "playerUpdated", {
      player,
      source: "stream",
      isLocal: player.sessionId === options.localSessionId
    });
    playerViewManager.updatePlayer(player);
    if (player.isAlive) {
      ragdollSystem.disable(player.sessionId);
    }
    ensureLocalGameplayRuntime();
  };

  const removePlayer = (sessionId: string): void => {
    const wasKnown = playerPresenceTracker.remove(sessionId);
    if (wasKnown) {
      context.events.emit("playerRemoved", {
        sessionId,
        source: "stream",
        isLocal: sessionId === options.localSessionId
      });
    }
    effectManager.stopEffectsForPlayer(sessionId);
    ragdollSystem.disable(sessionId);
    playerViewManager.removePlayer(sessionId);

    if (sessionId === options.localSessionId) {
      disposeLocalGameplayRuntime();
      combatStateMachine.reset();
      lastLocalLocomotionState = "Idle";
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

  const resolveCombatServerState = (player: MatchPlayerState | null): CombatStateMachineServerState => {
    return {
      heroId: player?.heroId ?? "default_champion",
      isAlive: player?.isAlive ?? true,
      combatState: (player?.combatState ?? "CombatIdle") as MatchCombatStateName,
      attackPhase: player?.attackPhase ?? "None",
      isAttacking: !!player?.isAttacking,
      attackComboIndex: player?.attackComboIndex ?? 0,
      activeActionId: player?.activeActionId ?? "",
      activeSkillId: player?.activeSkillId ?? "",
      isBlocking: !!player?.isBlocking,
      isGuardBroken: !!player?.isGuardBroken,
      stunUntil: player?.stunUntil ?? 0,
      skillCooldowns: player?.skillCooldowns ?? {}
    };
  };

  const canUseCombatInput = (): boolean => {
    const localPlayerState = playerViewManager.getLocalPlayerState();
    const now = Date.now();
    if (!inputEnabled || !localPlayerState || !localPlayerState.isAlive) {
      return false;
    }

    if (
      lastLocalLocomotionState === "LedgeHang" ||
      lastLocalLocomotionState === "Hanging" ||
      lastLocalLocomotionState === "LedgeClimb" ||
      lastLocalLocomotionState === "ClimbingUp" ||
      lastLocalLocomotionState === "MantlingLowObstacle"
    ) {
      return false;
    }

    if (now < localPlayerState.stunUntil || localPlayerState.isGuardBroken) {
      return false;
    }

    return true;
  };

  const handleLocalAttackIntent = (): void => {
    const now = Date.now();
    const localPlayerState = playerViewManager.getLocalPlayerState();
    if (!localPlayerState || !localPlayerState.isAlive) {
      return;
    }

    const attackResult = combatStateMachine.requestAttack(now, resolveCombatServerState(localPlayerState));
    if (!attackResult.accepted) {
      return;
    }

    context.events.emit("localAttackRequested", {
      comboIndex: attackResult.comboIndex,
      requestedAt: now
    });
    options.onLocalAttackRequested?.();
  };

  const handleLocalSkillIntent = (slot: 1 | 2 | 3 | 4 | 5): void => {
    const now = Date.now();
    const localPlayerState = playerViewManager.getLocalPlayerState();
    if (!localPlayerState || !localPlayerState.isAlive) {
      return;
    }

    const skillResult = combatStateMachine.requestSkill(slot, now, resolveCombatServerState(localPlayerState));
    if (!skillResult.accepted) {
      return;
    }

    context.events.emit("localSkillRequested", {
      slot,
      requestedAt: now,
      skillId: skillResult.skillId
    });
    options.onLocalSkillRequested?.(slot);
  };

  const handleLocalBlockStartIntent = (): void => {
    const now = Date.now();
    const localPlayerState = playerViewManager.getLocalPlayerState();
    if (!localPlayerState || !localPlayerState.isAlive) {
      return;
    }

    if (!combatStateMachine.requestBlockStart(now, resolveCombatServerState(localPlayerState))) {
      return;
    }

    context.events.emit("localBlockStarted", {
      requestedAt: now
    });
    options.onLocalBlockStartRequested?.();
  };

  const handleLocalBlockEndIntent = (): void => {
    combatStateMachine.requestBlockEnd();
    context.events.emit("localBlockEnded", {
      requestedAt: Date.now()
    });
    options.onLocalBlockEndRequested?.();
  };

  const combatInput = createCombatInputSystem({
    canProcessInput: canUseCombatInput,
    onAttackStart: handleLocalAttackIntent,
    onSkillCast: handleLocalSkillIntent,
    onBlockStart: handleLocalBlockStartIntent,
    onBlockEnd: handleLocalBlockEndIntent
  });
  context.services.register("combatInput", combatInput);

  const setInputEnabled = (enabled: boolean): void => {
    inputEnabled = enabled;
    movementInput.setEnabled(enabled);
    pointerLockSystem.setEnabled(enabled);
    combatInput.setEnabled(enabled);

    const sceneState = context.state.getState();
    if (!enabled && sceneState === "InMatch") {
      context.state.transitionTo("Paused", "match input disabled");
    } else if (enabled && sceneState === "Paused") {
      context.state.transitionTo("InMatch", "match input enabled");
    }

    if (!enabled) {
      combatStateMachine.reset();
      localGameplayRuntime?.locomotionSystem.reset();
      characterLean.reset(playerViewManager.getLocalPlayerView()?.visualRoot ?? null);
      lastLocalLocomotionState = "Idle";
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
      squaredDistance3D(movement, lastSyncedLocalMovement) >=
        GLOBAL_MATCH_RUNTIME_CONFIG.movementSync.thresholdMeters *
          GLOBAL_MATCH_RUNTIME_CONFIG.movementSync.thresholdMeters ||
      Math.abs(movement.rotationY - lastSyncedLocalMovement.rotationY) >=
        GLOBAL_MATCH_RUNTIME_CONFIG.movementSync.rotationThresholdRadians;
    const didLocomotionChange =
      !lastSyncedLocalMovement ||
      lastSyncedLocalMovement.locomotionState !== movement.locomotionState ||
      lastSyncedLocalMovement.isCrouching !== movement.isCrouching ||
      lastSyncedLocalMovement.isRolling !== movement.isRolling ||
      lastSyncedLocalMovement.isWallRunning !== movement.isWallRunning ||
      lastSyncedLocalMovement.wallRunSide !== movement.wallRunSide ||
      Math.abs(lastSyncedLocalMovement.verticalVelocity - movement.verticalVelocity) >=
        GLOBAL_MATCH_RUNTIME_CONFIG.movementSync.verticalVelocityThreshold;

    if (
      (!didTransformChange && !didLocomotionChange) ||
      elapsedMs < GLOBAL_MATCH_RUNTIME_CONFIG.movementSync.intervalMs
    ) {
      return;
    }

    options.onLocalPlayerMoved(movement);
    lastSyncedLocalMovement = { ...movement };
    lastMovementSyncAtMs = nowMs;
    context.events.emit("localMovementSynced", {
      movement: {
        sessionId: options.localSessionId,
        ...movement
      }
    });
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

    if (!changed && nowMs - lastSprintInputSyncAtMs < GLOBAL_MATCH_RUNTIME_CONFIG.sprintIntentSync.intervalMs) {
      return;
    }

    options.onLocalSprintIntentChanged(intent);
    lastSentSprintIntent = {
      isShiftPressed: intent.isShiftPressed,
      isForwardPressed: intent.isForwardPressed
    };
    lastSprintInputSyncAtMs = nowMs;
    context.events.emit("localSprintIntentSynced", {
      intent
    });
  };

  const applyLocalMovement = (deltaSeconds: number): void => {
    const runtime = ensureLocalGameplayRuntime();
    const inputState = movementInput.getState();
    const localPlayerState = playerViewManager.getLocalPlayerState();
    const localView = playerViewManager.getLocalPlayerView();

    if (!runtime || !localView) {
      lastLocalLocomotionState = "Idle";
      maybeEmitLocalSprintIntent({
        isShiftPressed: false,
        isForwardPressed: false
      });
      return;
    }

    const nowMs = Date.now();
    const combatSnapshot = combatStateMachine.step(
      nowMs,
      resolveCombatServerState(localPlayerState)
    );
    const isLocallyStunned = nowMs < (localPlayerState?.stunUntil ?? 0) || !!localPlayerState?.isGuardBroken;
    const activeAttackComboIndex = combatSnapshot.activeAttackComboIndex;
    const effectiveBlocking = combatSnapshot.isBlocking;
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
        combatState: combatSnapshot.state,
        attackPhase: combatSnapshot.attackPhase,
        attackComboIndex: activeAttackComboIndex,
        activeSkillId: combatSnapshot.activeSkillId,
        isStunned: isLocallyStunned
      }
    });

    runtime.audioController.sync(frameOutput.snapshot);
    lastLocalLocomotionState = frameOutput.snapshot.state;
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

    const collisionVelocity = runtime.collisionSystem.getCurrentVelocity();
    const groundInfo = runtime.collisionSystem.getGroundInfo();
    physicsDebug.render({
      state: frameOutput.snapshot.state,
      grounded: frameOutput.isGrounded,
      slopeAngle: groundInfo ? groundInfo.slopeAngleDegrees : null,
      horizontalSpeed: Math.hypot(collisionVelocity.x, collisionVelocity.z),
      verticalVelocity: frameOutput.snapshot.verticalVelocity,
      colliderProfile: runtime.collisionSystem.getActiveColliderProfile(),
      rootPosition: localView.gameplayRoot.position.clone(),
      visualOffset: localView.visualRoot.position.clone(),
      velocity: collisionVelocity,
      groundInfo: groundInfo
        ? {
            supportedState: groundInfo.supportedState,
            slopeAngleDegrees: groundInfo.slopeAngleDegrees,
            isSurfaceDynamic: groundInfo.isSurfaceDynamic
          }
        : null,
      shapeQueries: runtime.shapeQueryService.getDebugSnapshot()
    });

    characterLean.update(localView.visualRoot, {
      deltaSeconds,
      isGrounded: frameOutput.isGrounded,
      isSprinting: frameOutput.isSprinting,
      lateralInput: frameOutput.lateralInput,
      movementIntensity: frameOutput.speedFeedback
    });

    cameraController.tick({
      deltaSeconds,
      snapshot: frameOutput.snapshot,
      cameraTarget: localView.getCameraTarget(),
      isSprintBurstActive: frameOutput.isSprintBurstActive,
      lockOnTarget: null
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
    context.events.emit("pointerLockChanged", {
      locked
    });
  });

  document.addEventListener("mousemove", onMouseMove);

  setPlayers(options.initialPlayers ?? []);
  context.state.transitionTo("InMatch", "global match scene ready");

  engine.runRenderLoop(() => {
    const deltaSeconds = Math.min(MAX_FRAME_DELTA_SECONDS, engine.getDeltaTime() / 1000);

    cameraController.syncLook(pointerLocked, inputEnabled);
    applyLocalMovement(deltaSeconds);
    playerViewManager.tick(Date.now());
    ragdollSystem.tick(deltaSeconds);
    lightingSystem.syncPlayerShadowCasters(playerViewManager.getPlayerVisualRoots());

    const localView = playerViewManager.getLocalPlayerView();
    if (localView) {
      const shouldHideVisual = shouldHideLocalVisualForCamera(
        localView.collisionBody,
        camera.globalPosition,
        isLocalVisualHiddenForCamera
      );
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
      context.events.emit("ultimateEffectTriggered", {
        sessionId: payload.sessionId,
        characterId: payload.characterId,
        durationMs: payload.durationMs
      });
      effectManager.playUltimateEffect({
        sessionId: payload.sessionId,
        characterId: payload.characterId,
        durationMs: payload.durationMs
      });
    },
    enablePlayerRagdoll: (sessionId) => {
      ragdollSystem.enable(sessionId);
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
    getCrosshairScreenPosition: () => {
      const aimState = cameraController.getAimState();
      if (!aimState) {
        return null;
      }

      return {
        normalizedX: aimState.normalizedScreenX,
        normalizedY: aimState.normalizedScreenY,
        scale: aimState.scale,
        opacity: aimState.opacity
      };
    },
    getCameraAimPoint: () => {
      const aimState = cameraController.getAimState();
      if (!aimState) {
        return null;
      }

      return {
        x: aimState.aimPoint.x,
        y: aimState.aimPoint.y,
        z: aimState.aimPoint.z
      };
    },
    getCameraAimRay: () => {
      const aimState = cameraController.getAimState();
      if (!aimState) {
        return null;
      }

      return {
        origin: {
          x: aimState.rayOrigin.x,
          y: aimState.rayOrigin.y,
          z: aimState.rayOrigin.z
        },
        direction: {
          x: aimState.rayDirection.x,
          y: aimState.rayDirection.y,
          z: aimState.rayDirection.z
        }
      };
    },
    toggleShoulderSide: () => {
      return cameraController.toggleShoulderSide();
    },
    getShoulderSide: () => {
      return cameraController.getShoulderSide();
    },
    getCameraGroundForward: () => {
      const forward = cameraController.getGroundForward();
      return {
        x: forward.x,
        z: forward.z
      };
    },
    applyViewSettings,
    getContext: () => context,
    dispose: () => {
      window.removeEventListener("resize", onWindowResize);
      document.removeEventListener("mousemove", onMouseMove);

      playerPresenceTracker.reset();
      setInputEnabled(false);
      disposePointerLockChange();
      pointerLockChangeListeners.clear();
      pointerLockSystem.dispose();
      combatInput.dispose();
      movementInput.dispose();

      effectManager.dispose();
      ragdollSystem.dispose();
      playerViewManager.dispose();
      disposeLocalGameplayRuntime();
      characterLean.reset(null);
      physicsDebug.dispose();

      lightingSystem.dispose();
      windParticles.dispose();
      motionLines.dispose();
      physicsWorld.dispose();
      mapHandle.dispose();
      cameraController.dispose();

      scene.disablePhysicsEngine();
      scene.dispose();
      engine.stopRenderLoop();
      engine.dispose();
      context.state.transitionTo("Disposed", "global match scene disposed");
      context.dispose();
    }
  };
}
