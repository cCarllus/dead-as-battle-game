// Responsável por registrar kits de combate por herói e resolver fallbacks de forma estável.
import { DEFAULT_CHAMPION_COMBAT_KIT } from "./heroes/default-champion.combat.js";
import type {
  CombatActionDefinition,
  CombatComboIndex,
  CombatKitDefinition,
  CombatSkillSlot
} from "./combat-types.js";

const COMBAT_KITS_BY_HERO_ID = new Map<string, CombatKitDefinition>([
  ["default_champion", DEFAULT_CHAMPION_COMBAT_KIT]
]);

export const REGISTERED_COMBAT_HERO_IDS = Array.from(COMBAT_KITS_BY_HERO_ID.keys());

export function resolveCombatKitDefinition(heroId: string): CombatKitDefinition {
  return COMBAT_KITS_BY_HERO_ID.get(heroId) ?? DEFAULT_CHAMPION_COMBAT_KIT;
}

export function resolveBasicAttackDefinition(
  heroId: string,
  comboIndex: CombatComboIndex
): CombatActionDefinition {
  const kit = resolveCombatKitDefinition(heroId);
  return kit.basicAttacks[comboIndex - 1] ?? kit.basicAttacks[0];
}

export function resolveSkillDefinition(
  heroId: string,
  slot: CombatSkillSlot
): CombatActionDefinition {
  return resolveCombatKitDefinition(heroId).skillsBySlot[slot];
}
