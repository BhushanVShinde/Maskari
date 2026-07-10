import { useEffect, useRef, useState } from "react";
import type { ChatMessage, GamePhase, Player } from "@maskari/shared";
import Avatar from "./Avatar";

type Props = {
  messages: ChatMessage[];
  players: Player[];
  phase: GamePhase;
  isDrawer: boolean;
  hasGuessed: boolean;
  onSend: (text: string) => void;
};

function playerColor(players: Player[], playerId?: string, playerName?: string): string {
  const byId = playerId ? players.find((p) => p.id === playerId) : undefined;
  if (byId) return byId.color;
  const byName = playerName ? players.find((p) => p.nickname === playerName) : undefined;
  return byName?.color ?? "#4a9fe8";
}

export default function ChatPanel({
  messages,
  players,
  phase,
  isDrawer,
  hasGuessed,
  onSend,
}: Props) {
  const [text, setText] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const msg = text.trim();
    if (!msg) return;
    onSend(msg);
    setText("");
  }

  const canGuess = phase === "drawing" && !isDrawer && !hasGuessed;
  const placeholder = canGuess
    ? "Type your guess here!"
    : hasGuessed
      ? "You guessed it! Chat only…"
      : isDrawer
        ? "Chat with players (can't guess)"
        : phase === "drawing"
          ? "Watch and wait…"
          : "Chat…";

  return (
    <aside className="game__chat">
      <div className="game__chat-head">Chat</div>
      <div className="chat-list" ref={listRef}>
        {messages.length === 0 && (
          <p className="chat-empty">Say hi or start guessing!</p>
        )}
        {messages.map((m) => {
          const color = playerColor(players, m.playerId, m.playerName);
          return (
            <div key={m.id} className={`chat-msg chat-msg--${m.kind}`}>
              {m.kind === "chat" && m.playerName ? (
                <div className="chat-msg__row">
                  <Avatar nickname={m.playerName} color={color} size="sm" />
                  <div className="chat-msg__body">
                    <span className="chat-msg__author" style={{ color }}>
                      {m.playerName}
                    </span>
                    <div className="chat-msg__text">{m.text}</div>
                  </div>
                </div>
              ) : (
                <>
                  <span className="chat-msg__text">{m.text}</span>
                  {m.points !== undefined && (
                    <span className="chat-msg__pts">+{m.points}</span>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>
      <form className="chat-form" onSubmit={handleSubmit}>
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={placeholder}
          maxLength={200}
          disabled={phase === "choosing"}
        />
        <button type="submit" className="btn btn--sm" disabled={phase === "choosing"}>
          Send
        </button>
      </form>
    </aside>
  );
}
