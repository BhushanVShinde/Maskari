# Maskari

Free real-time multiplayer drawing-and-guessing game (Pictionary / skribbl.io style).

## Stack

- **Client:** React + Vite + TypeScript
- **Server:** Node + Express + Socket.IO + TypeScript
- **Shared:** Typed socket events, game config, words, scoring

## Quick start

```bash
npm install
npm run dev
```

- Client: http://localhost:5173
- Server: http://localhost:3001
- Health: http://localhost:3001/health

Open two browser tabs, create a room in one, join with the code in the other, and play.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Dev server + Vite client with hot reload |
| `npm run dev:server` | Server only |
| `npm run dev:client` | Client only |
| `npm run build` | Build shared, server, and client |

## Features

- Room lobby with shareable link (`?room=CODE`)
- Real-time canvas drawing
- Turn rotation, word choice, countdown timer
- Chat + guess checking + scoring
- Round-end and game-over screens
- Play again
- 90s reconnect grace on disconnect/refresh
- Optional sound effects
- Mobile-friendly layout

## Project layout

```
Maskari/
├── shared/src/    # Types, events, config, words, scoring
├── server/src/    # Game engine, rooms, socket handlers
└── client/src/    # React UI
```
