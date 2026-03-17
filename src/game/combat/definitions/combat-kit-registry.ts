// Responsável por registrar kits de combate cliente por herói e resolver fallbacks de predição.
import { DEFAULT_CHAMPION_COMBAT_KIT } from "./heroes/default-champion.combat";
import type {
  CombatActionDefinition,
  CombatComboIndex,
  CombatKitDefinition,
  CombatSkillSlot
} from "./combat-types";

const COMBAT_KITS_BY_HERO_ID = new Map<string, CombatKitDefinition>([
  ["default_champion", DEFAULT_CHAMPION_COMBAT_KIT]
]);

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
