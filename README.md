# Maskari

Free real-time multiplayer drawing-and-guessing game (Pictionary / skribbl.io style).

## Stack

- **Client:** React + Vite + TypeScript
- **Server:** Node + Express + Socket.IO + TypeScript
- **Shared:** Typed socket events, game config, words, scoring

## Quick start (development)

```bash
npm install
npm run dev
```

- Client: http://localhost:5173
- Server: http://localhost:3001
- Health: http://localhost:3001/health

Open two browser tabs, create a room in one, join with the code in the other, and play.

## Production

Build everything, then run the server (it serves the client build on the same port):

```bash
npm run build
npm start
```

Open http://localhost:3001 — Socket.IO and the SPA share one origin.

Set `PORT` to change the listen port (default `3001`).

## Deploy (Vercel + Render)

**Vercel cannot run Socket.IO** — it has no persistent WebSockets. Use a split deploy:

| Part | Platform | What it runs |
|------|----------|--------------|
| Frontend | **Vercel** | Static React build |
| Game server | **Render** (free) | Express + Socket.IO |

### 1. Deploy the API on Render

1. Push this repo to GitHub.
2. Go to [render.com](https://render.com) → **New** → **Blueprint** → connect the repo.
3. Render reads `render.yaml` and creates **maskari-api**.
4. When live, copy the service URL (e.g. `https://maskari-api.onrender.com`).
5. Confirm health: `https://maskari-api.onrender.com/health`

> Free tier sleeps after ~15 min idle; first reconnect may take ~30s.

### 2. Deploy the client on Vercel

1. Go to [vercel.com](https://vercel.com) → **Add New Project** → import the same repo.
2. **Root Directory:** leave blank (repo root — **not** `server` or `client`).
3. Vercel picks up `vercel.json` automatically.
4. **Environment variable** (required):

   | Name | Value |
   |------|-------|
   | `VITE_SERVER_URL` | Your Render URL, e.g. `https://maskari-api.onrender.com` |

4. Deploy. Open your `*.vercel.app` URL and play.

Or from the CLI (logged in to Vercel):

```bash
vercel --prod
# set VITE_SERVER_URL in the Vercel dashboard, then redeploy
```

### Monolith (single server, no Vercel)

```bash
npm run build
npm start
```

Serves client + API on one port (`SERVE_CLIENT=true` by default).

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Dev server + Vite client with hot reload |
| `npm run build` | Build shared, server, and client |
| `npm start` | Production server (requires build first) |
| `npm test` | Smoke test against localhost:3001 |

## Testing

Start the server in one terminal:

```bash
npm run dev:server
# or: npm start (after build)
```

Run the smoke test in another:

```bash
npm test
```

The smoke test covers room flow, guessing, game over, play again, and reconnect.

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
├── client/src/    # React UI
└── scripts/       # Smoke test
```
