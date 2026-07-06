import { useEffect, useState } from "react";
import type { Ack, JoinedRoomData } from "@maskari/shared";
import { AVATAR_COLORS, NICKNAME } from "@maskari/shared";
import SoundToggle from "./SoundToggle";

type Props = {
  connected: boolean;
  createRoom: (nickname: string, color: string) => Promise<Ack<JoinedRoomData>>;
  joinRoom: (
    code: string,
    nickname: string,
    color: string,
  ) => Promise<Ack<JoinedRoomData>>;
  soundOn: boolean;
  onToggleSound: () => void;
};

export default function Landing({ connected, createRoom, joinRoom, soundOn, onToggleSound }: Props) {
  const [nickname, setNickname] = useState("");
  const [color, setColor] = useState<string>(AVATAR_COLORS[5]);
  const [mode, setMode] = useState<"create" | "join">("create");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Prefill + switch to join mode when arriving via a shared ?room=CODE link.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const room = params.get("room");
    if (room) {
      setCode(room.toUpperCase());
      setMode("join");
    }
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const name = nickname.trim();
    if (name.length < NICKNAME.min) {
      setError("Please enter a nickname.");
      return;
    }
    if (mode === "join" && code.trim().length === 0) {
      setError("Enter a room code to join.");
      return;
    }

    setBusy(true);
    const res =
      mode === "create"
        ? await createRoom(name, color)
        : await joinRoom(code.trim(), name, color);
    setBusy(false);

    if (!res.ok) setError(res.error);
  }

  return (
    <div className="page">
      <div className="card">
        <h1>
          Maskari <span className="tag">draw &amp; guess</span>
        </h1>
        <p className="subtitle">Free multiplayer Pictionary. No sign-up.</p>

        <div className="landing-tools">
          <SoundToggle enabled={soundOn} onToggle={onToggleSound} />
        </div>

        <div className="segmented">
          <button
            type="button"
            className={mode === "create" ? "seg seg--active" : "seg"}
            onClick={() => setMode("create")}
          >
            Create room
          </button>
          <button
            type="button"
            className={mode === "join" ? "seg seg--active" : "seg"}
            onClick={() => setMode("join")}
          >
            Join room
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <label className="field">
            <span>Nickname</span>
            <input
              type="text"
              value={nickname}
              maxLength={NICKNAME.max}
              placeholder="e.g. Picasso"
              onChange={(e) => setNickname(e.target.value)}
              autoFocus
            />
          </label>

          {mode === "join" && (
            <label className="field">
              <span>Room code</span>
              <input
                type="text"
                value={code}
                placeholder="ABCDE"
                className="code-input"
                onChange={(e) => setCode(e.target.value.toUpperCase())}
              />
            </label>
          )}

          <div className="field">
            <span>Avatar color</span>
            <div className="colors">
              {AVATAR_COLORS.map((c) => (
                <button
                  type="button"
                  key={c}
                  className={`swatch ${color === c ? "swatch--active" : ""}`}
                  style={{ background: c }}
                  onClick={() => setColor(c)}
                  aria-label={`color ${c}`}
                />
              ))}
            </div>
          </div>

          {error && <p className="error">{error}</p>}

          <button className="btn" type="submit" disabled={busy || !connected}>
            {!connected
              ? "Connecting…"
              : busy
                ? "Please wait…"
                : mode === "create"
                  ? "Create room"
                  : "Join room"}
          </button>
        </form>
      </div>
    </div>
  );
}
