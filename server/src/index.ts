// Responsável por inicializar o servidor Colyseus e registrar as salas globais de chat e partida.
import { Server } from "@colyseus/core";
import { LobbyRoom } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { createServer } from "node:http";
import { GlobalChatRoom } from "./rooms/global-chat.room.js";
import { GlobalMatchRoom } from "./rooms/global-match.room.js";

const port = Number(process.env.PORT ?? 2567);
const host = process.env.HOST ?? "0.0.0.0";

const httpServer = createServer();

const gameServer = new Server({
  transport: new WebSocketTransport({
    server: httpServer
  })
});

gameServer.define("global_chat", GlobalChatRoom);
gameServer.define("global_match", GlobalMatchRoom);
gameServer.define("lobby", LobbyRoom);

await gameServer.listen(port, host);
console.log(`[global_chat] listening on ws://${host}:${port}`);
console.log(`[global_match] listening on ws://${host}:${port}`);
console.log(`[lobby] listening on ws://${host}:${port}`);
