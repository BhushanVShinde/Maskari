import type { Server, Socket } from "socket.io";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData,
  CreateRoomPayload,
  JoinRoomPayload,
  ReconnectPayload,
} from "@maskari/shared";
import {
  AVATAR_COLORS,
  DEFAULT_SETTINGS,
  NICKNAME,
  sanitizeSettings,
} from "@maskari/shared";
import type { RoomStore } from "./store.js";
import type { ServerPlayer } from "./room.js";
import type { GameManager } from "./game.js";
import { cleanNickname, generatePlayerId } from "./util.js";

type IOServer = Server<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;
type IOSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

function normalizeColor(color: unknown): string {
  return typeof color === "string" && (AVATAR_COLORS as readonly string[]).includes(color)
    ? color
    : AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
}

export function registerHandlers(
  io: IOServer,
  store: RoomStore,
  game: GameManager,
): void {
  io.on("connection", (socket: IOSocket) => {
    console.log(`[socket] connected: ${socket.id}`);

    /* ---- Step 1 connection test ---- */
    socket.on("conn:ping", ({ time }) => {
      socket.emit("conn:pong", {
        time,
        message: "pong from Maskari server",
        socketId: socket.id,
      });
    });

    /* ---- Create room ---- */
    socket.on("room:create", (payload: CreateRoomPayload, ack) => {
      const nickname = cleanNickname(payload?.nickname, NICKNAME.max);
      if (nickname.length < NICKNAME.min) {
        return ack({ ok: false, error: "Please enter a nickname." });
      }

      const room = store.create({ ...DEFAULT_SETTINGS });
      const player: ServerPlayer = {
        id: generatePlayerId(),
        nickname,
        color: normalizeColor(payload?.color),
        isHost: false,
        score: 0,
        connected: true,
        socketId: socket.id,
      };
      room.addPlayer(player);

      socket.data.playerId = player.id;
      socket.data.roomCode = room.code;
      socket.join(room.code);

      ack({ ok: true, data: { playerId: player.id, state: room.toState() } });
      io.to(room.code).emit("room:update", room.toState());
      console.log(`[room] ${room.code} created by ${nickname}`);
    });

    /* ---- Join room ---- */
    socket.on("room:join", (payload: JoinRoomPayload, ack) => {
      const nickname = cleanNickname(payload?.nickname, NICKNAME.max);
      if (nickname.length < NICKNAME.min) {
        return ack({ ok: false, error: "Please enter a nickname." });
      }

      const code =
        typeof payload?.roomCode === "string"
          ? payload.roomCode.toUpperCase().trim()
          : "";
      const room = store.get(code);
      if (!room) {
        return ack({ ok: false, error: "Room not found. Check the code." });
      }
      if (room.phase !== "lobby") {
        return ack({ ok: false, error: "That game has already started." });
      }
      if (room.isFull()) {
        return ack({ ok: false, error: "Room is full." });
      }

      const player: ServerPlayer = {
        id: generatePlayerId(),
        nickname,
        color: normalizeColor(payload?.color),
        isHost: false,
        score: 0,
        connected: true,
        socketId: socket.id,
      };
      room.addPlayer(player);

      socket.data.playerId = player.id;
      socket.data.roomCode = room.code;
      socket.join(room.code);

      ack({ ok: true, data: { playerId: player.id, state: room.toState() } });
      io.to(room.code).emit("room:update", room.toState());
      console.log(`[room] ${nickname} joined ${room.code}`);
    });

    /* ---- Reconnect after refresh / brief disconnect ---- */
    socket.on("room:reconnect", (payload: ReconnectPayload, ack) => {
      const roomCode =
        typeof payload?.roomCode === "string"
          ? payload.roomCode.toUpperCase().trim()
          : "";
      const reconnectId =
        typeof payload?.playerId === "string" ? payload.playerId : "";
      const room = roomCode ? store.get(roomCode) : undefined;
      if (!room) {
        return ack({ ok: false, error: "Room not found." });
      }
      const existing = room.getPlayer(reconnectId);
      if (!existing) {
        return ack({ ok: false, error: "You are no longer in this room." });
      }

      room.reconnectPlayer(reconnectId, socket.id);
      socket.data.playerId = reconnectId;
      socket.data.roomCode = room.code;
      socket.join(room.code);

      ack({ ok: true, data: { playerId: reconnectId, state: room.toState() } });
      game.syncPlayerOnReconnect(room, reconnectId);
      game.notifyReconnected(room, reconnectId);
      io.to(room.code).emit("room:update", room.toState());
      console.log(`[room] ${existing.nickname} reconnected to ${room.code}`);
    });

    /* ---- Host updates settings ---- */
    socket.on("room:updateSettings", (payload, ack) => {
      const { roomCode, playerId } = socket.data;
      const room = roomCode ? store.get(roomCode) : undefined;
      if (!room || !playerId) {
        return ack?.({ ok: false, error: "You are not in a room." });
      }
      if (room.hostId !== playerId) {
        return ack?.({ ok: false, error: "Only the host can change settings." });
      }
      if (room.phase !== "lobby") {
        return ack?.({ ok: false, error: "Settings are locked once the game starts." });
      }

      room.updateSettings(sanitizeSettings(payload ?? {}));
      ack?.({ ok: true, data: room.toState() });
      io.to(room.code).emit("room:update", room.toState());
    });

    /* ---- Start game ---- */
    socket.on("room:startGame", (ack) => {
      const { roomCode, playerId } = socket.data;
      const room = roomCode ? store.get(roomCode) : undefined;
      if (!room || !playerId) {
        return ack?.({ ok: false, error: "You are not in a room." });
      }
      if (room.hostId !== playerId) {
        return ack?.({ ok: false, error: "Only the host can start the game." });
      }
      if (room.phase !== "lobby" && room.phase !== "gameOver") {
        return ack?.({ ok: false, error: "Game already in progress." });
      }

      const res = game.startGame(room);
      if (!res.ok) return ack?.({ ok: false, error: res.error ?? "Cannot start." });
      ack?.({ ok: true, data: null });
      console.log(`[room] ${room.code} started`);
    });

    /* ---- Drawer chooses a word ---- */
    socket.on("word:choose", ({ word }) => {
      const { roomCode, playerId } = socket.data;
      const room = roomCode ? store.get(roomCode) : undefined;
      if (!room || !playerId) return;
      game.chooseWord(room, playerId, word);
    });

    /* ---- Chat / guesses ---- */
    socket.on("chat:message", ({ text }) => {
      const { roomCode, playerId } = socket.data;
      const room = roomCode ? store.get(roomCode) : undefined;
      if (!room || !playerId) return;
      game.handleChat(room, playerId, text);
    });

    /* ---- Return to lobby ---- */
    socket.on("room:returnToLobby", () => {
      const { roomCode, playerId } = socket.data;
      const room = roomCode ? store.get(roomCode) : undefined;
      if (!room || !playerId || room.hostId !== playerId) return;
      game.returnToLobby(room);
    });

    /* ---- Drawing relay (only the current drawer may draw) ---- */
    function activeRoomForDraw() {
      const { roomCode, playerId } = socket.data;
      const room = roomCode ? store.get(roomCode) : undefined;
      if (!room || !game.canDraw(room, playerId)) return undefined;
      return room;
    }

    socket.on("draw:begin", (payload) => {
      const room = activeRoomForDraw();
      if (!room) return;
      room.beginStroke(payload);
      socket.to(room.code).emit("draw:begin", payload);
    });

    socket.on("draw:append", (payload) => {
      const room = activeRoomForDraw();
      if (!room) return;
      room.appendPoint(payload.id, payload.x, payload.y);
      socket.to(room.code).emit("draw:append", payload);
    });

    socket.on("draw:end", (payload) => {
      const room = activeRoomForDraw();
      if (!room) return;
      socket.to(room.code).emit("draw:end", payload);
    });

    socket.on("draw:clear", () => {
      const room = activeRoomForDraw();
      if (!room) return;
      room.clearStrokes();
      socket.to(room.code).emit("draw:clear");
    });

    socket.on("draw:undo", () => {
      const room = activeRoomForDraw();
      if (!room) return;
      const strokeId = room.undoLastStroke();
      if (strokeId) io.to(room.code).emit("draw:undo", { strokeId });
    });

    socket.on("draw:requestSync", (ack) => {
      const { roomCode } = socket.data;
      const room = roomCode ? store.get(roomCode) : undefined;
      ack(room ? room.getStrokes() : []);
    });

    /* ---- Leave / disconnect ---- */
    function leaveRoom() {
      const { roomCode, playerId } = socket.data;
      if (!roomCode || !playerId) return;
      const room = store.get(roomCode);
      if (!room) return;

      room.removePlayer(playerId);
      socket.leave(roomCode);
      socket.data.roomCode = undefined;
      socket.data.playerId = undefined;

      if (room.isEmpty()) {
        room.clearTimers();
        store.delete(room.code);
        console.log(`[room] ${room.code} deleted (empty)`);
      } else {
        // Let the game engine react (drawer left, too few players, etc.).
        game.handlePlayerLeft(room, playerId);
        io.to(room.code).emit("room:update", room.toState());
      }
    }

    socket.on("room:leave", leaveRoom);

    socket.on("disconnect", (reason) => {
      console.log(`[socket] disconnected: ${socket.id} (${reason})`);
      const { roomCode, playerId } = socket.data;
      if (!roomCode || !playerId) return;
      const room = store.get(roomCode);
      if (!room || !room.getPlayer(playerId)) return;

      room.markDisconnected(playerId, () => {
        const still = store.get(roomCode);
        if (!still) return;
        game.removePlayerAfterGrace(still, playerId);
      });

      game.notifyDisconnected(room, playerId);
      io.to(room.code).emit("room:update", room.toState());
    });
  });
}
