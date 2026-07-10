import { io, type Socket } from "socket.io-client";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from "@maskari/shared";

/**
 * Single shared Socket.IO connection for the whole app.
 *
 * With no URL argument, socket.io-client connects to the page's origin. In dev
 * that's the Vite server, which proxies `/socket.io` to the Express/Socket.IO
 * server on port 3001 (see vite.config.ts).
 */
export const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io({
  autoConnect: true,
});
