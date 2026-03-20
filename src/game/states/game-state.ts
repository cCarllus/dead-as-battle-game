export const GAME_STATE = Object.freeze({
  boot: "boot",
  sandbox: "sandbox"
});

export type GameStateId = (typeof GAME_STATE)[keyof typeof GAME_STATE];
