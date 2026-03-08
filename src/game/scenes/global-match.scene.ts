// Responsável por orquestrar a cena da partida global usando estado autoritativo do servidor e PlayerViewManager.
import {
  ArcRotateCamera,
  Color4,
  Engine,
  HemisphericLight,
  Scene,
  TransformNode,
  Vector3
} from "@babylonjs/core";
import type { MatchPlayerState } from "../../models/match-player.model";
import type {
  AnimationGameplayState,
  MovementDirection
} from "../animation/animation-state";
import { createPlayerViewManager } from "../systems/player-view-manager";
import { createMovementInputSystem } from "../systems/movement-input.system";
import { createPointerLockSystem } from "../systems/pointer-lock.system";
import { GLOBAL_MATCH_MAP_URL, loadGlobalMatchMap } from "../systems/map-loader.system";

const CAMERA_RADIUS = 6.9;
const CAMERA_MIN_BETA = 0.72;
const CAMERA_MAX_BETA = 1.42;
const CAMERA_MOUSE_SENSITIVITY = 0.0022;
const CAMERA_TARGET_VERTICAL_OFFSET = 1.72;
const CAMERA_TARGET_LATERAL_OFFSET = 0.92;
const LOCAL_WALK_SPEED = 5.4;
const LOCAL_RUN_SPEED_MULTIPLIER = 2.3;
const LOCAL_JUMP_VELOCITY = 7.6;
const LOCAL_FLY_VERTICAL_SPEED = 5.8;
const LOCAL_GRAVITY = 22;
const MAX_FRAME_DELTA_SECONDS = 0.05;
const GROUND_EPSILON = 0.0001;
const LOCAL_MOVEMENT_SYNC_INTERVAL_MS = 33;
const LOCAL_MOVEMENT_SYNC_THRESHOLD = 0.015;
const LOCAL_SPRINT_INPUT_SYNC_INTERVAL_MS = 50;

