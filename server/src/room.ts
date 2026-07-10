import type {
  DrawBeginPayload,
  GameSettings,
  GamePhase,
  Player,
  RoomState,
  Stroke,
} from "@maskari/shared";
import { DEFAULT_SETTINGS, maskWord, TIMING, wordLetterCount } from "@maskari/shared";

/** Server-side player record — the public `Player` plus internal fields. */
export interface ServerPlayer extends Player {
  /** Current Socket.IO socket id (changes on reconnect). */
  socketId: string;
}

/**
 * Authoritative server-side room. Holds everything about a game in progress.
 * Only `toState()` is exposed to clients, keeping secrets (word, choices) out
 * of the broadcast state as those features are added later.
 */
export class Room {
  readonly code: string;
  hostId: string = "";
  phase: GamePhase = "lobby";
  settings: GameSettings;
  round = 0;
  currentDrawerId: string | null = null;

  /* ---- Turn / word state (secrets stay server-side) ---- */
  /** Snapshot of player ids in turn order, set at game start. */
  turnOrder: string[] = [];
  /** Index into turnOrder for the current drawer. */
  turnIndex = 0;
  /** The secret word currently being drawn. */
  currentWord: string | null = null;
  /** The 3 options currently offered to the drawer. */
  wordChoices: string[] = [];
  /** Words already used this game, to avoid repeats. */
  usedWords = new Set<string>();
  /** Timers (never serialized). */
  chooseTimer: ReturnType<typeof setTimeout> | null = null;
  drawTimer: ReturnType<typeof setTimeout> | null = null;
  gapTimer: ReturnType<typeof setTimeout> | null = null;
  hintTimer: ReturnType<typeof setTimeout> | null = null;
  /** 0-based indices of letters revealed as hints this turn. */
  revealedHintIndices = new Set<number>();
  turnEndsAt: number | null = null;
  chooseEndsAt: number | null = null;
  revealWord: string | null = null;
  /** Player ids who guessed correctly this turn (order matters for bonus). */
  correctGuessers: string[] = [];
  /** When the current drawing phase started (for scoring). */
  turnStartedAt: number | null = null;
  /** Epoch ms when the round-end pause ends (null unless roundEnd). */
  roundEndEndsAt: number | null = null;
  /** Points earned this turn per playerId (for round-end summary). */
  roundPoints = new Map<string, number>();

  /** Players keyed by playerId. */
  private players = new Map<string, ServerPlayer>();
  /** Join order — drives host succession and (later) turn order. */
  private order: string[] = [];

  /** Canvas history for the current drawing, for late-join sync + undo. */
  private strokes: Stroke[] = [];
  private strokeIndex = new Map<string, Stroke>();

  /** Grace-period timers before a disconnected player is removed. */
  private disconnectTimers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(code: string, settings: GameSettings = { ...DEFAULT_SETTINGS }) {
    this.code = code;
    this.settings = settings;
  }

  get playerCount(): number {
    return this.players.size;
  }

  isEmpty(): boolean {
    return this.players.size === 0;
  }

  isFull(): boolean {
    return this.players.size >= this.settings.maxPlayers;
  }

  getPlayer(playerId: string): ServerPlayer | undefined {
    return this.players.get(playerId);
  }

  getPlayerBySocket(socketId: string): ServerPlayer | undefined {
    for (const p of this.players.values()) {
      if (p.socketId === socketId) return p;
    }
    return undefined;
  }

  addPlayer(player: ServerPlayer): void {
    // First player becomes host.
    if (this.players.size === 0) {
      player.isHost = true;
      this.hostId = player.id;
    }
    this.players.set(player.id, player);
    this.order.push(player.id);
  }

  removePlayer(playerId: string): void {
    if (!this.players.has(playerId)) return;
    this.cancelDisconnectTimer(playerId);
    this.players.delete(playerId);
    this.order = this.order.filter((id) => id !== playerId);

    // Reassign host to the next player in join order if the host left.
    if (this.hostId === playerId) {
      const next = this.order[0];
      this.hostId = next ?? "";
      if (next) {
        const p = this.players.get(next);
        if (p) p.isHost = true;
      }
    }
  }

  updateSettings(settings: GameSettings): void {
    this.settings = settings;
  }

  /** Mark a player offline and start the reconnect grace timer. */
  markDisconnected(
    playerId: string,
    onExpired: () => void,
  ): void {
    const player = this.players.get(playerId);
    if (!player) return;
    player.connected = false;
    this.cancelDisconnectTimer(playerId);
    this.disconnectTimers.set(
      playerId,
      setTimeout(onExpired, TIMING.disconnectGraceSeconds * 1000),
    );
  }

