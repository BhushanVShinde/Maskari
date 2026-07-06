import { randomUUID } from "node:crypto";
import type { Server } from "socket.io";
import type {
  ChatMessage,
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData,
} from "@maskari/shared";
import {
  MIN_PLAYERS_TO_START,
  TIMING,
  WORD_CHOICE_COUNT,
  isCloseGuess,
  isCorrectGuess,
  pickWords,
  scoreDrawer,
  scoreGuesser,
  wordLetterCount,
} from "@maskari/shared";
import type { Room, ServerPlayer } from "./room.js";
import type { RoomStore } from "./store.js";

type IOServer = Server<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

/**
 * Drives the turn/round lifecycle for all rooms. Timing is authoritative on the
 * server; clients render countdowns from the `turnEndsAt` / `chooseEndsAt`
 * timestamps in the room state.
 */
export class GameManager {
  constructor(
    private io: IOServer,
    private _store: RoomStore,
  ) {}

  private broadcast(room: Room): void {
    this.io.to(room.code).emit("room:update", room.toState());
  }

  private socketForPlayer(room: Room, playerId: string) {
    const p = room.getPlayer(playerId);
    if (!p) return undefined;
    return this.io.sockets.sockets.get(p.socketId);
  }

  private emitChat(room: Room, message: ChatMessage): void {
    this.io.to(room.code).emit("chat:message", message);
  }

  private emitPrivate(playerId: string, room: Room, message: ChatMessage): void {
    this.socketForPlayer(room, playerId)?.emit("chat:message", message);
  }

  private newMessage(
    partial: Omit<ChatMessage, "id" | "timestamp">,
  ): ChatMessage {
    return { id: randomUUID(), timestamp: Date.now(), ...partial };
  }

  /** Host starts (or restarts) the game: reset scores and begin the first turn. */
  startGame(room: Room): { ok: boolean; error?: string } {
    if (room.playerCount < MIN_PLAYERS_TO_START) {
      return { ok: false, error: `Need at least ${MIN_PLAYERS_TO_START} players.` };
    }
    if (room.phase !== "lobby" && room.phase !== "gameOver") {
      return { ok: false, error: "Game already in progress." };
    }

    const restarting = room.phase === "gameOver";
    room.clearTimers();
    room.turnOrder = room.orderedPlayers().map((p) => p.id);
    room.turnIndex = 0;
    room.round = 1;
    room.usedWords.clear();
    room.revealWord = null;
    room.roundEndEndsAt = null;
    for (const p of room.orderedPlayers()) p.score = 0;

    this.io.to(room.code).emit("draw:clear");
    this.emitChat(
      room,
      this.newMessage({
        kind: "system",
        text: restarting ? "Play again! Scores reset." : "Game started!",
      }),
    );
    this.beginTurn(room);
    return { ok: true };
  }

  /** Enter the word-choosing phase for the current drawer. */
  private beginTurn(room: Room): void {
    room.clearTimers();

    const active = room.activeTurnPlayers();
    if (active.length < MIN_PLAYERS_TO_START) {
      this.endGame(room);
      return;
    }

    // Skip past any drawers who have left.
    let drawerId = room.turnOrder[room.turnIndex];
    while (drawerId && !room.getPlayer(drawerId)) {
      if (!this.advanceIndex(room)) {
        this.endGame(room);
        return;
      }
      drawerId = room.turnOrder[room.turnIndex];
    }
    if (!drawerId) {
      this.endGame(room);
      return;
    }

    room.phase = "choosing";
    room.currentDrawerId = drawerId;
    room.currentWord = null;
    room.revealWord = null;
    room.correctGuessers = [];
    room.roundPoints.clear();
    room.turnStartedAt = null;
    room.roundEndEndsAt = null;
    room.turnEndsAt = null;
    room.clearStrokes();

    room.wordChoices = pickWords(WORD_CHOICE_COUNT, room.usedWords);
    room.chooseEndsAt = Date.now() + TIMING.chooseSeconds * 1000;

    this.io.to(room.code).emit("draw:clear");
    this.broadcast(room);

    const drawerSocket = this.socketForPlayer(room, drawerId);
    drawerSocket?.emit("game:wordChoices", {
      words: room.wordChoices,
      chooseEndsAt: room.chooseEndsAt,
    });

    room.chooseTimer = setTimeout(() => {
      const word =
        room.wordChoices[Math.floor(Math.random() * room.wordChoices.length)];
      this.startDrawing(room, word);
    }, TIMING.chooseSeconds * 1000);
  }

  /** Drawer picked a word (or auto-picked). Begin the drawing phase. */
  chooseWord(room: Room, playerId: string, word: string): void {
    if (room.phase !== "choosing") return;
    if (room.currentDrawerId !== playerId) return;
    if (!room.wordChoices.includes(word)) return;
    this.startDrawing(room, word);
  }