export type GlobalMatchSceneOptions = {
  canvas: HTMLCanvasElement;
  localSessionId: string;
  initialPlayers?: MatchPlayerState[];
  onLocalPlayerMoved?: (position: { x: number; y: number; z: number; rotationY: number }) => void;
  onLocalSprintIntentChanged?: (intent: { isShiftPressed: boolean; isForwardPressed: boolean }) => void;
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
  triggerLocalUltimateAnimation: () => void;
  dispose: () => void;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function resolveGroundForward(camera: ArcRotateCamera): Vector3 {
  const forward = new Vector3(-Math.cos(camera.alpha), 0, -Math.sin(camera.alpha));

  if (forward.lengthSquared() <= 0.0001) {
    return new Vector3(0, 0, 1);
  }

  return forward.normalize();
}

function positionDistanceSquared(
  left: { x: number; y: number; z: number },
  right: { x: number; y: number; z: number }
): number {
  const dx = left.x - right.x;
  const dy = left.y - right.y;
  const dz = left.z - right.z;
  return dx * dx + dy * dy + dz * dz;
}

function resolveMovementDirectionFromAxes(forwardAxis: number, sideAxis: number): MovementDirection {
  if (forwardAxis === 0 && sideAxis === 0) {
    return "none";
  }

  if (Math.abs(forwardAxis) >= Math.abs(sideAxis)) {
    return forwardAxis >= 0 ? "forward" : "backward";
  }

  return sideAxis >= 0 ? "right" : "left";
}

function resolveOverShoulderTargetPosition(
  transform: { x: number; y: number; z: number },
  cameraAlpha: number
): { x: number; y: number; z: number } {
  const forwardX = -Math.cos(cameraAlpha);
  const forwardZ = -Math.sin(cameraAlpha);
  const rightX = forwardZ;
  const rightZ = -forwardX;

  return {
    x: transform.x + rightX * CAMERA_TARGET_LATERAL_OFFSET,
    y: transform.y + CAMERA_TARGET_VERTICAL_OFFSET,
    z: transform.z + rightZ * CAMERA_TARGET_LATERAL_OFFSET
  };
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

  const camera = new ArcRotateCamera(
    "globalMatchCamera",
    -Math.PI / 2,
    1.02,
    CAMERA_RADIUS,
    new Vector3(0, 1.2, 0),
    scene
  );

  camera.inputs.clear();
  camera.radius = CAMERA_RADIUS;
  camera.lowerRadiusLimit = CAMERA_RADIUS;
  camera.upperRadiusLimit = CAMERA_RADIUS;
  camera.lowerBetaLimit = CAMERA_MIN_BETA;
  camera.upperBetaLimit = CAMERA_MAX_BETA;

  const keyLight = new HemisphericLight("globalMatchKeyLight", new Vector3(0.25, 1, -0.15), scene);
  keyLight.intensity = 1.06;

  const fillLight = new HemisphericLight("globalMatchFillLight", new Vector3(-0.2, -0.4, 0.32), scene);
  fillLight.intensity = 0.24;
  const cameraTargetNode = new TransformNode("globalMatchCameraTarget", scene);
  camera.lockedTarget = cameraTargetNode;

  const mapHandle = await loadGlobalMatchMap(scene, GLOBAL_MATCH_MAP_URL);
  const playerViewManager = createPlayerViewManager({
    scene,
    localSessionId: options.localSessionId
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
  let localVerticalVelocity = 0;
  let localGroundY = 0;
  let hasLocalGroundReference = false;
  let wasJumpPressed = false;
  let accumulatedMouseDeltaX = 0;
  let accumulatedMouseDeltaY = 0;
  let lastMovementSyncAtMs = 0;
  let lastSyncedLocalPosition: { x: number; y: number; z: number; rotationY: number } | null = null;
  let lastSprintInputSyncAtMs = 0;
  let lastSentSprintIntent: { isShiftPressed: boolean; isForwardPressed: boolean } | null = null;
  let isLocalVisualHiddenForCamera = false;
  let localUltimateRequested = false;

  const setPlayers = (players: MatchPlayerState[]): void => {
    playerViewManager.syncPlayers(players);

    const localState = playerViewManager.getLocalPlayerState();
    if (localState && !hasLocalGroundReference) {
      localGroundY = localState.y;
      hasLocalGroundReference = true;
    }
  };

  const addPlayer = (player: MatchPlayerState): void => {
    playerViewManager.addPlayer(player);

    if (player.sessionId !== options.localSessionId || hasLocalGroundReference) {
      return;
    }

    localGroundY = player.y;
    hasLocalGroundReference = true;
  };

  const updatePlayer = (player: MatchPlayerState): void => {
    playerViewManager.updatePlayer(player);

    if (player.sessionId !== options.localSessionId || hasLocalGroundReference) {
      return;
    }

    localGroundY = player.y;
    hasLocalGroundReference = true;
  };

  const removePlayer = (sessionId: string): void => {
    playerViewManager.removePlayer(sessionId);
    if (sessionId === options.localSessionId) {
      hasLocalGroundReference = false;
      localVerticalVelocity = 0;
    }
  };

  const setTeamMemberUserIds = (userIds: string[]): void => {
    playerViewManager.setTeamMemberUserIds(userIds);
  };

  const triggerLocalUltimateAnimation = (): void => {
    const localPlayerState = playerViewManager.getLocalPlayerState();
    if (!localPlayerState || !localPlayerState.isAlive) {
      return;
    }

    localUltimateRequested = true;
  };

  const setFlyModeEnabled = (enabled: boolean): void => {
    if (flyModeEnabled === enabled) {
      return;
    }

    flyModeEnabled = enabled;
    localVerticalVelocity = 0;
    wasJumpPressed = movementInput.getState().jump;
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

    accumulatedMouseDeltaX += event.movementX;
    accumulatedMouseDeltaY += event.movementY;
  };

  const setInputEnabled = (enabled: boolean): void => {
    inputEnabled = enabled;
    movementInput.setEnabled(enabled);
    pointerLockSystem.setEnabled(enabled);

    if (!enabled) {
      wasJumpPressed = false;
      exitPointerLock();
    }
  };

  const maybeEmitLocalMovement = (transform: { x: number; y: number; z: number; rotationY: number }): void => {
    if (!options.onLocalPlayerMoved) {
      return;
    }

    const nowMs = Date.now();
    const elapsedMs = nowMs - lastMovementSyncAtMs;

    const movedEnough =
      !lastSyncedLocalPosition ||
      positionDistanceSquared(transform, lastSyncedLocalPosition) >=
        LOCAL_MOVEMENT_SYNC_THRESHOLD * LOCAL_MOVEMENT_SYNC_THRESHOLD ||
      Math.abs(transform.rotationY - lastSyncedLocalPosition.rotationY) >= 0.01;

    if (!movedEnough || elapsedMs < LOCAL_MOVEMENT_SYNC_INTERVAL_MS) {
      return;
    }

    options.onLocalPlayerMoved(transform);
    lastSyncedLocalPosition = {
      x: transform.x,
      y: transform.y,
      z: transform.z,
      rotationY: transform.rotationY
    };
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
    const inputState = movementInput.getState();
    const localPlayerState = playerViewManager.getLocalPlayerState();
    const canRequestSprintIntent =
      inputEnabled &&
      !flyModeEnabled &&
      (localPlayerState?.isAlive ?? true);

    maybeEmitLocalSprintIntent({
      isShiftPressed: canRequestSprintIntent ? inputState.descend : false,
      isForwardPressed: canRequestSprintIntent ? inputState.forward : false
    });

    if (!inputEnabled || deltaSeconds <= 0) {
      return;
    }

    const localView = playerViewManager.getLocalPlayerView();
    if (!localView) {
      return;
    }

    const transform = localView.getTransform();

    if (!hasLocalGroundReference) {
      localGroundY = transform.y;
      hasLocalGroundReference = true;
    }

    const forward = resolveGroundForward(camera);
    const right = new Vector3(forward.z, 0, -forward.x);
    const aimYaw = Math.atan2(forward.x, forward.z);

    const forwardAxis = (inputState.forward ? 1 : 0) - (inputState.backward ? 1 : 0);
    const sideAxis = (inputState.right ? 1 : 0) - (inputState.left ? 1 : 0);

    const predictedMovementDirection = resolveMovementDirectionFromAxes(forwardAxis, sideAxis);
    const isPredictedMoving = predictedMovementDirection !== "none";
    const isPredictedSprinting =
      canRequestSprintIntent && inputState.descend && inputState.forward && isPredictedMoving;
    const isUltimatePredictedActive = localUltimateRequested;

    let movementVector = new Vector3(
      forward.x * forwardAxis + right.x * sideAxis,
      0,
      forward.z * forwardAxis + right.z * sideAxis
    );
    const localMoveSpeed =
      !flyModeEnabled && (isPredictedSprinting || (localPlayerState?.isSprinting ?? false))
        ? LOCAL_WALK_SPEED * LOCAL_RUN_SPEED_MULTIPLIER
        : LOCAL_WALK_SPEED;

    if (movementVector.lengthSquared() > 0.0001) {
      movementVector = movementVector.normalize();
      transform.x += movementVector.x * localMoveSpeed * deltaSeconds;
      transform.z += movementVector.z * localMoveSpeed * deltaSeconds;
    }

    // A frente do personagem acompanha sempre a direção da câmera/crosshair (TPS over-the-shoulder).
    transform.rotationY = aimYaw;

    if (flyModeEnabled) {
      const verticalAxis = (inputState.jump ? 1 : 0) - (inputState.descend ? 1 : 0);
      if (verticalAxis !== 0) {
        transform.y += verticalAxis * LOCAL_FLY_VERTICAL_SPEED * deltaSeconds;
      }

      localVerticalVelocity = 0;
      wasJumpPressed = inputState.jump;
      const predictedAnimationState: AnimationGameplayState = {
        isMoving: isPredictedMoving,
        movementDirection: predictedMovementDirection,
        isSprinting: false,
        isJumping: false,
        isUltimateActive: isUltimatePredictedActive
      };
      playerViewManager.updateLocalPlayerTransform(transform, predictedAnimationState);
      localUltimateRequested = false;
      maybeEmitLocalMovement(transform);
      return;
    }

    const isGrounded = transform.y <= localGroundY + GROUND_EPSILON;
    if (isGrounded && localVerticalVelocity < 0) {
      localVerticalVelocity = 0;
      transform.y = localGroundY;
    }

    const didPressJump = inputState.jump && !wasJumpPressed;
    if (didPressJump && isGrounded) {
      localVerticalVelocity = LOCAL_JUMP_VELOCITY;
    }

    if (!isGrounded || localVerticalVelocity > 0) {
      localVerticalVelocity -= LOCAL_GRAVITY * deltaSeconds;
      transform.y += localVerticalVelocity * deltaSeconds;

      if (transform.y <= localGroundY) {
        transform.y = localGroundY;
        localVerticalVelocity = 0;
      }
    }

    wasJumpPressed = inputState.jump;
    const predictedAnimationState: AnimationGameplayState = {
      isMoving: isPredictedMoving,
      movementDirection: predictedMovementDirection,
      isSprinting: isPredictedSprinting,
      isJumping:
        transform.y > localGroundY + GROUND_EPSILON ||
        localVerticalVelocity > 0.01 ||
        didPressJump,
      isUltimateActive: isUltimatePredictedActive
    };
    playerViewManager.updateLocalPlayerTransform(transform, predictedAnimationState);
    localUltimateRequested = false;
    maybeEmitLocalMovement(transform);
  };

  const applyMouseLook = (): void => {
    if (!pointerLocked || !inputEnabled) {
      accumulatedMouseDeltaX = 0;
      accumulatedMouseDeltaY = 0;
      return;
    }

    if (accumulatedMouseDeltaX === 0 && accumulatedMouseDeltaY === 0) {
      return;
    }

    camera.alpha -= accumulatedMouseDeltaX * CAMERA_MOUSE_SENSITIVITY;
    camera.beta = clamp(
      camera.beta - accumulatedMouseDeltaY * CAMERA_MOUSE_SENSITIVITY,
      CAMERA_MIN_BETA,
      CAMERA_MAX_BETA
    );

    accumulatedMouseDeltaX = 0;
    accumulatedMouseDeltaY = 0;
  };

  const disposePointerLockChange = pointerLockSystem.onLockChange((locked) => {
    pointerLocked = locked;
    if (!locked) {
      accumulatedMouseDeltaX = 0;
      accumulatedMouseDeltaY = 0;
    }

    pointerLockChangeListeners.forEach((listener) => {
      listener(locked);
    });
  });

  document.addEventListener("mousemove", onMouseMove);

  setPlayers(options.initialPlayers ?? []);

  engine.runRenderLoop(() => {
    applyMouseLook();
    const deltaSeconds = Math.min(MAX_FRAME_DELTA_SECONDS, engine.getDeltaTime() / 1000);
    applyLocalMovement(deltaSeconds);
    playerViewManager.tick(Date.now());

    const localView = playerViewManager.getLocalPlayerView();
    if (localView) {
      const cameraTarget = resolveOverShoulderTargetPosition(localView.getTransform(), camera.alpha);
      cameraTargetNode.position.set(cameraTarget.x, cameraTarget.y, cameraTarget.z);

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
    triggerLocalUltimateAnimation,
    dispose: () => {
      window.removeEventListener("resize", onWindowResize);
      document.removeEventListener("mousemove", onMouseMove);
      setInputEnabled(false);
      disposePointerLockChange();
      pointerLockChangeListeners.clear();
      pointerLockSystem.dispose();

      movementInput.dispose();
      playerViewManager.dispose();

      mapHandle.dispose();
      camera.lockedTarget = null;
      cameraTargetNode.dispose();
      scene.dispose();
      engine.stopRenderLoop();
      engine.dispose();
    }
  };
}
