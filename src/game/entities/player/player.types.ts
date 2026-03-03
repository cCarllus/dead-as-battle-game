import type { Mesh } from "@babylonjs/core";

export type CharacterId = "ryomen_sukuna" | "kaiju_n8" | "ainz_ooal_gown";

export type PlayerEntity = {
  character: CharacterId;
  mesh: Mesh;
};