  private startDrawing(room: Room, word: string): void {
    room.clearTimers();
    room.usedWords.add(word);
    room.currentWord = word;
    room.phase = "drawing";
    room.chooseEndsAt = null;
    room.turnStartedAt = Date.now();
    room.turnEndsAt = Date.now() + room.settings.drawTimeSeconds * 1000;
    room.correctGuessers = [];
    room.roundPoints.clear();
    room.clearStrokes();

    this.io.to(room.code).emit("draw:clear");
    this.broadcast(room);

    const drawerId = room.currentDrawerId!;
    this.io.to(room.code).emit("game:turnStart", {
      drawerId,
      round: room.round,
      wordLength: wordLetterCount(word),
      totalTime: room.settings.drawTimeSeconds,
      turnEndsAt: room.turnEndsAt,
    });

    this.socketForPlayer(room, drawerId)?.emit("game:yourWord", { word });

    room.drawTimer = setTimeout(
      () => this.endTurn(room),
      room.settings.drawTimeSeconds * 1000,
    );
  }

  /** Process a chat message — may be a guess during the drawing phase. */
  handleChat(room: Room, playerId: string, rawText: unknown): void {
    const player = room.getPlayer(playerId);
    if (!player) return;

    const text =
      typeof rawText === "string" ? rawText.trim().slice(0, 200) : "";
    if (!text) return;

    const isDrawer = playerId === room.currentDrawerId;
    const alreadyGuessed = room.correctGuessers.includes(playerId);
    const canGuess =
      room.phase === "drawing" &&
      !isDrawer &&
      !alreadyGuessed &&
      !!room.currentWord;

    if (!canGuess) {
      this.emitChat(
        room,
        this.newMessage({
          kind: "chat",
          playerId,
          playerName: player.nickname,
          text,
        }),
      );
      return;
    }

    const word = room.currentWord!;

    if (isCorrectGuess(text, word)) {
      this.handleCorrectGuess(room, player, text);
      return;
    }

    if (isCloseGuess(text, word)) {
      this.emitPrivate(
        playerId,
        room,
        this.newMessage({ kind: "private", text: "So close!" }),
      );
    }

    this.emitChat(
      room,
      this.newMessage({
        kind: "chat",
        playerId,
        playerName: player.nickname,
        text,
      }),
    );
  }

  private handleCorrectGuess(
    room: Room,
    player: ServerPlayer,
    _guessText: string,
  ): void {
    const isFirst = room.correctGuessers.length === 0;
    room.correctGuessers.push(player.id);

    const totalMs = room.settings.drawTimeSeconds * 1000;
    const remaining = room.turnEndsAt
      ? Math.max(0, room.turnEndsAt - Date.now())
      : 0;
    const pts = scoreGuesser(remaining, totalMs, isFirst);
    player.score += pts;
    room.addRoundPoints(player.id, pts);

    this.emitChat(
      room,
      this.newMessage({
        kind: "correct",
        playerId: player.id,
        playerName: player.nickname,
        text: `${player.nickname} guessed the word!`,
      }),
    );

    this.emitPrivate(
      player.id,
      room,
      this.newMessage({
        kind: "private",
        text: `Correct! +${pts} points`,
        points: pts,
      }),
    );

    this.broadcast(room);

    if (this.allGuessersCorrect(room)) {
      this.endTurn(room);
    }
  }

  private guesserIds(room: Room): string[] {
    const drawerId = room.currentDrawerId;
    return room.activeTurnPlayers().filter((id) => id !== drawerId);
  }

  private allGuessersCorrect(room: Room): boolean {
    const guessers = this.guesserIds(room);
    return (
      guessers.length > 0 &&
      guessers.every((id) => room.correctGuessers.includes(id))
    );
  }

  /** End the current turn: score the drawer, reveal the word, pause, next turn. */
  endTurn(room: Room): void {
    room.clearTimers();
    if (!room.currentWord) return;

    // Award drawer points (0 if nobody guessed correctly).
    const drawerId = room.currentDrawerId;
    if (drawerId) {
      const correctCount = room.correctGuessers.length;
      const guesserCount = this.guesserIds(room).length;
      const drawerPts = scoreDrawer(correctCount, guesserCount);
      if (drawerPts > 0) {
        const drawer = room.getPlayer(drawerId);
        if (drawer) {
          drawer.score += drawerPts;
          room.addRoundPoints(drawerId, drawerPts);
        }
      }
    }

    room.phase = "roundEnd";
    room.revealWord = room.currentWord;
    room.turnEndsAt = null;
    room.chooseEndsAt = null;
    room.roundEndEndsAt = Date.now() + TIMING.roundEndSeconds * 1000;

    const roundScores = room.getRoundScores();
    const drawer = drawerId ? room.getPlayer(drawerId) : undefined;

    this.broadcast(room);
    this.io.to(room.code).emit("game:roundEnd", {
      word: room.currentWord,
      drawerId: room.currentDrawerId ?? "",
      drawerNickname: drawer?.nickname ?? "Someone",
      roundScores,
      roundEndEndsAt: room.roundEndEndsAt,
    });

    room.gapTimer = setTimeout(
      () => this.nextTurn(room),
      TIMING.roundEndSeconds * 1000,
    );
  }

