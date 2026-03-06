// Responsável por inicializar a cena multiplayer global, carregar mapa e sincronizar entidades de jogadores.
import {
  ArcRotateCamera,
  Color4,
  Engine,
  HemisphericLight,
  Scene,
  Vector3
} from "@babylonjs/core";
import type { MatchPlayerState } from "../../models/match-player.model";
import { createMatchPlayerEntity, type MatchPlayerEntity } from "../entities/player.entity";
import { createMovementInputSystem } from "../systems/movement-input.system";
import { GLOBAL_MATCH_MAP_URL, loadGlobalMatchMap } from "../systems/map-loader.system";

const CAMERA_RADIUS = 8.4;
const CAMERA_MIN_BETA = 0.62;
const CAMERA_MAX_BETA = 1.46;
const CAMERA_MOUSE_SENSITIVITY = 0.0022;

export type GlobalMatchSceneOptions = {
  canvas: HTMLCanvasElement;
  localSessionId: string;
  initialPlayers?: MatchPlayerState[];
};

export type GlobalMatchSceneHandle = {
  setPlayers: (players: MatchPlayerState[]) => void;
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

function clonePlayer(player: MatchPlayerState): MatchPlayerState {
  return {
    ...player,
    position: {
      x: player.position.x,
      y: player.position.y,
      z: player.position.z
    }
  };
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

  const mapHandle = await loadGlobalMatchMap(scene, GLOBAL_MATCH_MAP_URL);
  const entitiesBySessionId = new Map<string, MatchPlayerEntity>();
  const movementInput = createMovementInputSystem();

  let localPlayerEntity: MatchPlayerEntity | null = null;
  let inputEnabled = true;
  let pointerLocked = false;
  let latestPlayers: MatchPlayerState[] = [];
  let teamMemberUserIds = new Set<string>();

  const clearEntities = (): void => {
    entitiesBySessionId.forEach((entity) => {
      entity.dispose();
    });
    entitiesBySessionId.clear();
    localPlayerEntity = null;
  };

  const createEntityByContext = (player: MatchPlayerState, localUserId: string | null): MatchPlayerEntity => {
    const isLocalPlayer = player.sessionId === options.localSessionId;
    const isTeammate = !isLocalPlayer && localUserId !== null && teamMemberUserIds.has(player.userId);

    const accentColorHex = isLocalPlayer
      ? "#facc15"
      : isTeammate
        ? "#60a5fa"
        : "#fb7185";
    const labelColorHex = isLocalPlayer
      ? "#fde68a"
      : isTeammate
        ? "#bfdbfe"
        : "#fecdd3";

    return createMatchPlayerEntity({
      scene,
      player,
      accentColorHex,
      labelColorHex,
      labelPrefix: isTeammate ? "● " : ""
    });
  };

  const renderPlayers = (): void => {
    clearEntities();

    if (latestPlayers.length === 0) {
      return;
    }

    const localPlayer = latestPlayers.find((player) => player.sessionId === options.localSessionId) ?? null;
    const localUserId = localPlayer?.userId ?? null;

    latestPlayers.forEach((player) => {
      const entity = createEntityByContext(player, localUserId);
      entitiesBySessionId.set(player.sessionId, entity);

      if (player.sessionId === options.localSessionId) {
        localPlayerEntity = entity;
      }
    });
  };

  const setPlayers = (players: MatchPlayerState[]): void => {
    latestPlayers = players.map((player) => clonePlayer(player));
    renderPlayers();
  };

  const setTeamMemberUserIds = (userIds: string[]): void => {
    teamMemberUserIds = new Set(userIds);
    renderPlayers();
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

    camera.alpha -= event.movementX * CAMERA_MOUSE_SENSITIVITY;
    camera.beta = clamp(
      camera.beta - event.movementY * CAMERA_MOUSE_SENSITIVITY,
      CAMERA_MIN_BETA,
      CAMERA_MAX_BETA
    );
  };

  const onCanvasClick = (): void => {
    requestPointerLock();
  };

  const setInputEnabled = (enabled: boolean): void => {
    inputEnabled = enabled;
    movementInput.setEnabled(enabled);

    if (!enabled) {
      exitPointerLock();
    }
  };

  document.addEventListener("pointerlockchange", onPointerLockChange);
  document.addEventListener("mousemove", onMouseMove);
  options.canvas.addEventListener("click", onCanvasClick);

  setPlayers(options.initialPlayers ?? []);

  engine.runRenderLoop(() => {
    const localCameraTarget = localPlayerEntity?.getCameraTarget();
    if (localCameraTarget) {
      camera.setTarget(localCameraTarget);
    }

    void movementInput.getState();
    scene.render();
  });

  const onWindowResize = (): void => {
    engine.resize();
  };

  window.addEventListener("resize", onWindowResize);

  return {
    setPlayers,
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
      clearEntities();

      mapHandle.dispose();
      scene.dispose();
      engine.stopRenderLoop();
      engine.dispose();
    }
  };
}
