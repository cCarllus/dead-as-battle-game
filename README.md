# Dead as Battleground

Projeto web game com frontend em Vite + TypeScript + Babylon.js e backend realtime com Colyseus (WebSocket).

## Objetivo atual

- Rodar frontend e servidor de jogo localmente e via Docker.
- Expor ambiente de desenvolvimento pela internet com ngrok.
- Consumir assets (modelos, imagens e audio) do repositorio oficial de assets.

## Tecnologias

- Node.js `24.11.0`
- npm `11.6.1`
- TypeScript
- Vite `6.x`
- Babylon.js
- Colyseus (`@colyseus/core`, `@colyseus/ws-transport`, `@colyseus/sdk`)
- Express
- Zod
- Docker + Docker Compose
- ngrok

## Estrutura principal

- `src/`: aplicacao frontend
- `server/`: servidor Colyseus
- `src/config/server-endpoint.ts`: resolve `VITE_SERVER_URL` e converte `http/https` para `ws/wss`
- `src/data/champions.catalog.ts`: catalogo de campeoes e URLs de assets
- `docker-compose.yml`: ambiente dev com frontend + server
- `Dockerfile`: imagem base do projeto

## Requisitos

- Node.js `24.11.0` (igual ao `.tool-versions`)
- npm `11.6.1`
- Docker + Docker Compose (opcional)
- ngrok CLI autenticado (para links publicos)

## Variaveis de ambiente

Este projeto usa modos do Vite para alternar endpoint do websocket.

### Arquivos

- `.env.development`

```env
VITE_SERVER_URL=http://localhost:2567
```

- `.env.ngrok`

```env
VITE_SERVER_URL=https://SEU-TUNNEL-DO-COLYSEUS.ngrok-free.app
```

## Scripts disponiveis

- `npm run dev`: sobe Vite em modo development
- `npm run dev:ngrok`: sobe Vite em modo ngrok (`vite --mode ngrok`)
- `npm run dev:server`: sobe Colyseus com watch (`tsx watch`)
- `npm run dev:all`: sobe server + frontend (modo local)
- `npm run start:server`: sobe apenas server sem watch
- `npm run build:server`: build TypeScript do server
- `npm run build`: typecheck + build frontend
- `npm run preview`: preview do build frontend

## Rodar local (sem Docker)

### Opcao 1: dois terminais

Terminal 1:

```bash
npm ci
npm run dev:server
```

Terminal 2:

```bash
npm run dev
```

### Opcao 2: comando unico

```bash
npm run dev:all
```

Acessos:

- Frontend: `http://localhost:5173`
- Colyseus: `ws://localhost:2567`

## Rodar com ngrok (sem Docker)

### 1) Suba o servidor

```bash
npm run dev:server
```

### 2) Abra o tunnel do Colyseus

```bash
ngrok http 2567
```

Copie a URL HTTPS gerada pelo ngrok e atualize `.env.ngrok`:

```env
VITE_SERVER_URL=https://xxxxx.ngrok-free.app
```

### 3) Suba o frontend no modo ngrok

```bash
npm run dev:ngrok
```

Opcional (se quiser compartilhar tambem a UI do Vite):

```bash
ngrok http 5173
```

## Rodar com Docker

O `docker-compose.yml` atual sobe frontend + server no mesmo servico (`dev`) e usa `dev:ngrok` para o frontend.

```bash
docker compose up -d --build
```

Comandos uteis:

```bash
docker compose logs -f dev
docker compose down
```

Portas publicadas:

- `5173` (Vite)
- `2567` (Colyseus)

### Importante sobre env no Docker

- O Vite le `.env.*` no startup.
- Se mudar `.env.ngrok`, reinicie o container:

```bash
docker compose down
docker compose up -d --build
```

## Subir somente o server

### Local

```bash
HOST=0.0.0.0 PORT=2567 npm run start:server
```

### Docker (execucao pontual)

```bash
docker compose run -d --name dead-as-battleground-server --service-ports dev \
  sh -c 'npm ci && HOST=0.0.0.0 PORT=2567 npm run start:server'
```

## WebSocket + HTTPS (ponto critico)

Quando a pagina abre em `https://...`, a conexao realtime precisa ser segura (`wss://...`).

Para simplificar, o projeto usa `VITE_SERVER_URL` e converte automaticamente:

- `http://...` -> `ws://...`
- `https://...` -> `wss://...`

Isso evita erro de mixed content em navegador.

## Troubleshooting rapido

Se o chat/team nao conecta:

1. Verifique `.env.ngrok` com a URL do tunnel **da porta 2567**.
2. Confirme que o tunnel `ngrok http 2567` esta ativo.
3. Reinicie Vite (ou container) depois de trocar `.env`.
4. Verifique o console do browser para erros `Mixed Content` ou `WebSocket connection failed`.
5. Garanta que nao existe `localhost:2567` hardcoded no client.

## Assets (modelos, imagens, audio)

Repositorio oficial de assets:

- [dead-as-battle-assets](https://github.com/cCarllus/dead-as-battle-assets)

Hoje os campeoes usam URLs CDN do repositorio (jsDelivr), definidas em:

- `src/data/champions.catalog.ts`

Exemplo de padrao usado:

- `https://cdn.jsdelivr.net/gh/cCarllus/dead-as-battle-assets@main/models/...`
- `https://cdn.jsdelivr.net/gh/cCarllus/dead-as-battle-assets@main/sounds/...`

Se voce atualizar assets no repositorio, mantenha caminhos e nomes consistentes para nao quebrar o catalogo.

## Observacoes de desenvolvimento

- `vite.config.ts` esta com `allowedHosts: [".ngrok-free.app"]` para facilitar uso com subdominios ngrok.
- Backend Colyseus escuta em `HOST` e `PORT` (default `0.0.0.0:2567`).
