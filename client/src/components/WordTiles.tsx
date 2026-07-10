type Props = {
  masked: string;
  hintCount?: number;
};

/** Skribbl-style letter tiles from a masked word string (e.g. "_ _ A _"). */
export default function WordTiles({ masked, hintCount = 0 }: Props) {
  const segments = masked.split("   ");

  return (
    <div className="word-tiles-wrap">
      <div className="word-tiles" aria-label="Word to guess">
        {segments.map((seg, si) => (
          <div key={si} className="word-tiles__segment">
            {seg.split(" ").map((ch, i) => {
              const revealed = ch !== "_";
              return (
                <span
                  key={`${si}-${i}`}
                  className={`word-tile ${revealed ? "word-tile--revealed" : ""}`}
                >
                  {revealed ? ch : ""}
                </span>
              );
            })}
          </div>
        ))}
      </div>
      {hintCount > 0 && (
        <p className="word-tiles__hints">
          💡 {hintCount} letter{hintCount === 1 ? "" : "s"} revealed
        </p>
      )}
    </div>
  );
}
