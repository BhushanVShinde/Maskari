import { useState } from "react";
import type { Ack, GameSettings, Player, RoomState } from "@maskari/shared";
import {
  MIN_PLAYERS_TO_START,
  SETTINGS_LIMITS,
} from "@maskari/shared";
import SoundToggle from "./SoundToggle";

type Props = {
  state: RoomState;
  me: Player | null;
  isHost: boolean;
  updateSettings: (settings: Partial<GameSettings>) => void;
  startGame: () => Promise<Ack<null>>;
  leaveRoom: () => void;
  soundOn: boolean;
  onToggleSound: () => void;
};

export default function Lobby({
  state,
  me,
  isHost,
  updateSettings,
  startGame,
  leaveRoom,
  soundOn,
  onToggleSound,
}: Props) {
  const [copied, setCopied] = useState(false);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  const shareUrl = `${window.location.origin}${window.location.pathname}?room=${state.code}`;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard may be unavailable; ignore */
    }
  }

  const canStart = state.players.length >= MIN_PLAYERS_TO_START;

  async function handleStart() {
    setStartError(null);
    setStarting(true);
    const res = await startGame();
    setStarting(false);
    if (!res.ok) setStartError(res.error);
  }

  return (
    <div className="page page--wide">
      <div className="lobby">
        <header className="lobby__head">
          <div>
            <h1>
              Lobby <span className="tag">waiting</span>
            </h1>
            <p className="subtitle">Share the code, then the host starts.</p>
          </div>
          <div className="lobby__head-actions">
            <SoundToggle enabled={soundOn} onToggle={onToggleSound} />
            <button className="btn btn--ghost" onClick={leaveRoom}>
              Leave
            </button>
          </div>
        </header>

        <div className="lobby__grid">
          {/* Players */}
          <section className="panel">
            <h2 className="panel__title">
              Players <span className="muted">({state.players.length})</span>
            </h2>
            <ul className="players">
              {state.players.map((p) => (
                <li
                  key={p.id}
                  className={`player ${!p.connected ? "player--offline" : ""}`}
                >
                  <span className="avatar" style={{ background: p.color }} />
                  <span className="player__name">
                    {p.nickname}
                    {p.id === me?.id && <span className="you"> (you)</span>}
                  </span>
                  {p.isHost && <span className="badge">host</span>}
                  {!p.connected && <span className="badge badge--off">offline</span>}
                </li>
              ))}
            </ul>
          </section>

          {/* Room code + settings */}
          <section className="panel">
            <h2 className="panel__title">Room code</h2>
            <div className="code-box">
              <span className="code-box__code">{state.code}</span>
              <button className="btn btn--sm" onClick={copyLink}>
                {copied ? "Copied!" : "Copy link"}
              </button>
            </div>

            <h2 className="panel__title" style={{ marginTop: "1.5rem" }}>
              Settings
            </h2>

            <SettingRow
              label="Rounds"
              value={state.settings.rounds}
              min={SETTINGS_LIMITS.rounds.min}
              max={SETTINGS_LIMITS.rounds.max}
              disabled={!isHost}
              onChange={(rounds) => updateSettings({ rounds })}
            />
            <SettingRow
              label="Draw time (s)"
              value={state.settings.drawTimeSeconds}
              min={SETTINGS_LIMITS.drawTimeSeconds.min}
              max={SETTINGS_LIMITS.drawTimeSeconds.max}
              step={10}
              disabled={!isHost}
              onChange={(drawTimeSeconds) => updateSettings({ drawTimeSeconds })}
            />
            <SettingRow
              label="Max players"
              value={state.settings.maxPlayers}
              min={SETTINGS_LIMITS.maxPlayers.min}
              max={SETTINGS_LIMITS.maxPlayers.max}
              disabled={!isHost}
              onChange={(maxPlayers) => updateSettings({ maxPlayers })}
            />

            {isHost ? (
              <>
                <button
                  className="btn"
                  style={{ marginTop: "1.25rem" }}
                  disabled={!canStart || starting}
                  title={
                    canStart
                      ? "Start the game"
                      : `Need at least ${MIN_PLAYERS_TO_START} players`
                  }
                  onClick={handleStart}
                >
                  {starting
                    ? "Starting…"
                    : canStart
                      ? "Start game"
                      : `Waiting for players (${state.players.length}/${MIN_PLAYERS_TO_START})`}
                </button>
                {startError && <p className="error" style={{ marginTop: "0.75rem" }}>{startError}</p>}
              </>
            ) : (
              <p className="muted" style={{ marginTop: "1.25rem" }}>
                Waiting for the host to start…
              </p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function SettingRow({
  label,
  value,
  min,
  max,
  step = 1,
  disabled,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  disabled: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <div className="setting">
      <span className="setting__label">{label}</span>
      <div className="setting__control">
        <button
          className="stepper"
          disabled={disabled || value <= min}
          onClick={() => onChange(value - step)}
          type="button"
        >
          −
        </button>
        <span className="setting__value">{value}</span>
        <button
          className="stepper"
          disabled={disabled || value >= max}
          onClick={() => onChange(value + step)}
          type="button"
        >
          +
        </button>
      </div>
    </div>
  );
}