  /** Player reconnected within the grace window. */
  reconnectPlayer(playerId: string, socketId: string): ServerPlayer | undefined {
    const player = this.players.get(playerId);
    if (!player) return undefined;
    this.cancelDisconnectTimer(playerId);
    player.connected = true;
    player.socketId = socketId;
    return player;
  }

  cancelDisconnectTimer(playerId: string): void {
    const t = this.disconnectTimers.get(playerId);
    if (t) clearTimeout(t);
    this.disconnectTimers.delete(playerId);
  }

  clearAllDisconnectTimers(): void {
    for (const t of this.disconnectTimers.values()) clearTimeout(t);
    this.disconnectTimers.clear();
  }

  /* ---- Turn helpers ---- */

  clearTimers(): void {
    if (this.chooseTimer) clearTimeout(this.chooseTimer);
    if (this.drawTimer) clearTimeout(this.drawTimer);
    if (this.gapTimer) clearTimeout(this.gapTimer);
    if (this.hintTimer) clearTimeout(this.hintTimer);
    this.chooseTimer = null;
    this.drawTimer = null;
    this.gapTimer = null;
    this.hintTimer = null;
  }

  /** Reset all per-game/turn state back to lobby defaults. */
  resetGameState(): void {
    this.clearTimers();
    this.clearAllDisconnectTimers();
    this.phase = "lobby";
    this.round = 0;
    this.turnOrder = [];
    this.turnIndex = 0;
    this.currentDrawerId = null;
    this.currentWord = null;
    this.wordChoices = [];
    this.usedWords.clear();
    this.turnEndsAt = null;
    this.chooseEndsAt = null;
    this.revealWord = null;
    this.correctGuessers = [];
    this.turnStartedAt = null;
    this.roundPoints.clear();
    this.roundEndEndsAt = null;
    this.revealedHintIndices.clear();
    this.clearStrokes();
  }

  /** The subset of the turn order still present in the room. */
  activeTurnPlayers(): string[] {
    return this.turnOrder.filter((id) => this.players.has(id));
  }

  /* ---- Drawing history ---- */

  beginStroke(p: DrawBeginPayload): void {
    const stroke: Stroke = {
      id: p.id,
      color: p.color,
      size: p.size,
      mode: p.mode,
      points: [p.x, p.y],
    };
    this.strokes.push(stroke);
    this.strokeIndex.set(stroke.id, stroke);
  }

  appendPoint(id: string, x: number, y: number): void {
    const stroke = this.strokeIndex.get(id);
    if (stroke) stroke.points.push(x, y);
  }

  /** Remove the most recent stroke; returns its id (or null if none). */
  undoLastStroke(): string | null {
    const stroke = this.strokes.pop();
    if (!stroke) return null;
    this.strokeIndex.delete(stroke.id);
    return stroke.id;
  }

  clearStrokes(): void {
    this.strokes = [];
    this.strokeIndex.clear();
  }

  getStrokes(): Stroke[] {
    return this.strokes;
  }

  addRoundPoints(playerId: string, points: number): void {
    this.roundPoints.set(
      playerId,
      (this.roundPoints.get(playerId) ?? 0) + points,
    );
  }

  getRoundScores(): { playerId: string; nickname: string; points: number }[] {
    const out: { playerId: string; nickname: string; points: number }[] = [];
    for (const [playerId, points] of this.roundPoints) {
      if (points <= 0) continue;
      const p = this.getPlayer(playerId);
      if (p) out.push({ playerId, nickname: p.nickname, points });
    }
    return out.sort((a, b) => b.points - a.points);
  }

  /** Ordered list of players (join order). */
  orderedPlayers(): ServerPlayer[] {
    return this.order
      .map((id) => this.players.get(id))
      .filter((p): p is ServerPlayer => p !== undefined);
  }

  /** Public snapshot safe to broadcast to all players. */
  toState(): RoomState {
    return {
      code: this.code,
      hostId: this.hostId,
      phase: this.phase,
      settings: this.settings,
      round: this.round,
      totalRounds: this.settings.rounds,
      currentDrawerId: this.currentDrawerId,
      maskedWord: this.currentWord
        ? maskWord(this.currentWord, this.revealedHintIndices)
        : null,
      wordLength: this.currentWord ? wordLetterCount(this.currentWord) : null,
      hintCount: this.revealedHintIndices.size,
      turnEndsAt: this.turnEndsAt,
      chooseEndsAt: this.chooseEndsAt,
      revealWord: this.revealWord,
      correctGuessers: [...this.correctGuessers],
      roundEndEndsAt: this.roundEndEndsAt,
      players: this.orderedPlayers().map(
        ({ id, nickname, color, isHost, score, connected }): Player => ({
          id,
          nickname,
          color,
          isHost,
          score,
          connected,
        }),
      ),
    };
  }
}
