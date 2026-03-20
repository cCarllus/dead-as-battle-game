// Responsável por montar o runtime jogável local de personagem (colisão, grounded, locomoção e áudio) como unidade reutilizável.
import type { AbstractMesh, Scene } from "@babylonjs/core";
import { createCharacterAudioController, type CharacterAudioController } from "../audio/character-audio-controller";
import { createGroundedSystem } from "../locomotion/grounded-system";
import {
  createCharacterLocomotionSystem,
  type CharacterLocomotionSystem
} from "../locomotion/character-locomotion-system";
import type { LocalPlayerView } from "../entities/local-player.view";
import type { HavokBootstrapResult } from "../physics/havok-bootstrap";
import { createCharacterControllerAdapter } from "../physics/character-controller-adapter";
import type { PhysicsWorld } from "../physics/physics-world";
import {
  createShapeQueryService,
  type ShapeQueryService
} from "../physics/shape-query-service";
import { createCollisionSystem, type CollisionSystem } from "../systems/collision.system";

export type LocalCharacterGameplayRuntime = {
  collisionSystem: CollisionSystem;
  locomotionSystem: CharacterLocomotionSystem;
  audioController: CharacterAudioController;
  shapeQueryService: ShapeQueryService;
  ownerCollisionBodyId: number;
  ownerHeroId: string;
  dispose: () => void;
};

export type CreateLocalCharacterGameplayRuntimeOptions = {
  scene: Scene;
  localPlayerView: LocalPlayerView;
  physicsBootstrap: HavokBootstrapResult;
  physicsWorld: PhysicsWorld;
  mapMeshes: AbstractMesh[];
  isEnvironmentMesh: (mesh: AbstractMesh) => boolean;
  isClimbableMesh: (mesh: AbstractMesh) => boolean;
};

export function createLocalCharacterGameplayRuntime(
  options: CreateLocalCharacterGameplayRuntimeOptions
): LocalCharacterGameplayRuntime {
  const runtimeConfig = options.localPlayerView.getRuntimeConfig();
  const shapeQueryService = createShapeQueryService({
    scene: options.scene,
    resolveMeshFromBody: (body) => options.physicsWorld.resolveMeshFromBody(body)
  });

  const characterControllerAdapter =
    options.physicsBootstrap.enabled && options.physicsBootstrap.usingHavok
      ? createCharacterControllerAdapter({
          scene: options.scene,
          gameplayRoot: options.localPlayerView.gameplayRoot,
          collisionBody: options.localPlayerView.collisionBody,
          runtimeConfig,
          shapeQueryService
        })
      : null;

  const collisionSystem = createCollisionSystem({
    scene: options.scene,
    gameplayRoot: options.localPlayerView.gameplayRoot,
    collisionBody: options.localPlayerView.collisionBody,
    runtimeConfig,
    characterControllerAdapter
  });
  collisionSystem.configureStaticMeshes(options.mapMeshes);

  const groundedSystem = createGroundedSystem({
    scene: options.scene,
    runtimeConfig,
    getControllerGroundInfo: () => collisionSystem.getGroundInfo(),
    getControllerRootPosition: () => options.localPlayerView.gameplayRoot.position.clone(),
    isGroundMesh: options.isEnvironmentMesh
  });

  const locomotionSystem = createCharacterLocomotionSystem({
    scene: options.scene,
    runtimeConfig,
    collisionSystem,
    groundedSystem,
    isEnvironmentMesh: options.isEnvironmentMesh,
    isClimbableMesh: options.isClimbableMesh,
    shapeQueryService
  });
  const audioController = createCharacterAudioController();

  return {
    collisionSystem,
    locomotionSystem,
    audioController,
    shapeQueryService,
    ownerCollisionBodyId: options.localPlayerView.collisionBody.uniqueId,
    ownerHeroId: options.localPlayerView.heroId,
    dispose: () => {
      shapeQueryService.dispose();
      audioController.dispose();
      locomotionSystem.dispose();
      collisionSystem.dispose();
    }
  };
}
