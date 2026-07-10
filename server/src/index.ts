import http from "node:http";
import express from "express";
import cors from "cors";
import { Server } from "socket.io";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData,
} from "@maskari/shared";
import { InMemoryRoomStore } from "./store.js";
import { registerHandlers } from "./handlers.js";
import { GameManager } from "./game.js";

const PORT = Number(process.env.PORT ?? 3001);

const app = express();
app.use(cors());
app.use(express.json());

const store = new InMemoryRoomStore();

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    service: "maskari-server",
    rooms: store.count(),
    ts: Date.now(),
  });
});

const httpServer = http.createServer(app);

const io = new Server<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>(httpServer, {
  cors: { origin: "*" },
});

const game = new GameManager(io, store);
registerHandlers(io, store, game);

/**
 * Dev-friendly listen: if the previous process (from a `tsx watch` restart)
 * hasn't released the port yet, retry a few times instead of crashing.
 */
let listenAttempts = 0;
function startListening() {
  httpServer.listen(PORT, () => {
    console.log(`[server] Maskari server listening on http://localhost:${PORT}`);
  });
}

httpServer.on("error", (err: NodeJS.ErrnoException) => {
  if (err.code === "EADDRINUSE" && listenAttempts < 10) {
    listenAttempts++;
    console.warn(
      `[server] port ${PORT} busy, retry ${listenAttempts}/10 in 400ms…`,
    );
    setTimeout(() => {
      httpServer.close();
      startListening();
    }, 400);
  } else {
    throw err;
  }
});

startListening();

/** Close cleanly on restart/exit so the port frees immediately. */
function shutdown() {
  io.close();
  httpServer.close(() => process.exit(0));
  // Force-exit if lingering sockets keep the server open.
  setTimeout(() => process.exit(0), 400).unref();
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