  /** Advance turnIndex; returns false when the game is complete. */
  private advanceIndex(room: Room): boolean {
    room.turnIndex += 1;
    if (room.turnIndex >= room.turnOrder.length) {
      room.turnIndex = 0;
      room.round += 1;
      if (room.round > room.settings.rounds) return false;
    }
    return true;
  }

  private nextTurn(room: Room): void {
    room.clearTimers();
    if (!this.advanceIndex(room)) {
      this.endGame(room);
      return;
    }
    this.beginTurn(room);
  }

  private endGame(room: Room): void {
    room.clearTimers();
    room.phase = "gameOver";
    room.currentDrawerId = null;
    room.currentWord = null;
    room.turnEndsAt = null;
    room.chooseEndsAt = null;
    room.roundEndEndsAt = null;
    room.revealWord = null;

    const players = room.toState().players;
    const sorted = [...players].sort(
      (a, b) => b.score - a.score || a.nickname.localeCompare(b.nickname),
    );
    const top = sorted[0];

    this.broadcast(room);
    this.io.to(room.code).emit("game:gameOver", {
      players,
      winnerId: top?.id ?? null,
      winnerNickname: top?.nickname ?? null,
    });
  }

  /** Return a running game to the lobby (host action / reset). */
  returnToLobby(room: Room): void {
    room.resetGameState();
    this.io.to(room.code).emit("draw:clear");
    this.broadcast(room);
  }

  /**
   * React to a player leaving mid-game. If the drawer left, end their turn; if
   * too few players remain, stop the game.
   */
  handlePlayerLeft(room: Room, playerId: string): void {
    if (room.phase === "lobby" || room.phase === "gameOver") return;

    if (room.activeTurnPlayers().length < MIN_PLAYERS_TO_START) {
      this.endGame(room);
      return;
    }
    if (room.currentDrawerId === playerId) {
      this.nextTurn(room);
    }
  }

  /** Whether a socket's player may draw right now. */
  canDraw(room: Room, playerId: string | undefined): boolean {
    return (
      room.phase === "drawing" &&
      !!playerId &&
      room.currentDrawerId === playerId
    );
  }

  /** Push private + canvas state to a player who just reconnected. */
  syncPlayerOnReconnect(room: Room, playerId: string): void {
    const socket = this.socketForPlayer(room, playerId);
    if (!socket) return;

    socket.emit("draw:sync", room.getStrokes());

    if (room.phase === "choosing" && room.currentDrawerId === playerId) {
      if (room.wordChoices.length > 0 && room.chooseEndsAt) {
        socket.emit("game:wordChoices", {
          words: room.wordChoices,
          chooseEndsAt: room.chooseEndsAt,
        });
      }
    }

    if (room.phase === "drawing" && room.currentDrawerId === playerId && room.currentWord) {
      socket.emit("game:yourWord", { word: room.currentWord });
    }

    if (room.phase === "roundEnd" && room.revealWord && room.roundEndEndsAt) {
      const drawerId = room.currentDrawerId ?? "";
      const drawer = drawerId ? room.getPlayer(drawerId) : undefined;
      socket.emit("game:roundEnd", {
        word: room.revealWord,
        drawerId,
        drawerNickname: drawer?.nickname ?? "Someone",
        roundScores: room.getRoundScores(),
        roundEndEndsAt: room.roundEndEndsAt,
      });
    }

    if (room.phase === "gameOver") {
      const players = room.toState().players;
      const sorted = [...players].sort(
        (a, b) => b.score - a.score || a.nickname.localeCompare(b.nickname),
      );
      const top = sorted[0];
      socket.emit("game:gameOver", {
        players,
        winnerId: top?.id ?? null,
        winnerNickname: top?.nickname ?? null,
      });
    }
  }

  notifyDisconnected(room: Room, playerId: string): void {
    const player = room.getPlayer(playerId);
    if (!player) return;
    this.emitChat(
      room,
      this.newMessage({
        kind: "system",
        text: `${player.nickname} disconnected (${TIMING.disconnectGraceSeconds}s to rejoin).`,
      }),
    );
    this.broadcast(room);
  }

  notifyReconnected(room: Room, playerId: string): void {
    const player = room.getPlayer(playerId);
    if (!player) return;
    this.emitChat(
      room,
      this.newMessage({
        kind: "system",
        text: `${player.nickname} reconnected.`,
      }),
    );
    this.broadcast(room);
  }

  /** Remove a player after the disconnect grace period expires. */
  removePlayerAfterGrace(room: Room, playerId: string): void {
    const player = room.getPlayer(playerId);
    if (!player || player.connected) return;

    room.removePlayer(playerId);
    if (room.isEmpty()) {
      room.clearTimers();
      this._store.delete(room.code);
      console.log(`[room] ${room.code} deleted (empty)`);
      return;
    }

    this.emitChat(
      room,
      this.newMessage({
        kind: "system",
        text: `${player.nickname} left the room.`,
      }),
    );
    this.handlePlayerLeft(room, playerId);
    this.broadcast(room);
  }
}

export type { ServerPlayer };
