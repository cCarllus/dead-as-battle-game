# Game Framework

`src/game` is now the gameplay framework root for the project. The app shell still lives under `src/core`, `src/controllers`, `src/services`, and `src/ui`, but in-match code should treat `src/game` as the internal engine/gameplay foundation.

## Domains

- `src/game/core`: runtime context, explicit state machines, event bus, service registry.
- `src/game/shared`: contracts reused by runtime, UI adapters, and network-facing client code.
- `src/game/config`: centralized tuning for gameplay, camera, UI, and state-machine timing.
- `src/game/character`: reusable character runtime assembly, config, and registry.
- `src/game/locomotion`: motor, grounded, crouch, roll, jump, ledge, and locomotion state logic.
- `src/game/combat`: combat hooks/controllers that feed gameplay state.
- `src/game/animation`: animation state, bindings, registry, and controller ownership.
- `src/game/camera`: camera-facing hooks and visual feedback systems.
- `src/game/audio`: character audio reactions and event mapping.
- `src/game/multiplayer`: player presence tracking and future sync/replication helpers.
- `src/game/systems`: scene-level systems that coordinate multiple domains.
- `src/game/scenes`: runtime entry points only. Scene files should orchestrate, not own low-level gameplay rules.
- `src/game/debug`: diagnostics and temporary observability tools.
- `src/game/legacy`: deprecated runtime paths kept only for migration/reference.
- `src/game/experimental`: prototypes that are intentionally isolated from stable gameplay code.

## Conventions

- Keep one dominant responsibility per file. If a file needs "and" in its description, it is usually too broad.
- Add top-level responsibility comments to framework files.
- Prefer domain nouns in filenames: `character-root`, `combat-controller`, `camera-config`, `event-bus`.
- Put tuning in `src/game/config/*` before hardcoding values in systems or scenes.
- Prefer explicit state machines or typed snapshots over scattered booleans.
- Use the runtime context/event bus for cross-domain reactions, not hidden imports or global singletons.
- New gameplay code should extend `src/game/locomotion/*` and `src/game/character/*`, not the legacy movement stack.

## Pass 1 Runtime Modules

- `src/game/core/game-bootstrap.ts`: explicit scene bootstrap for engine/scene/context wiring.
- `src/game/character/local-character-runtime.ts`: reusable local playable-character runtime assembly.
- `src/game/combat/combat-state-machine.ts`: predicted combat phase ownership for attack/block/cooldown/stun.
- `src/game/multiplayer/player-presence-tracker.ts`: session-based spawn/update/remove tracking without scene-local sets.
