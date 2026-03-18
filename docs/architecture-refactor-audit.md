# Architecture Refactor Audit

This pass converts player/profile/settings persistence into a single repository-backed flow and removes one dead UI path. It does not pretend the whole project is finished. It establishes the slice that future cleanup should build on.

## Current Architectural Problems

- `src/services`, `src/core`, and `src/game/*` all own overlapping state and lifecycle responsibilities.
- Local persistence was split between `dab:user`, `dab:settings`, and session state, with normalization logic duplicated inside services instead of a repository boundary.
- The standalone `settings` screen existed beside the real settings modal, which created two architectural homes for the same responsibility.
- Client/server combat definitions and models are duplicated instead of living behind shared contracts.
- `src/game/controllers/*`, `src/game/systems/*`, and `src/game/locomotion/*` overlap heavily around movement ownership.
- Empty or placeholder domains (`src/utils`, `shared/src`, `server/src/utils`) exist without a real owner.

## Files Removed In This Pass

- `src/repositories/user.repository.ts`
- `src/ui/screens/settings.screen.ts`
- `src/ui/layout/settings.html`

## Files/Folders To Remove Or Quarantine Next

- `src/game/controllers/character-motor.controller.ts`
- `src/game/controllers/jump.controller.ts`
- `src/game/systems/movement.system.ts`
- `src/game/animation/movement-animation-state-machine.ts`
- `src/game/legacy/*`
- `src/game/experimental/*`
- Empty folders with no owner yet:
  - `src/utils`
  - `shared/src`
  - `server/src/utils`

## Duplicated Logic To Centralize

- User/profile normalization and migration:
  Move all legacy profile migration into [player-progress.repository.ts](/Users/carllosintfpc/Documents/dead-as-battle-game/src/persistence/repositories/player-progress.repository.ts).
- Settings normalization:
  Keep canonical settings shape in [game-settings.ts](/Users/carllosintfpc/Documents/dead-as-battle-game/src/config/game-settings.ts).
- Save/import validation:
  Keep schema, signature, and business validation in `src/persistence/*`, not in UI or gameplay services.
- Settings UX:
  Keep settings only in `settings-modal.ts` until a real routed settings domain exists.
- Movement/locomotion ownership:
  New work should land in `src/game/locomotion/*`; legacy controller/system files should become adapters only.
- Client/server combat definitions:
  `src/game/combat/definitions/*` and `server/src/combat/definitions/*` should move to a shared contract package once combat iteration stabilizes.

## Target Frontend Structure

```text
src/
  core/                 # App bootstrap, router, session lifecycle
  config/               # App/game settings, version, endpoints
  data/                 # Static catalogs
  persistence/          # Storage, repositories, schemas, validators, signatures
  services/             # App-facing use cases
  ui/                   # DOM screens, components, styles
  game/
    core/
    character/
    locomotion/
    combat/
    animation/
    camera/
    audio/
    multiplayer/
    world/
    debug/
    config/
    shared/
    legacy/
    experimental/
    scenes/
```

## Implemented Persistence Architecture

Flow:

```text
UI / Game -> Service -> Repository -> JSON Storage
```

Implemented modules:

- [game-settings.ts](/Users/carllosintfpc/Documents/dead-as-battle-game/src/config/game-settings.ts)
- [player-progress.repository.ts](/Users/carllosintfpc/Documents/dead-as-battle-game/src/persistence/repositories/player-progress.repository.ts)
- [json-progress.storage.ts](/Users/carllosintfpc/Documents/dead-as-battle-game/src/persistence/storage/json-progress.storage.ts)
- [player-progress.schema.ts](/Users/carllosintfpc/Documents/dead-as-battle-game/src/persistence/schemas/player-progress.schema.ts)
- [progress-signature.ts](/Users/carllosintfpc/Documents/dead-as-battle-game/src/persistence/security/progress-signature.ts)
- [progress-validator.ts](/Users/carllosintfpc/Documents/dead-as-battle-game/src/persistence/security/progress-validator.ts)
- [player-progress.service.ts](/Users/carllosintfpc/Documents/dead-as-battle-game/src/services/player-progress.service.ts)
- [profile.service.ts](/Users/carllosintfpc/Documents/dead-as-battle-game/src/services/profile.service.ts)

## Save File Shape

```json
{
  "saveVersion": 1,
  "gameVersion": "ALPHA 1.0",
  "playerId": "player_local_001",
  "profile": {
    "nickname": "Player",
    "createdAt": "2026-03-18T00:00:00.000Z",
    "coins": 0,
    "activePlayTimeSeconds": 0,
    "pendingCoinRewards": 0,
    "notifications": []
  },
  "champions": [
    {
      "championId": "default_champion",
      "level": 1,
      "xp": 0,
      "kills": 0,
      "deaths": 0,
      "isUnlocked": true,
      "createdAt": "2026-03-18T00:00:00.000Z"
    }
  ],
  "selectedChampionId": "default_champion",
  "settings": {
    "locale": "pt-BR",
    "fullscreen": false,
    "muteAll": false,
    "masterVolume": 80,
    "cameraFovPercent": 50,
    "renderDistanceViewPercent": 50
  },
  "metadata": {
    "createdAt": "2026-03-18T00:00:00.000Z",
    "updatedAt": "2026-03-18T00:00:00.000Z"
  },
  "integrity": {
    "algorithm": "fnv1a-64",
    "signature": "..."
  }
}
```

## Integrity Strategy

- Normalize payload before signing.
- Generate deterministic `fnv1a-64` signature over the unsigned payload.
- Validate JSON schema first.
- Validate signature second.
- Validate business rules last:
  - no duplicate champion entries
  - selected champion must exist and be unlocked
  - no negative counters
  - only known champion ids
  - valid metadata/profile timestamps

## Migration Strategy

1. Keep compatibility adapters so existing code can still import `user.service.ts`.
2. Route all future local persistence through `PlayerProgressRepository`.
3. Migrate remaining ad hoc localStorage keys into the repository one by one.
4. Extract shared client/server combat contracts into a real shared package.
5. Collapse legacy movement/controller paths behind locomotion adapters, then delete them.
6. Split `match.screen.ts` and `global-match.scene.ts` by domain once persistence and state ownership stop moving.

## UI Integration Added

- Settings modal:
  export progress button with user feedback.
- Nickname screen:
  file picker, validation feedback, preview summary, confirm import flow.

## Verification

- `npm run build`
