// Responsável por compor kits base + overrides por herói sem exigir herança de classes.
import type {
  CombatActionDefinition,
  CombatKitDefinition,
  CombatSkillSlot
} from "./combat-types.js";

export type CombatActionOverrides = Partial<CombatActionDefinition>;

export type CombatKitOverrides = Partial<Omit<CombatKitDefinition, "basicAttacks" | "skillsBySlot">> & {
  basicAttacks?: readonly CombatActionDefinition[];
  skillsBySlot?: Partial<Record<CombatSkillSlot, CombatActionDefinition>>;
};

export function createCombatAction(
  baseAction: CombatActionDefinition,
  overrides: CombatActionOverrides
): CombatActionDefinition {
  return {
    ...baseAction,
    ...overrides,
    hitBursts: overrides.hitBursts ?? baseAction.hitBursts ?? [{ offsetMs: 0 }],
    vfxHook: overrides.vfxHook === undefined ? baseAction.vfxHook ?? null : overrides.vfxHook,
    sfxHook: overrides.sfxHook === undefined ? baseAction.sfxHook ?? null : overrides.sfxHook
  };
}

export function createCombatSkillsBySlot(
  baseSkillsBySlot: CombatKitDefinition["skillsBySlot"],
  overrides: CombatKitOverrides["skillsBySlot"] = {}
): CombatKitDefinition["skillsBySlot"] {
  return {
    1: overrides[1] ?? baseSkillsBySlot[1],
    2: overrides[2] ?? baseSkillsBySlot[2],
    3: overrides[3] ?? baseSkillsBySlot[3],
    4: overrides[4] ?? baseSkillsBySlot[4],
    5: overrides[5] ?? baseSkillsBySlot[5]
  };
}

export function createCombatKit(
  baseKit: CombatKitDefinition,
  overrides: CombatKitOverrides = {}
): CombatKitDefinition {
  return {
    ...baseKit,
    ...overrides,
    basicAttacks: overrides.basicAttacks ?? baseKit.basicAttacks,
    skillsBySlot: createCombatSkillsBySlot(baseKit.skillsBySlot, overrides.skillsBySlot)
  };
}
