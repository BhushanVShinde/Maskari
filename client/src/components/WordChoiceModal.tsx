import { TIMING } from "@maskari/shared";
import CountdownTimer from "./CountdownTimer";

type Props = {
  words: string[];
  chooseEndsAt: number;
  onChoose: (word: string) => void;
};

export default function WordChoiceModal({
  words,
  chooseEndsAt,
  onChoose,
}: Props) {
  return (
    <div className="modal-backdrop">
      <div className="modal">
        <h2 className="modal__title">Choose a word</h2>
        <p className="modal__hint">Pick one to draw — or we choose for you!</p>

        <CountdownTimer
          endsAt={chooseEndsAt}
          totalSeconds={TIMING.chooseSeconds}
          label="Choose in"
          variant="bar"
        />

        <div className="word-choices">
          {words.map((word) => (
            <button
              key={word}
              type="button"
              className="word-btn"
              onClick={() => onChoose(word)}
            >
              {word}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
