// Responsável por deduplicar e despachar hooks de áudio reativos ao snapshot de locomoção do personagem.
import type { CharacterAudioEvent } from "./audio-events";
import type { CharacterLocomotionSnapshot } from "../locomotion/locomotion-state";

export type CharacterAudioListener = (event: CharacterAudioEvent, snapshot: CharacterLocomotionSnapshot) => void;

export type CharacterAudioController = {
  onEvent: (listener: CharacterAudioListener) => () => void;
  sync: (snapshot: CharacterLocomotionSnapshot) => void;
  dispose: () => void;
};

export function createCharacterAudioController(): CharacterAudioController {
  const listeners = new Set<CharacterAudioListener>();
  let lastState = "";
  let lastFootstepAt = 0;

  const emit = (event: CharacterAudioEvent, snapshot: CharacterLocomotionSnapshot): void => {
    listeners.forEach((listener) => {
      listener(event, snapshot);
    });
  };

  return {
    onEvent: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    sync: (snapshot) => {
      const now = snapshot.nowMs;

      if (snapshot.didGroundJump) {
        emit("jump", snapshot);
      }

      if (snapshot.didLand) {
        emit("land", snapshot);
      }

      if (snapshot.didCrouchEnter) {
        emit("crouchEnter", snapshot);
      }

      if (snapshot.didCrouchExit) {
        emit("crouchExit", snapshot);
      }

      if (snapshot.didSlideStart) {
        emit("slideStart", snapshot);
      }

      if (snapshot.didSlideEnd) {
        emit("slideEnd", snapshot);
      }

      if (snapshot.didWallRunStart) {
        emit("wallRunStart", snapshot);
      }

      if (snapshot.didWallRunEnd) {
        emit("wallRunEnd", snapshot);
      }

      const shouldEmitFootstep =
        snapshot.isGrounded &&
        snapshot.isMoving &&
        !snapshot.isSliding &&
        !snapshot.isWallRunning &&
        (snapshot.state === "Walk" || snapshot.state === "Run" || snapshot.state === "CrouchWalk");

      const footstepIntervalMs = snapshot.isSprinting ? 240 : snapshot.state === "CrouchWalk" ? 420 : 330;

      if (shouldEmitFootstep && now - lastFootstepAt >= footstepIntervalMs) {
        emit(snapshot.isSprinting ? "sprintFootstep" : "footstep", snapshot);
        lastFootstepAt = now;
      }

      if (snapshot.isSliding && lastState !== "Slide") {
        emit("slideLoop", snapshot);
      }

      if (snapshot.isWallRunning && !snapshot.didWallRunStart) {
        emit("wallRunLoop", snapshot);
      }

      lastState = snapshot.state;
    },
    dispose: () => {
      listeners.clear();
      lastState = "";
      lastFootstepAt = 0;
    }
  };
}

