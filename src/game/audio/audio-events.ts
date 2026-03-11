// Responsável por definir eventos padronizados de áudio disparados pela fundação de personagem.
export const CHARACTER_AUDIO_EVENTS = [
  "footstep",
  "sprintFootstep",
  "jump",
  "land",
  "crouchEnter",
  "crouchExit",
  "slideStart",
  "slideLoop",
  "slideEnd",
  "wallRunStart",
  "wallRunLoop",
  "wallRunEnd"
] as const;

export type CharacterAudioEvent = (typeof CHARACTER_AUDIO_EVENTS)[number];

