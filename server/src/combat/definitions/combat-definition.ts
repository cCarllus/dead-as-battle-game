// Responsável por definir o kit base compartilhado de combate humanoide que os heróis podem sobrescrever.
import { createCombatAction, createCombatKit } from "./combat-kit.utils.js";
import type { CombatActionDefinition, CombatKitDefinition, CombatSkillSlot } from "./combat-types.js";

function createPlaceholderSkill(slot: CombatSkillSlot): CombatActionDefinition {
  return {
    id: `base.humanoid.skill.${slot}`,
    kind: "skill",
    sourceType: "skill",
    animationCommand: `skill${slot}`,
    skillSlot: slot,
    skillId: `skill-${slot}`,
    damage: 0,
    range: 0,
    angleDegrees: 0,
    radius: 0,
    knockback: 0,
    hitstunMs: 0,
    windupMs: 250,
    activeMs: 100,
    recoveryMs: 250,
    comboQueueWindowMs: 0,
    cooldownMs: 1000,
    interruptible: true,
    canQueueNextAttack: false,
    canBeInterrupted: true,
    movementLock: "partial",
    targetingShape: "melee_cone",
    isBlockable: true,
    hitBursts: [{ offsetMs: 0 }],
    vfxHook: null,
    sfxHook: null
  };
}

export const BASE_HUMANOID_BASIC_ATTACKS: readonly CombatActionDefinition[] = [
  {
    id: "base.humanoid.basic.1",
    kind: "basicAttack",
    sourceType: "basic_melee",
    animationCommand: "attack1",
    comboIndex: 1,
    damage: 40,
    range: 2.45,
    angleDegrees: 72,
    radius: 0.9,
    knockback: 0.42,
    hitstunMs: 150,
    windupMs: 110,
    activeMs: 120,
    recoveryMs: 180,
    comboQueueWindowMs: 150,
    comboResetMs: 900,
    cooldownMs: 0,
    interruptible: true,
    canQueueNextAttack: true,
    canBeInterrupted: true,
    movementLock: "partial",
    targetingShape: "melee_cone",
    isBlockable: true,
    hitBursts: [{ offsetMs: 0 }],
    vfxHook: "punch_01",
    sfxHook: "punch_01"
  },
  {
    id: "base.humanoid.basic.2",
    kind: "basicAttack",
    sourceType: "basic_melee",
    animationCommand: "attack2",
    comboIndex: 2,
    damage: 55,
    range: 2.75,
    angleDegrees: 80,
    radius: 1,
    knockback: 0.55,
    hitstunMs: 180,
    windupMs: 120,
    activeMs: 140,
    recoveryMs: 220,
    comboQueueWindowMs: 170,
    comboResetMs: 900,
    cooldownMs: 0,
    interruptible: true,
    canQueueNextAttack: true,
    canBeInterrupted: true,
    movementLock: "partial",
    targetingShape: "melee_cone",
    isBlockable: true,
    hitBursts: [{ offsetMs: 0 }],
    vfxHook: "punch_02",
    sfxHook: "punch_02"
  },
  {
    id: "base.humanoid.basic.3",
    kind: "basicAttack",
    sourceType: "basic_melee",
    animationCommand: "attack3",
    comboIndex: 3,
    damage: 80,
    range: 3.1,
    angleDegrees: 92,
    radius: 1.15,
    knockback: 0.9,
    hitstunMs: 260,
    windupMs: 150,
    activeMs: 160,
    recoveryMs: 280,
    comboQueueWindowMs: 0,
    comboResetMs: 900,
    cooldownMs: 0,
    interruptible: false,
    canQueueNextAttack: false,
    canBeInterrupted: false,
    movementLock: "full",
    targetingShape: "melee_cone",
    isBlockable: true,
    hitBursts: [{ offsetMs: 0 }],
    vfxHook: "punch_03",
    sfxHook: "punch_03"
  }
] as const;

export const BASE_HUMANOID_SKILLS_BY_SLOT: CombatKitDefinition["skillsBySlot"] = {
  1: createPlaceholderSkill(1),
  2: createPlaceholderSkill(2),
  3: createPlaceholderSkill(3),
  4: createPlaceholderSkill(4),
  5: createCombatAction(createPlaceholderSkill(5), {
    sourceType: "ultimate",
    skillId: "ultimate",
    animationCommand: "ultimate",
    cooldownMs: 18000,
    interruptible: false,
    canBeInterrupted: false,
    movementLock: "full",
    ultimateChargeCost: 100
  })
};

export const BASE_HUMANOID_COMBAT_KIT: CombatKitDefinition = createCombatKit({
  maxHealth: 1000,
  comboResetTimeMs: 900,
  deathScreenDelayMs: 1800,
  ragdollDelayMs: 120,
  respawnDelayMs: 2200,
  basicAttacks: BASE_HUMANOID_BASIC_ATTACKS,
  skillsBySlot: BASE_HUMANOID_SKILLS_BY_SLOT
});
