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
import { createPlayerViewManager } from "../systems/player-view-manager";
import { createMovementInputSystem } from "../systems/movement-input.system";
import { GLOBAL_MATCH_MAP_URL, loadGlobalMatchMap } from "../systems/map-loader.system";

const CAMERA_RADIUS = 6.8;
const CAMERA_MIN_BETA = 0.62;
const CAMERA_MAX_BETA = 1.46;
const CAMERA_MOUSE_SENSITIVITY = 0.0022;
const LOCAL_MOVE_SPEED = 5.4;
const LOCAL_JUMP_VELOCITY = 7.6;
const LOCAL_GRAVITY = 22;
const MAX_FRAME_DELTA_SECONDS = 0.05;
const GROUND_EPSILON = 0.0001;
const LOCAL_MOVEMENT_SYNC_INTERVAL_MS = 50;
const LOCAL_MOVEMENT_SYNC_THRESHOLD = 0.015;

export type GlobalMatchSceneOptions = {
  canvas: HTMLCanvasElement;
  localSessionId: string;
  initialPlayers?: MatchPlayerState[];
  onLocalPlayerMoved?: (position: { x: number; y: number; z: number; rotationY: number }) => void;
};

export type GlobalMatchSceneHandle = {
  setPlayers: (players: MatchPlayerState[]) => void;
  addPlayer: (player: MatchPlayerState) => void;
  updatePlayer: (player: MatchPlayerState) => void;
  removePlayer: (sessionId: string) => void;
  setTeamMemberUserIds: (userIds: string[]) => void;
  setInputEnabled: (enabled: boolean) => void;
  requestPointerLock: () => void;
  exitPointerLock: () => void;
  isPointerLocked: () => boolean;
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
    1.08,
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
  let pointerLocked = false;
  let localVerticalVelocity = 0;
  let localGroundY = 0;
  let hasLocalGroundReference = false;
  let wasJumpPressed = false;
  let accumulatedMouseDeltaX = 0;
  let accumulatedMouseDeltaY = 0;
  let lastMovementSyncAtMs = 0;
  let lastSyncedLocalPosition: { x: number; y: number; z: number; rotationY: number } | null = null;

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

  const requestPointerLock = (): void => {
    if (!inputEnabled || document.pointerLockElement === options.canvas) {
      return;
    }

    if (typeof options.canvas.requestPointerLock === "function") {
      void options.canvas.requestPointerLock();
    }
  };

  const exitPointerLock = (): void => {
    if (document.pointerLockElement !== options.canvas) {
      return;
    }

    if (typeof document.exitPointerLock === "function") {
      void document.exitPointerLock();
    }
  };

  const onPointerLockChange = (): void => {
    pointerLocked = document.pointerLockElement === options.canvas;
  };

  const onMouseMove = (event: MouseEvent): void => {
    if (!pointerLocked || !inputEnabled) {
      return;
    }

    accumulatedMouseDeltaX += event.movementX;
    accumulatedMouseDeltaY += event.movementY;
  };

  const onCanvasClick = (): void => {
    requestPointerLock();
  };

  const setInputEnabled = (enabled: boolean): void => {
    inputEnabled = enabled;
    movementInput.setEnabled(enabled);

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

  const applyLocalMovement = (deltaSeconds: number): void => {
    if (!inputEnabled || deltaSeconds <= 0) {
      return;
    }

    const localView = playerViewManager.getLocalPlayerView();
    if (!localView) {
      return;
    }

    const inputState = movementInput.getState();
    const transform = localView.getTransform();

    if (!hasLocalGroundReference) {
      localGroundY = transform.y;
      hasLocalGroundReference = true;
    }

    const forward = resolveGroundForward(camera);
    const right = new Vector3(forward.z, 0, -forward.x);

    const forwardAxis = (inputState.forward ? 1 : 0) - (inputState.backward ? 1 : 0);
    const sideAxis = (inputState.right ? 1 : 0) - (inputState.left ? 1 : 0);

    let movementDirection = new Vector3(
      forward.x * forwardAxis + right.x * sideAxis,
      0,
      forward.z * forwardAxis + right.z * sideAxis
    );

    if (movementDirection.lengthSquared() > 0.0001) {
      movementDirection = movementDirection.normalize();
      transform.x += movementDirection.x * LOCAL_MOVE_SPEED * deltaSeconds;
      transform.z += movementDirection.z * LOCAL_MOVE_SPEED * deltaSeconds;
      transform.rotationY = Math.atan2(movementDirection.x, movementDirection.z);
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
    playerViewManager.updateLocalPlayerTransform(transform);
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

  document.addEventListener("pointerlockchange", onPointerLockChange);
  document.addEventListener("mousemove", onMouseMove);
  options.canvas.addEventListener("click", onCanvasClick);

  setPlayers(options.initialPlayers ?? []);

  engine.runRenderLoop(() => {
    applyMouseLook();
    const deltaSeconds = Math.min(MAX_FRAME_DELTA_SECONDS, engine.getDeltaTime() / 1000);
    applyLocalMovement(deltaSeconds);

    const localView = playerViewManager.getLocalPlayerView();
    if (localView) {
      const target = localView.getCameraTarget();
      cameraTargetNode.position.set(target.x, target.y, target.z);
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
    setInputEnabled,
    requestPointerLock,
    exitPointerLock,
    isPointerLocked: () => pointerLocked,
    dispose: () => {
      window.removeEventListener("resize", onWindowResize);
      document.removeEventListener("pointerlockchange", onPointerLockChange);
      document.removeEventListener("mousemove", onMouseMove);
      options.canvas.removeEventListener("click", onCanvasClick);

      movementInput.dispose();
      setInputEnabled(false);
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
