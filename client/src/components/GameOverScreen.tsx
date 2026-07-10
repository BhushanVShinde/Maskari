import { useState } from "react";
import type { Ack, Player } from "@maskari/shared";
import Avatar from "./Avatar";

type Props = {
  players: Player[];
  me: Player | null;
  isHost: boolean;
  winnerId: string | null;
  winnerNickname: string | null;
  onPlayAgain: () => Promise<Ack<null>>;
  onBackToLobby: () => void;
  onLeave: () => void;
};

const MEDALS = ["🥇", "🥈", "🥉"];

export default function GameOverScreen({
  players,
  me,
  isHost,
  winnerId,
  winnerNickname,
  onPlayAgain,
  onBackToLobby,
  onLeave,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sorted = [...players].sort(
    (a, b) => b.score - a.score || a.nickname.localeCompare(b.nickname),
  );
  const isWinner = !!me && me.id === winnerId;

  async function handlePlayAgain() {
    setError(null);
    setBusy(true);
    const res = await onPlayAgain();
    setBusy(false);
    if (!res.ok) setError(res.error);
  }

  return (
    <div className="page game-over-page">
      <div className="card card--wide game-over-card">
        <h1>
          Game over! <span className="tag">final scores</span>
        </h1>

        {winnerNickname && (
          <div className={`winner-banner ${isWinner ? "winner-banner--you" : ""}`}>
            <span className="winner-banner__crown">👑</span>
            <Avatar nickname={winnerNickname} color={sorted[0]?.color ?? "#eab308"} size="lg" />
            <div>
              <p className="winner-banner__label">Winner</p>
              <p className="winner-banner__name">
                {winnerNickname}
                {isWinner && <span className="you"> (You!)</span>}
              </p>
            </div>
            <span className="winner-banner__score">{sorted[0]?.score ?? 0}</span>
          </div>
        )}

        <ol className="leaderboard">
          {sorted.map((p, i) => (
            <li
              key={p.id}
              className={`leaderboard__row ${p.id === winnerId ? "leaderboard__row--winner" : ""}`}
            >
              <span className="leaderboard__rank">
                {i < 3 ? MEDALS[i] : i + 1}
              </span>
              <Avatar nickname={p.nickname} color={p.color} size="md" />
              <span className="leaderboard__name">
                {p.nickname}
                {p.id === me?.id && <span className="you"> (you)</span>}
              </span>
              <span className="leaderboard__score">{p.score}</span>
            </li>
          ))}
        </ol>

        <div className="game-over__actions">
          {isHost ? (
            <>
              <button className="btn btn--play" type="button" onClick={handlePlayAgain} disabled={busy}>
                {busy ? "Starting…" : "🔄 Play again"}
              </button>
              <button className="btn btn--ghost" type="button" onClick={onBackToLobby}>
                Back to lobby
              </button>
            </>
          ) : (
            <p className="muted game-over__wait">
              Waiting for the host to start a new game…
            </p>
          )}
          <button className="btn btn--ghost" type="button" onClick={onLeave}>
            Leave room
          </button>
        </div>

        {error && <p className="error">{error}</p>}
      </div>
    </div>
  );
}
