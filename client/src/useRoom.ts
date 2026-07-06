import { useCallback, useEffect, useRef, useState } from "react";
import type {
  Ack,
  ChatMessage,
  GameOverPayload,
  GameSettings,
  JoinedRoomData,
  RoundEndPayload,
  RoomState,
} from "@maskari/shared";
import { socket } from "./socket";
import { clearSession, loadSession, saveSession } from "./session";
import {
  isSoundEnabled,
  playCorrectGuess,
  playRoundEnd,
  playTurnStart,
  setSoundEnabled,
} from "./sounds";

/**
 * Owns the client's view of the room: the current public RoomState, this
 * browser's playerId, and connection status. Exposes promise-based actions
 * that wrap Socket.IO acknowledgements so components can await results.
 */
export function useRoom() {
  const [connected, setConnected] = useState(socket.connected);
  const [reconnecting, setReconnecting] = useState(false);
  const [state, setState] = useState<RoomState | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [closedReason, setClosedReason] = useState<string | null>(null);
  const [soundOn, setSoundOn] = useState(isSoundEnabled);

  /** Private drawer state (not in public RoomState). */
  const [wordChoices, setWordChoices] = useState<string[] | null>(null);
  const [chooseEndsAt, setChooseEndsAt] = useState<number | null>(null);
  const [myWord, setMyWord] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [lastRoundEnd, setLastRoundEnd] = useState<RoundEndPayload | null>(null);
  const [gameOverInfo, setGameOverInfo] = useState<GameOverPayload | null>(null);

  const reconnectAttempt = useRef(false);

  const resetPrivateState = useCallback(() => {
    setWordChoices(null);
    setChooseEndsAt(null);
    setMyWord(null);
    setChatMessages([]);
    setLastRoundEnd(null);
    setGameOverInfo(null);
  }, []);

  const applyJoined = useCallback(
    (data: JoinedRoomData) => {
      setPlayerId(data.playerId);
      setState(data.state);
      setClosedReason(null);
      saveSession(data.state.code, data.playerId);
    },
    [],
  );

  const trySessionReconnect = useCallback(() => {
    const session = loadSession();
    if (!session || reconnectAttempt.current) return;

    reconnectAttempt.current = true;
    setReconnecting(true);
    socket.emit("room:reconnect", session, (res) => {
      reconnectAttempt.current = false;
      setReconnecting(false);
      if (res.ok) {
        applyJoined(res.data);
        return;
      }

      clearSession();
      setState(null);
      setPlayerId(null);
      resetPrivateState();
      setClosedReason(res.error);
    });
  }, [applyJoined, resetPrivateState]);

  useEffect(() => {
    function onConnect() {
      setConnected(true);
      trySessionReconnect();
    }
    function onDisconnect() {
      setConnected(false);
    }
    function onRoomUpdate(next: RoomState) {
      setState(next);
      if (next.phase === "lobby") {
        resetPrivateState();
      }
      if (next.phase === "choosing" || next.phase === "drawing") {
        setGameOverInfo(null);
      }
    }
    function onRoomClosed({ reason }: { reason: string }) {
      clearSession();
      setState(null);
      setPlayerId(null);
      resetPrivateState();
      setClosedReason(reason);
    }
    function onWordChoices(payload: { words: string[]; chooseEndsAt: number }) {
      setWordChoices(payload.words);
      setChooseEndsAt(payload.chooseEndsAt);
      setMyWord(null);
    }
    function onYourWord(payload: { word: string }) {
      setMyWord(payload.word);
      setWordChoices(null);
      setChooseEndsAt(null);
    }
    function onTurnStart() {
      playTurnStart();
      setWordChoices(null);
      setChooseEndsAt(null);
      setChatMessages([]);
      setLastRoundEnd(null);
    }
    function onRoundEnd(payload: RoundEndPayload) {
      playRoundEnd();
      setMyWord(null);
      setLastRoundEnd(payload);
    }
    function onGameOver(payload: GameOverPayload) {
      setMyWord(null);
      setWordChoices(null);
      setChooseEndsAt(null);
      setLastRoundEnd(null);
      setGameOverInfo(payload);
    }
    function onChatMessage(msg: ChatMessage) {
      if (msg.kind === "correct") playCorrectGuess();
      setChatMessages((prev) => [...prev, msg]);
    }

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("room:update", onRoomUpdate);
    socket.on("room:closed", onRoomClosed);
    socket.on("game:wordChoices", onWordChoices);
    socket.on("game:yourWord", onYourWord);
    socket.on("game:turnStart", onTurnStart);
    socket.on("game:roundEnd", onRoundEnd);
    socket.on("game:gameOver", onGameOver);
    socket.on("chat:message", onChatMessage);

    if (socket.connected) trySessionReconnect();

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("room:update", onRoomUpdate);
      socket.off("room:closed", onRoomClosed);
      socket.off("game:wordChoices", onWordChoices);
      socket.off("game:yourWord", onYourWord);
      socket.off("game:turnStart", onTurnStart);
      socket.off("game:roundEnd", onRoundEnd);
      socket.off("game:gameOver", onGameOver);
      socket.off("chat:message", onChatMessage);
    };
  }, [resetPrivateState, trySessionReconnect]);

  const createRoom = useCallback(
    (nickname: string, color: string): Promise<Ack<JoinedRoomData>> =>
      new Promise((resolve) => {
        socket.emit("room:create", { nickname, color }, (res) => {
          if (res.ok) applyJoined(res.data);
          resolve(res);
        });
      }),
    [applyJoined],
  );

  const joinRoom = useCallback(
    (
      roomCode: string,
      nickname: string,
      color: string,
    ): Promise<Ack<JoinedRoomData>> =>
      new Promise((resolve) => {
        socket.emit("room:join", { roomCode, nickname, color }, (res) => {
          if (res.ok) applyJoined(res.data);
          resolve(res);
        });
      }),
    [applyJoined],
  );

  const updateSettings = useCallback((settings: Partial<GameSettings>) => {
    socket.emit("room:updateSettings", settings);
  }, []);

  const startGame = useCallback(
    (): Promise<Ack<null>> =>
      new Promise((resolve) => {
        socket.emit("room:startGame", (res) => resolve(res));
      }),
    [],
  );

  const chooseWord = useCallback((word: string) => {
    socket.emit("word:choose", { word });
  }, []);

  const sendChat = useCallback((text: string) => {
    socket.emit("chat:message", { text });
  }, []);

  const returnToLobby = useCallback(() => {
    socket.emit("room:returnToLobby");
  }, []);

  const leaveRoom = useCallback(() => {
    clearSession();
    socket.emit("room:leave");
    setState(null);
    setPlayerId(null);
    resetPrivateState();
  }, [resetPrivateState]);

  const toggleSound = useCallback(() => {
    setSoundOn((prev) => {
      const next = !prev;
      setSoundEnabled(next);
      return next;
    });
  }, []);

  const me =
    state && playerId
      ? (state.players.find((p) => p.id === playerId) ?? null)
      : null;
  const isHost = !!me?.isHost;
  const isDrawer = !!me && state?.currentDrawerId === me.id;
  const hasGuessed =
    !!me && !!state?.correctGuessers.includes(me.id);

  return {
    connected,
    reconnecting,
    state,
    playerId,
    me,
    isHost,
    isDrawer,
    hasGuessed,
    closedReason,
    wordChoices,
    chooseEndsAt,
    myWord,
    chatMessages,
    lastRoundEnd,
    gameOverInfo,
    soundOn,
    createRoom,
    joinRoom,
    updateSettings,
    startGame,
    chooseWord,
    sendChat,
    returnToLobby,
    leaveRoom,
    toggleSound,
  };
}
