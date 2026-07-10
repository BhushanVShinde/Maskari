import type { Player } from "@maskari/shared";
import Avatar from "./Avatar";

type Props = {
  player: Player;
  meId?: string | null;
  isDrawer?: boolean;
  hasGuessed?: boolean;
  isLeader?: boolean;
  score?: number;
  compact?: boolean;
};

export default function PlayerSlot({
  player,
  meId,
  isDrawer,
  hasGuessed,
  isLeader,
  score,
  compact,
}: Props) {
  return (
    <li
      className={[
        "player-slot",
        !player.connected && "player-slot--offline",
        isDrawer && "player-slot--drawer",
        hasGuessed && "player-slot--guessed",
        player.id === meId && "player-slot--me",
        compact && "player-slot--compact",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <Avatar nickname={player.nickname} color={player.color} size={compact ? "sm" : "md"} />
      <div className="player-slot__info">
        <span className="player-slot__name">
          {isLeader && <span className="player-slot__crown" title="Leading">👑</span>}
          {isDrawer && <span className="player-slot__pencil" title="Drawing">✏️</span>}
          {player.nickname}
          {player.id === meId && <span className="you"> (You)</span>}
        </span>
        <span className="player-slot__meta">
          {player.isHost && <span className="badge badge--host">Host</span>}
          {!player.connected && <span className="badge badge--off">Offline</span>}
          {hasGuessed && <span className="badge badge--ok">Guessed</span>}
        </span>
      </div>
      {score !== undefined && (
        <span className="player-slot__score">{score}</span>
      )}
    </li>
  );
}
