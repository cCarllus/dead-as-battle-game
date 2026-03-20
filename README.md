# Dead As Battleground

Code-first Babylon.js 8 game foundation using Vite and TypeScript.

The active browser client now boots entirely from code. No Babylon Editor files, scene graphs, or editor-generated structures are part of the runtime path.

The previous frontend source was migrated into the active tree instead of staying archived. The repo is now split between an application-shell layer in `src/app/*` and reusable gameplay/runtime modules in `src/*`.

## Stack

- Babylon.js `8.56.1`
- Vite `8.0.1`
- TypeScript `5.9.3`
- Node.js `24.11.0`
- Optional Colyseus server preserved under `server/`

## Project Initialization

```bash
npm install
cp .env.example .env
npm run dev
```

For frontend + realtime server together:

```bash
npm run dev:all
```

Key URLs:

- Client: `http://localhost:5173`
- Preview: `http://localhost:4173`
- Server: `http://localhost:2567`

## Active Folder Structure

```text
src/
  main.ts
  app/
    client.entry.ts
    config/
    controllers/
    core/
    data/
    i18n/
    models/
    persistence/
    services/
    ui/
    game-app.ts
  animation/
  audio/
  camera/
  character/
  combat/
  config/
  core/
  debug/
  effects/
  entities/
  environment/
  experimental/
  heroes/
  locomotion/
  multiplayer/
  physics/
  scenes/
  shared/
  systems/
  ui/
  game/
    bootstrap/
    states/
  utils/
  styles/
assets/
  models/
  animations/
  textures/
  audio/
server/
```

## Bootstrap Flow

- [`src/main.ts`](/Applications/Develop/Projetos/dead-as-battle-game/src/main.ts) mounts the canvas shell and starts the active Babylon app.
- [`src/app/game-app.ts`](/Applications/Develop/Projetos/dead-as-battle-game/src/app/game-app.ts) creates the Babylon engine, runtime, and initial scene.
- [`src/core/runtime/game-runtime.ts`](/Applications/Develop/Projetos/dead-as-battle-game/src/core/runtime/game-runtime.ts) owns the render loop, active scene, and resize lifecycle.
- [`src/game/bootstrap/create-sandbox-scene.ts`](/Applications/Develop/Projetos/dead-as-battle-game/src/game/bootstrap/create-sandbox-scene.ts) builds the first code-driven scene.
- [`src/app/core/bootstrap.ts`](/Applications/Develop/Projetos/dead-as-battle-game/src/app/core/bootstrap.ts) preserves the migrated app-shell bootstrap for the older menu/service flow.

## First Scene

The initial sandbox scene includes:

- Babylon engine and scene initialization
- ArcRotate third-person-friendly camera wrapper
- Hemispheric + directional lighting
- Grid-material ground
- Test primitives for environment validation
- Babylon GUI HUD with FPS and control hints
- Dev-only Babylon Inspector toggle on `Alt+I`

## Environment Flags

Defined in [`.env.example`](/Applications/Develop/Projetos/dead-as-battle-game/.env.example):

- `VITE_SERVER_URL`: future multiplayer endpoint
- `VITE_COLYSEUS_ENDPOINT`: compatibility endpoint for the migrated multiplayer client
- `VITE_DEBUG`: enables debug hooks
- `VITE_SHOW_FPS`: shows FPS in the HUD
- `VITE_INSPECTOR`: enables Babylon Inspector support
- `VITE_INSPECTOR_AUTO_OPEN`: opens inspector on boot

## Tooling

- `npm run typecheck`
- `npm run lint`
- `npm run lint:full`
- `npm run format`
- `npm run build`
- `npm run build:server`
