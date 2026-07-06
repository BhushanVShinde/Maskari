/**
 * Socket.IO event contracts shared by client and server.
 *
 * As the game grows, add new payload types here and extend the
 * ClientToServerEvents / ServerToClientEvents interfaces. Keeping the
 * protocol in one typed place means both ends stay in sync at compile time.
 */

import type { GameSettings, Player, RoomState } from "./types.js";
import type { ChatMessage, ChatSendPayload } from "./chat.js";
import type {
  DrawAppendPayload,
  DrawBeginPayload,
  DrawEndPayload,
  Stroke,
} from "./draw.js";

/* ------------------------------------------------------------------ */
/* Connection test (Step 1)                                            */
/* ------------------------------------------------------------------ */

export interface PingPayload {
  time: number;
}

export interface PongPayload {
  time: number;
  message: string;
  socketId: string;
}

/* ------------------------------------------------------------------ */
/* Acks                                                                */
/* ------------------------------------------------------------------ */

/** Generic acknowledgement wrapper for request/response style events. */
export type Ack<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

/* ------------------------------------------------------------------ */
/* Room / lobby (Step 2)                                               */
/* ------------------------------------------------------------------ */

export interface CreateRoomPayload {
  nickname: string;
  color: string;
}

export interface JoinRoomPayload {
  roomCode: string;
  nickname: string;
  color: string;
}

/** Returned to the player who created/joined so they know who they are. */
export interface JoinedRoomData {
  playerId: string;
  state: RoomState;
}

export interface ReconnectPayload {
  roomCode: string;
  playerId: string;
}

/* ------------------------------------------------------------------ */
/* Event maps                                                          */
/* ------------------------------------------------------------------ */

/** Events the client emits to the server. */
export interface ClientToServerEvents {
  "conn:ping": (payload: PingPayload) => void;

  "room:create": (
    payload: CreateRoomPayload,
    ack: (res: Ack<JoinedRoomData>) => void,
  ) => void;
  "room:join": (
    payload: JoinRoomPayload,
    ack: (res: Ack<JoinedRoomData>) => void,
  ) => void;
  "room:reconnect": (
    payload: ReconnectPayload,
    ack: (res: Ack<JoinedRoomData>) => void,
  ) => void;
  "room:updateSettings": (
    payload: Partial<GameSettings>,
    ack?: (res: Ack<RoomState>) => void,
  ) => void;
  "room:startGame": (ack?: (res: Ack<null>) => void) => void;
  "room:returnToLobby": () => void;
  "room:leave": () => void;

  /* Turn / word selection (Step 4) */
  "word:choose": (payload: { word: string }) => void;

  /* Chat / guesses (Step 5) */
  "chat:message": (payload: ChatSendPayload) => void;

  /* Drawing (Step 3) */
  "draw:begin": (payload: DrawBeginPayload) => void;
  "draw:append": (payload: DrawAppendPayload) => void;
  "draw:end": (payload: DrawEndPayload) => void;
  "draw:clear": () => void;
  "draw:undo": () => void;
  "draw:requestSync": (ack: (strokes: Stroke[]) => void) => void;
}

/** Events the server emits to clients. */
export interface ServerToClientEvents {
  "conn:pong": (payload: PongPayload) => void;

  /** Broadcast to everyone in a room whenever its public state changes. */
  "room:update": (state: RoomState) => void;
  /** Sent to a player when they are removed / the room closes. */
  "room:closed": (payload: { reason: string }) => void;

  /* Drawing (Step 3) — relayed to everyone except the origin. */
  "draw:begin": (payload: DrawBeginPayload) => void;
  "draw:append": (payload: DrawAppendPayload) => void;
  "draw:end": (payload: DrawEndPayload) => void;
  "draw:clear": () => void;
  "draw:undo": (payload: { strokeId: string }) => void;
  /** Full canvas snapshot for reconnect sync. */
  "draw:sync": (strokes: Stroke[]) => void;

  /* Turn / word selection (Step 4) */
  /** Private to the drawer: the 3 word options + choose deadline. */
  "game:wordChoices": (payload: {
    words: string[];
    chooseEndsAt: number;
  }) => void;
  /** Private to the drawer: the actual word they are drawing. */
  "game:yourWord": (payload: { word: string }) => void;
  /** Broadcast when a drawing turn begins. */
  "game:turnStart": (payload: {
    drawerId: string;
    round: number;
    wordLength: number;
    totalTime: number;
    turnEndsAt: number;
  }) => void;
  /** Broadcast when a turn ends — reveals the word + points earned. */
  "game:roundEnd": (payload: RoundEndPayload) => void;
  /** Broadcast when the whole game ends. */
  "game:gameOver": (payload: GameOverPayload) => void;

  /* Chat / guesses (Step 5) */
  "chat:message": (message: ChatMessage) => void;
}

export interface RoundEndPayload {
  word: string;
  drawerId: string;
  drawerNickname: string;
  /** Points each player earned this turn. */
  roundScores: RoundScoreEntry[];
  /** When the next turn begins. */
  roundEndEndsAt: number;
}

export interface RoundScoreEntry {
  playerId: string;
  nickname: string;
  points: number;
}

export interface GameOverPayload {
  players: Player[];
  winnerId: string | null;
  winnerNickname: string | null;
}

/** Per-socket data stored on the server. */
export interface SocketData {
  playerId?: string;
  roomCode?: string;
}

/** Inter-server events placeholder (unused for single-node in-memory setup). */
export type InterServerEvents = Record<string, never>;
