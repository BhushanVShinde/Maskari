import type { RoundScoreEntry } from "@maskari/shared";
import CountdownTimer from "./CountdownTimer";

type Props = {
  word: string;
  drawerName: string;
  roundScores: RoundScoreEntry[];
  roundEndEndsAt: number;
};

/** Full-screen reveal between turns with points earned and a countdown. */
export default function RoundEndOverlay({
  word,
  drawerName,
  roundScores,
  roundEndEndsAt,
}: Props) {
  const totalEarned = roundScores.reduce((sum, s) => sum + s.points, 0);

  return (
    <div className="overlay overlay--round">
      <div className="overlay__card overlay__card--round">
        <p className="overlay__eyebrow">The word was</p>
        <h2 className="overlay__word">{word}</h2>
        <p className="overlay__sub">
          <strong>{drawerName}</strong> was drawing
        </p>

        {roundScores.length > 0 ? (
          <>
            <p className="overlay__scores-title">Points this turn</p>
            <ul className="overlay__scores">
              {roundScores.map((s) => (
                <li key={s.playerId}>
                  <span>{s.nickname}</span>
                  <span className="overlay__pts">+{s.points}</span>
                </li>
              ))}
            </ul>
            <p className="overlay__total">{totalEarned} pts awarded</p>
          </>
        ) : (
          <p className="overlay__none">Nobody scored this round.</p>
        )}

        <CountdownTimer endsAt={roundEndEndsAt} label="Next turn in" />
      </div>
    </div>
  );
}
