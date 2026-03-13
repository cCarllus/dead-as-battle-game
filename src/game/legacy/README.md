# Legacy Runtime

This folder marks the migration boundary for systems that should not receive new feature work.

Current legacy path candidates still living outside this folder:

- `src/game/systems/movement.system.ts`
- `src/game/controllers/character-motor.controller.ts`
- `src/game/controllers/jump.controller.ts`
- `src/game/animation/movement-animation-state-machine.ts`

Rules:

- Do not add new gameplay behavior to those modules.
- Use them only as migration references or temporary adapters.
- New movement work should target `src/game/locomotion/*`.
- If a legacy module is still required at runtime, isolate the adapter and document the replacement path.
