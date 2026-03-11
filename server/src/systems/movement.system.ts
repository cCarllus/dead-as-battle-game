// Sistema de movimento autoritativo: processa input, sprint e atualização de transform por tick fixo.
import type { MatchPlayerMovedPayload, MatchPlayerState } from "../models/match-player.model.js";
import type { PlayerMovementState } from "../services/movement-state.service.js";
import {
  applyAuthoritativeMove,
  type NormalizedMoveIntent
} from "../services/movement.service.js";
import { updateSprintState, type SprintInputState } from "../services/stamina.service.js";

const ENABLE_MOVEMENT_LOGS = process.env.MATCH_LOG_MOVEMENT === "1";

type PlayerMovedEvent = MatchPlayerMovedPayload;

export type MovementSystemResult = {
  didChangeState: boolean;
  movedPlayers: PlayerMovedEvent[];
};

export type MovementSystem = {
  update: (deltaSeconds: number, now: number) => MovementSystemResult;
  clearPlayer: (sessionId: string) => void;
};

export function createMovementSystem(options: {
  players: () => Record<string, MatchPlayerState>;
  moveIntentBySessionId: Map<string, NormalizedMoveIntent>;
  sprintInputBySessionId: Map<string, SprintInputState>;
  movementStateBySessionId: Map<string, PlayerMovementState>;
}): MovementSystem {
  return {
    update: (deltaSeconds, now) => {
      const players = options.players();
      let didChangeState = false;
      const movedPlayers: PlayerMovedEvent[] = [];

      Object.values(players).forEach((player) => {
        const sprintInput = options.sprintInputBySessionId.get(player.sessionId) ?? {
          isShiftPressed: false,
          isForwardPressed: false
        };

        const previousCurrentStamina = player.currentStamina;
        const previousIsSprinting = player.isSprinting;
        const previousSprintBlocked = player.sprintBlocked;
        const previousLastSprintEndedAt = player.lastSprintEndedAt;

        updateSprintState(player, sprintInput, deltaSeconds, now);
        if (
          player.currentStamina !== previousCurrentStamina ||
          player.isSprinting !== previousIsSprinting ||
          player.sprintBlocked !== previousSprintBlocked ||
          player.lastSprintEndedAt !== previousLastSprintEndedAt
        ) {
          didChangeState = true;
        }

        const moveIntent = options.moveIntentBySessionId.get(player.sessionId);
        if (!moveIntent) {
          return;
        }

        const moveResult = applyAuthoritativeMove({
          player,
          movementStateBySessionId: options.movementStateBySessionId,
          moveIntent,
          players,
          now
        });

        if (!moveResult.moved && !moveResult.locomotionChanged) {
          return;
        }

        movedPlayers.push({
          sessionId: player.sessionId,
          x: moveResult.x,
          y: moveResult.y,
          z: moveResult.z,
          rotationY: moveResult.rotationY,
          locomotionState: player.locomotionState,
          isCrouching: player.isCrouching,
          isRolling: player.isRolling,
          isWallRunning: player.isWallRunning,
          wallRunSide: player.wallRunSide,
          verticalVelocity: player.verticalVelocity
        });
        didChangeState = true;

        if (ENABLE_MOVEMENT_LOGS) {
          console.debug(
            `[MOVE] ${player.nickname} moved to X:${moveResult.x.toFixed(2)} Y:${moveResult.y.toFixed(
              2
            )} Z:${moveResult.z.toFixed(2)}`
          );
        }
      });

      return {
        didChangeState,
        movedPlayers
      };
    },
    clearPlayer: (sessionId) => {
      options.moveIntentBySessionId.delete(sessionId);
      options.sprintInputBySessionId.delete(sessionId);
      options.movementStateBySessionId.delete(sessionId);
    }
  };
}
