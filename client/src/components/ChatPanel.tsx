import { useEffect, useRef, useState } from "react";
import type { ChatMessage, GamePhase } from "@maskari/shared";

type Props = {
  messages: ChatMessage[];
  phase: GamePhase;
  isDrawer: boolean;
  hasGuessed: boolean;
  onSend: (text: string) => void;
};

export default function ChatPanel({
  messages,
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
    ? "Type your guess…"
    : hasGuessed
      ? "You got it! Chat only (no more guesses)"
      : isDrawer
        ? "Chat with guessers (you can't guess)"
        : phase === "drawing"
          ? "Watch the drawing…"
          : "Chat…";

  return (
    <aside className="chat-panel">
      <h2 className="panel__title">Chat</h2>
      <div className="chat-list" ref={listRef}>
        {messages.length === 0 && (
          <p className="chat-empty">No messages yet.</p>
        )}
        {messages.map((m) => (
          <div key={m.id} className={`chat-msg chat-msg--${m.kind}`}>
            {m.kind === "chat" && m.playerName && (
              <span className="chat-msg__author">{m.playerName}: </span>
            )}
            {m.kind === "system" && (
              <span className="chat-msg__system">ℹ </span>
            )}
            <span className="chat-msg__text">{m.text}</span>
            {m.points !== undefined && (
              <span className="chat-msg__pts">+{m.points}</span>
            )}
          </div>
        ))}
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
