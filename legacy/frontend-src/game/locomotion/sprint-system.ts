// Responsável por detectar início de sprint e controlar burst curto de aceleração para resposta imediata.
export type SprintSystemInput = {
  nowMs: number;
  isSprinting: boolean;
};

export type SprintSystemOutput = {
  didStartSprint: boolean;
  burstMultiplier: number;
  isBurstActive: boolean;
};

export type SprintSystem = {
  update: (input: SprintSystemInput) => SprintSystemOutput;
  reset: () => void;
};

export type CreateSprintSystemOptions = {
  burstDurationMs: number;
  burstMultiplier: number;
};

export function createSprintSystem(options: CreateSprintSystemOptions): SprintSystem {
  let sprintBurstUntilMs = 0;
  let wasSprinting = false;

  return {
    update: (input) => {
      const didStartSprint = !wasSprinting && input.isSprinting;
      if (didStartSprint) {
        sprintBurstUntilMs = input.nowMs + options.burstDurationMs;
      }

      wasSprinting = input.isSprinting;

      const isBurstActive = input.isSprinting && input.nowMs < sprintBurstUntilMs;
      return {
        didStartSprint,
        burstMultiplier: isBurstActive ? options.burstMultiplier : 1,
        isBurstActive
      };
    },
    reset: () => {
      sprintBurstUntilMs = 0;
      wasSprinting = false;
    }
  };
}
