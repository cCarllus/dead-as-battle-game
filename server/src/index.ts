import { Server } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { createServer } from "node:http";
import { GlobalChatRoom } from "./rooms/global-chat.room.js";

const port = Number(process.env.PORT ?? 2567);
const host = process.env.HOST ?? "0.0.0.0";

const httpServer = createServer();

const gameServer = new Server({
  transport: new WebSocketTransport({
    server: httpServer
  })
});

gameServer.define("global_chat", GlobalChatRoom);

await gameServer.listen(port, host);
console.log(`[global_chat] listening on ws://${host}:${port}`);
