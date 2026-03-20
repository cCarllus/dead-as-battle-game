// Responsável por definir o espelho cliente do kit de combate do default_champion.
import { createCombatAction, createCombatKit } from "../combat-kit.utils";
import { BASE_HUMANOID_BASIC_ATTACKS, BASE_HUMANOID_COMBAT_KIT } from "../combat-definition";
import type { CombatKitDefinition } from "../combat-types";

const DEFAULT_CHAMPION_BASIC_ATTACKS: CombatKitDefinition["basicAttacks"] = [
  createCombatAction(BASE_HUMANOID_BASIC_ATTACKS[0], {
    id: "default_champion.basic.1",
    animationCommand: "attack1"
  }),
  createCombatAction(BASE_HUMANOID_BASIC_ATTACKS[1], {
    id: "default_champion.basic.2",
    animationCommand: "attack2"
  }),
  createCombatAction(BASE_HUMANOID_BASIC_ATTACKS[2], {
    id: "default_champion.basic.3",
    animationCommand: "attack3"
  })
];

export const DEFAULT_CHAMPION_COMBAT_KIT: CombatKitDefinition = createCombatKit(
  BASE_HUMANOID_COMBAT_KIT,
  {
    basicAttacks: DEFAULT_CHAMPION_BASIC_ATTACKS,
    skillsBySlot: {
      1: {
        id: "default_champion.skill.fireball",
        kind: "skill",
        skillSlot: 1,
        skillId: "fireball",
        animationCommand: "fireball",
        windupMs: 220,
        activeMs: 120,
        recoveryMs: 260,
        comboQueueWindowMs: 0,
        cooldownMs: 4200,
        movementLock: "partial"
      },
      2: {
        id: "default_champion.skill.kick_skill",
        kind: "skill",
        skillSlot: 2,
        skillId: "kick-skill",
        animationCommand: "kickSkill",
        windupMs: 180,
        activeMs: 160,
        recoveryMs: 280,
        comboQueueWindowMs: 0,
        cooldownMs: 6000,
        movementLock: "full"
      },
      3: {
        id: "default_champion.skill.repeat_kick",
        kind: "skill",
        skillSlot: 3,
        skillId: "reapet-kick",
        animationCommand: "repeatKick",
        windupMs: 160,
        activeMs: 360,
        recoveryMs: 280,
        comboQueueWindowMs: 0,
        cooldownMs: 7600,
        movementLock: "full"
      },
      4: {
        id: "default_champion.skill.spell",
        kind: "skill",
        skillSlot: 4,
        skillId: "spell",
        animationCommand: "spell",
        windupMs: 260,
        activeMs: 120,
        recoveryMs: 320,
        comboQueueWindowMs: 0,
        cooldownMs: 9000,
        movementLock: "partial"
      },
      5: {
        id: "default_champion.skill.ultimate",
        kind: "skill",
        skillSlot: 5,
        skillId: "ultimate",
        animationCommand: "ultimate",
        windupMs: 500,
        activeMs: 220,
        recoveryMs: 540,
        comboQueueWindowMs: 0,
        cooldownMs: 18000,
        movementLock: "full"
      }
    }
  }
);
