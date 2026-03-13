// Responsável por traduzir o estado canônico do personagem em um AnimationGameplayState consistente.
import type { CombatHookState } from "../combat/combat-hooks";
import type { CharacterLocomotionSnapshot } from "../locomotion/locomotion-state";
import type { AnimationGameplayState } from "./animation-state";

export function resolveAnimationGameplayState(params: {
  snapshot: CharacterLocomotionSnapshot;
  combat: CombatHookState;
}): AnimationGameplayState {
  const isLedgeState =
    params.snapshot.state === "LedgeHang" ||
    params.snapshot.state === "LedgeClimb" ||
    params.snapshot.state === "Hanging" ||
    params.snapshot.state === "ClimbingUp" ||
    params.snapshot.state === "MantlingLowObstacle";

  return {
    isDead: !params.combat.isAlive,
    isMoving: params.snapshot.isMoving,
    movementDirection: params.snapshot.movementDirection,
    isSprinting: params.snapshot.isSprinting,
    isJumping:
      params.snapshot.state === "JumpStart" ||
      params.snapshot.state === "Jumping" ||
      params.snapshot.state === "InAir" ||
      params.snapshot.state === "Fall" ||
      params.snapshot.state === "Falling" ||
      params.snapshot.state === "DoubleJump",
    isCrouching: params.snapshot.isCrouching,
    isRolling: params.snapshot.isRolling,
    isWallRunning: false,
    isUltimateActive: params.combat.isUltimateActive,
    isBlocking: !isLedgeState && params.combat.isBlocking && params.combat.attackComboIndex === 0,
    attackComboIndex: isLedgeState ? 0 : params.combat.attackComboIndex,
    isHitReacting: params.snapshot.state === "Hit" || params.snapshot.state === "Stunned",
    locomotionState: params.snapshot.state,
    restartCommand: params.snapshot.didGroundJump
      ? "jump"
      : params.snapshot.didDoubleJump
        ? "doubleJump"
        : params.snapshot.didRollingStart
          ? "rolling"
          : null
  };
}
