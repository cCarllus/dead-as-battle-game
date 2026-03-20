import defaultChampionFireballAnimationUrl from "@assets/animations/heroes/default-champion/fireball.glb";
import defaultChampionKickSkillAnimationUrl from "@assets/animations/heroes/default-champion/kick-skill.glb";
import defaultChampionRepeatKickAnimationUrl from "@assets/animations/heroes/default-champion/reapet-kick.glb";
import defaultChampionSpellAnimationUrl from "@assets/animations/heroes/default-champion/spell.glb";
import defaultChampionUltimateAnimationUrl from "@assets/animations/heroes/default-champion/ultimate.glb";
import blockAnimationUrl from "@assets/animations/shared/block.glb";
import crouchIdleAnimationUrl from "@assets/animations/shared/crouch_idle.glb";
import gettingHitAnimationUrl from "@assets/animations/shared/getting-hit.glb";
import idleAnimationUrl from "@assets/animations/shared/idle.glb";
import jumpAnimationUrl from "@assets/animations/shared/jump.glb";
import punchesAnimationUrl from "@assets/animations/shared/punchs.glb";
import quickRollAnimationUrl from "@assets/animations/shared/quick-roll.glb";
import runAnimationUrl from "@assets/animations/shared/run.glb";
import upWallAnimationUrl from "@assets/animations/shared/up-wall.glb";
import walkAnimationUrl from "@assets/animations/shared/walk.glb";
import wallHangingIdleAnimationUrl from "@assets/animations/shared/wall-hanging-idle.glb";
import defaultChampionModelUrl from "@assets/models/heroes/default-champion/default.glb";
import venomChampionModelUrl from "@assets/models/heroes/default-champion/venom.glb";
import loadingScreenPrimaryUrl from "@assets/textures/ui/loading_1.png";
import loadingScreenSecondaryUrl from "@assets/textures/ui/loading_2.png";

export const UI_TEXTURE_ASSET_URLS = Object.freeze({
  loadingScreenPrimary: loadingScreenPrimaryUrl,
  loadingScreenSecondary: loadingScreenSecondaryUrl
});

export const SHARED_ANIMATION_ASSET_URLS = Object.freeze({
  block: blockAnimationUrl,
  crouchIdle: crouchIdleAnimationUrl,
  gettingHit: gettingHitAnimationUrl,
  idle: idleAnimationUrl,
  jump: jumpAnimationUrl,
  punches: punchesAnimationUrl,
  quickRoll: quickRollAnimationUrl,
  run: runAnimationUrl,
  upWall: upWallAnimationUrl,
  walk: walkAnimationUrl,
  wallHangingIdle: wallHangingIdleAnimationUrl
});

export const HERO_MODEL_ASSET_URLS = Object.freeze({
  defaultChampion: Object.freeze({
    default: defaultChampionModelUrl,
    venom: venomChampionModelUrl
  })
});

export const HERO_ANIMATION_ASSET_URLS = Object.freeze({
  defaultChampion: Object.freeze({
    fireball: defaultChampionFireballAnimationUrl,
    kickSkill: defaultChampionKickSkillAnimationUrl,
    repeatKick: defaultChampionRepeatKickAnimationUrl,
    spell: defaultChampionSpellAnimationUrl,
    ultimate: defaultChampionUltimateAnimationUrl
  })
});
