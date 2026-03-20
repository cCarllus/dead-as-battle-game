// Responsável por definir o kit base compartilhado de predição local para humanoides.
import { createCombatAction, createCombatKit } from "./combat-kit.utils";
import type { CombatActionDefinition, CombatKitDefinition, CombatSkillSlot } from "./combat-types";

function createPlaceholderSkill(slot: CombatSkillSlot): CombatActionDefinition {
  return {
    id: `base.humanoid.skill.${slot}`,
    kind: "skill",
    skillSlot: slot,
    skillId: `skill-${slot}`,
    animationCommand: `skill${slot}`,
    windupMs: 250,
    activeMs: 100,
    recoveryMs: 250,
    comboQueueWindowMs: 0,
    cooldownMs: 1000,
    movementLock: "partial"
  };
}

export const BASE_HUMANOID_BASIC_ATTACKS: readonly CombatActionDefinition[] = [
  {
    id: "base.humanoid.basic.1",
    kind: "basicAttack",
    comboIndex: 1,
    animationCommand: "attack1",
    windupMs: 110,
    activeMs: 120,
    recoveryMs: 180,
    comboQueueWindowMs: 150,
    cooldownMs: 0,
    movementLock: "partial"
  },
  {
    id: "base.humanoid.basic.2",
    kind: "basicAttack",
    comboIndex: 2,
    animationCommand: "attack2",
    windupMs: 120,
    activeMs: 140,
    recoveryMs: 220,
    comboQueueWindowMs: 170,
    cooldownMs: 0,
    movementLock: "partial"
  },
  {
    id: "base.humanoid.basic.3",
    kind: "basicAttack",
    comboIndex: 3,
    animationCommand: "attack3",
    windupMs: 150,
    activeMs: 160,
    recoveryMs: 280,
    comboQueueWindowMs: 0,
    cooldownMs: 0,
    movementLock: "full"
  }
] as const;

export const BASE_HUMANOID_SKILLS_BY_SLOT: CombatKitDefinition["skillsBySlot"] = {
  1: createPlaceholderSkill(1),
  2: createPlaceholderSkill(2),
  3: createPlaceholderSkill(3),
  4: createPlaceholderSkill(4),
  5: createCombatAction(createPlaceholderSkill(5), {
    animationCommand: "ultimate",
    skillId: "ultimate",
    cooldownMs: 18000,
    movementLock: "full"
  })
};

export const BASE_HUMANOID_COMBAT_KIT: CombatKitDefinition = createCombatKit({
  comboResetTimeMs: 900,
  basicAttacks: BASE_HUMANOID_BASIC_ATTACKS,
  skillsBySlot: BASE_HUMANOID_SKILLS_BY_SLOT
});
