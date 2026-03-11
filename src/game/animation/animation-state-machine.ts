// Responsável por traduzir o estado canônico do personagem em um AnimationGameplayState consistente.
import type { CombatHookState } from "../combat/combat-hooks";
import type { CharacterLocomotionSnapshot } from "../locomotion/locomotion-state";
import type { AnimationGameplayState } from "./animation-state";

export function resolveAnimationGameplayState(params: {
  snapshot: CharacterLocomotionSnapshot;
  combat: CombatHookState;
}): AnimationGameplayState {
  return {
    isDead: !params.combat.isAlive,
    isMoving: params.snapshot.isMoving,
    movementDirection: params.snapshot.movementDirection,
    isSprinting: params.snapshot.isSprinting,
    isJumping:
      params.snapshot.state === "JumpStart" ||
      params.snapshot.state === "InAir" ||
      params.snapshot.state === "Fall" ||
      params.snapshot.state === "DoubleJump" ||
      params.snapshot.state === "WallRun",
    isCrouching: params.snapshot.isCrouching,
    isSliding: params.snapshot.isSliding,
    isWallRunning: params.snapshot.isWallRunning,
    isUltimateActive: params.combat.isUltimateActive,
    isBlocking: params.combat.isBlocking && params.combat.attackComboIndex === 0,
    attackComboIndex: params.combat.attackComboIndex,
    isHitReacting: params.snapshot.state === "Hit" || params.snapshot.state === "Stunned",
    locomotionState: params.snapshot.state
  };
}

