import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

// The client talks to the Socket.IO / Express server (port 3001) through a dev
// proxy, so the browser only ever hits the Vite origin (same-origin, no CORS).
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@maskari/shared": fileURLToPath(
        new URL("../shared/src/index.ts", import.meta.url),
      ),
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/socket.io": {
        target: "http://localhost:3001",
        ws: true,
        changeOrigin: true,
      },
      "/health": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
    },
  },
});
