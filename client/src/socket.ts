import { io, type Socket } from "socket.io-client";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from "@maskari/shared";

/**
 * Single shared Socket.IO connection for the whole app.
 *
 * Dev: connects to the Vite origin; `/socket.io` is proxied to port 3001.
 * Production (monolith): same origin when the server serves the client build.
 * Production (Vercel): set VITE_SERVER_URL to your Render/Railway API URL.
 */
const serverUrl = import.meta.env.VITE_SERVER_URL as string | undefined;

export const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(
  serverUrl || undefined,
  {
    autoConnect: true,
    ...(serverUrl ? { transports: ["websocket", "polling"] } : {}),
  },
);
