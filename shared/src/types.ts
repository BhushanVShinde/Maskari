/**
 * Core domain types shared by client and server.
 *
 * These describe the *public* game state — i.e. what is safe to send to every
 * player. Secret data (the current word, per-drawer word choices) is delivered
 * through separate targeted events, never embedded in the shared room state.
 */

/** Host-configurable room settings. */
export interface GameSettings {
  /** How many full rounds (each player draws once per round). */
  rounds: number;
  /** Seconds a drawer has to draw each turn. */
  drawTimeSeconds: number;
  /** Maximum players allowed in the room. */
  maxPlayers: number;
}

/** A player as seen by everyone in the room. */
export interface Player {
  id: string;
  nickname: string;
  /** Avatar color (hex). */
  color: string;
  /** Whether this player is the room host. */
  isHost: boolean;
  /** Running total score across the game. */
  score: number;
  /** Whether the player's socket is currently connected. */
  connected: boolean;
}

/** High-level phase the room is in. */
export type GamePhase =
  | "lobby"
  | "choosing"
  | "drawing"
  | "roundEnd"
  | "gameOver";

/** Public snapshot of a room, broadcast on every change via `room:update`. */
export interface RoomState {
  code: string;
  hostId: string;
  phase: GamePhase;
  settings: GameSettings;
  players: Player[];
  /** 1-based current round number (0 while in lobby). */
  round: number;
  /** Total rounds this game (mirror of settings.rounds for convenience). */
  totalRounds: number;
  /** Player id of the current drawer, if any. */
  currentDrawerId: string | null;
  /** Masked word for guessers (e.g. "_ _ _"), null when not drawing. */
  maskedWord: string | null;
  /** Number of guessable letters in the current word. */
  wordLength: number | null;
  /** Epoch ms when the drawing timer ends (null unless drawing). */
  turnEndsAt: number | null;
  /** Epoch ms when the drawer's word-choice window ends (null unless choosing). */
  chooseEndsAt: number | null;
  /** The revealed word during the round-end/game-over phases. */
  revealWord: string | null;
  /** Player ids who have guessed correctly this turn. */
  correctGuessers: string[];
  /** Epoch ms when the round-end pause ends (null unless roundEnd). */
  roundEndEndsAt: number | null;
}
