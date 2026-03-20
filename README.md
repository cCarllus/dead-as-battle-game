# Dead As Battleground

Code-first Babylon.js 8 game foundation using Vite and TypeScript.

The active browser client now boots entirely from code. No Babylon Editor files, scene graphs, or editor-generated structures are part of the runtime path.

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
  camera/
  character/
  locomotion/
  combat/
  animation/
  audio/
  multiplayer/
  persistence/
  debug/
  ui/
  world/
  game/
    bootstrap/
    states/
  core/
    engine/
    runtime/
    scene/
  config/
  shared/
  utils/
  styles/
assets/
  models/
  animations/
  textures/
  audio/
public/
server/
legacy/
```

## Bootstrap Flow

- [`src/main.ts`](/Applications/Develop/Projetos/dead-as-battle-game/src/main.ts) mounts the canvas shell and starts the app.
- [`src/app/game-app.ts`](/Applications/Develop/Projetos/dead-as-battle-game/src/app/game-app.ts) creates the Babylon engine, runtime, and initial scene.
- [`src/core/runtime/game-runtime.ts`](/Applications/Develop/Projetos/dead-as-battle-game/src/core/runtime/game-runtime.ts) owns the render loop, active scene, and resize lifecycle.
- [`src/game/bootstrap/create-sandbox-scene.ts`](/Applications/Develop/Projetos/dead-as-battle-game/src/game/bootstrap/create-sandbox-scene.ts) builds the first code-driven scene.

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
- `VITE_DEBUG`: enables debug hooks
- `VITE_SHOW_FPS`: shows FPS in the HUD
- `VITE_INSPECTOR`: enables Babylon Inspector support
- `VITE_INSPECTOR_AUTO_OPEN`: opens inspector on boot

## Tooling

- `npm run typecheck`
- `npm run lint`
- `npm run format`
- `npm run build`
- `npm run build:server`

## Legacy Archive

The previous browser client source and public assets were moved to [`legacy/`](/Applications/Develop/Projetos/dead-as-battle-game/legacy/README.md) during the refactor so the new `src/` tree could start clean without deleting prior work.
