# Architecture Pass 1

This pass treats `src/game` as the internal gameplay framework root and keeps the current web shell (`src/core`, `src/services`, `src/ui`) intact. The goal is to improve runtime boundaries without rewriting stable gameplay systems in one jump.

## Refactor Plan

1. Stabilize composition roots.
   Move scene bootstrap, runtime context wiring, and player-presence orchestration out of scene files and into explicit framework modules.
2. Formalize framework contracts.
   Keep gameplay domains typed around configs, state machines, services, registries, and event payloads instead of ad hoc booleans and scene-local state.
3. Isolate migration seams.
   Keep legacy movement/controller paths runnable but prevent new feature work from landing there.
4. Finish domain migration incrementally.
   Move remaining broad scene logic into `character`, `combat`, `camera`, `multiplayer`, `world`, and `ui` domains once each extraction has a clear owner and preserves behavior.

## Updated Domain Structure

Current pragmatic target:

```text
src/
  core/                    # Web app bootstrap/router/storage
  services/                # API/menu/chat/user services
  ui/                      # DOM screens, HUD widgets, menus
  game/
    core/                  # Gameplay bootstrap, runtime context, event bus, state machines, registries
    character/             # Character rig, config, runtime assembly, registry
    locomotion/            # Motor, grounded, jump, crouch, roll, ledge, state machine
    combat/                # Combat hooks, predicted combat state machine, future controller/damage modules
    animation/             # Animation controller, registry, bindings, state logic
    camera/                # Camera hooks and camera feedback systems
    audio/                 # Audio controllers and audio event mapping
    multiplayer/           # Presence tracking, future replication/sync adapters
    world/                 # Radar, interactables, environment tags (target domain; mostly still pending)
    config/                # Central gameplay tuning
    debug/                 # Diagnostics and debug overlays
    shared/                # Shared runtime/network contracts
    experimental/          # Prototypes only
    legacy/                # Deprecated or migration-only paths
    scenes/                # Thin orchestration entry points
server/
  src/
    config/                # Authoritative combat/runtime tuning
    network/               # Message handlers and network event names
    services/              # Domain logic helpers
    systems/               # Authoritative movement/combat/ability/regeneration loops
    rooms/                 # Composition roots for Colyseus rooms
```

Longer-term target after migration:

```text
src/game/world/
src/game/ui/
src/game/multiplayer/
server/src/core/
server/src/multiplayer/
server/src/combat/
server/src/locomotion/
```

## Systems To Extract Or Reorganize

High-value client-side extraction targets:

- `src/game/scenes/global-match.scene.ts`
  Too much responsibility today: bootstrap, player presence, local combat prediction, local character runtime assembly, pointer lock, render loop, and scene disposal.
- `src/ui/screens/match.screen.ts`
  HUD rendering, chat, scoreboard, radar, pause, and match wiring are all valid, but it is approaching “god screen” status and should be split into HUD-focused modules over time.
- `src/game/systems/player-view-manager.ts`
  Good ownership already, but it should eventually delegate more camera/nameplate/radar concerns to `camera` and `world`.
- `src/game/entities/player.entity.ts`
  Useful central assembly point, but it currently carries skin loading, labels, visual calibration, and runtime rig composition in one file.

Legacy paths that should stop receiving features:

- `src/game/systems/movement.system.ts`
- `src/game/controllers/character-motor.controller.ts`
- `src/game/controllers/jump.controller.ts`
- `src/game/animation/movement-animation-state-machine.ts`

Server-side extraction targets:

- `server/src/rooms/global-match.room.ts`
  Keep it as the room composition root only; shared lifecycle utilities and room state coordination should move into explicit room/runtime helpers.
- `server/src/services/movement.service.ts`
  Large domain logic that should eventually be partitioned into locomotion, collision, and replication helpers.

## Centralized Config Strategy

Rules:

- All gameplay tuning stays under `src/game/config` or `server/src/config`.
- Systems may cache config locally per frame, but they should not invent new magic numbers inline.
- Client prediction and server authority should share naming and units even when the files stay separate.

Current config owners:

- `src/game/character/character-config.ts`
  Canonical playable-character runtime config: collider, anchors, locomotion, ledge.
- `src/game/config/camera.config.ts`
  Third-person camera tuning.
- `src/game/config/ui.config.ts`
  HUD and UI tuning.
- `src/game/config/match-runtime.config.ts`
  Match sync/combat-prediction/runtime glue.
- `server/src/config/hero-combat.config.ts`
  Server-authoritative combat tuning.

Next config moves:

- Create a dedicated combat-runtime config if local predicted combat grows beyond match-scene needs.
- Split `character-config.ts` into `character`, `locomotion`, and `ledge` config modules only if multiple character archetypes make that separation materially clearer.

## State Machine Strategy

Already formalized:

- Global runtime flow: `src/game/core/game-state-machine.ts`
- Character locomotion: `src/game/locomotion/character-state-machine.ts`
- Animation state: explicit state resolution under `src/game/animation/*`

Added in this pass:

- Client combat prediction/runtime state: `src/game/combat/combat-state-machine.ts`

State ownership rules:

- Scene-level states belong in `core`.
- Character motion states belong in `locomotion`.
- Combat phase and local combat prediction belong in `combat`.
- Animation playback decisions belong in `animation`.
- UI visibility/focus/transition states should live in UI modules, not inside gameplay controllers.

## Event Bus, Services, And Registries

Keep using the existing typed event bus and service registry in `src/game/core`.

Recommended usage:

- Event bus:
  Cross-domain reactions like `player_spawned`, `player_removed`, `pointer_lock_changed`, `damage_taken`, `ultimate_ready`, `chat_opened`.
- Services:
  Runtime-owned cross-cutting coordinators such as camera, input, pointer lock, effect manager, physics world.
- Registries:
  Static or lookup-heavy data such as heroes, animations, abilities, audio cues, UI widgets.

Rules:

- Do not use the event bus as a hidden control-flow replacement.
- Emit events at domain boundaries, not on every tiny internal detail.
- Prefer registries for lookup tables, not mutable runtime state.

## Module Responsibility Rules

- `scenes/*`
  Compose modules, own lifecycle, avoid gameplay rule details.
- `character/*`
  Assemble and configure playable-character runtime pieces.
- `locomotion/*`
  Decide movement behavior and locomotion state only.
- `combat/*`
  Decide combat phase, inputs, cooldowns, and combat-facing state only.
- `camera/*`
  Own camera transform/FOV/feedback only.
- `multiplayer/*`
  Own presence tracking, replication helpers, and sync contracts only.
- `world/*`
  Own map/radar/interactable/environment semantics only.
- `debug/*`
  Diagnostic-only helpers, never required by stable gameplay.

## Migration Notes

- `global-match.scene.ts` should continue to be the gameplay entry point during Pass 1, but its local responsibilities should keep shrinking.
- New feature work should target `src/game/locomotion/*`, `src/game/character/*`, `src/game/combat/*`, and `src/game/multiplayer/*`.
- Do not add new logic to the legacy movement/controller path unless it is a short-lived adapter.
- Preserve match behavior first; prefer extracting orchestration or state ownership before rewriting underlying movement/combat algorithms.
- When a file is still transitional, mark it in code comments or README notes so contributors do not mistake it for the final home of the feature.
