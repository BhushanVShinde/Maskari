import { useEffect, useState } from "react";

type Props = {
  /** Epoch ms when the countdown reaches zero. */
  endsAt: number | null;
  label?: string;
  /** Called once when the timer hits zero. */
  onExpire?: () => void;
};

/** Live countdown driven by a server-provided deadline. */
export default function CountdownTimer({ endsAt, label, onExpire }: Props) {
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  useEffect(() => {
    if (endsAt == null) {
      setSecondsLeft(null);
      return;
    }
    const deadline = endsAt;

    let expired = false;
    function tick() {
      const left = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setSecondsLeft(left);
      if (left === 0 && !expired) {
        expired = true;
        onExpire?.();
      }
    }

    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [endsAt, onExpire]);

  if (secondsLeft === null) return null;

  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const display = `${mins}:${secs.toString().padStart(2, "0")}`;
  const urgent = secondsLeft <= 10;

  return (
    <div className={`timer ${urgent ? "timer--urgent" : ""}`}>
      {label && <span className="timer__label">{label}</span>}
      <span className="timer__value">{display}</span>
    </div>
  );
}
