import { useEffect, useState } from "react";

type Props = {
  endsAt: number | null;
  totalSeconds?: number;
  label?: string;
  variant?: "bar" | "pill";
  onExpire?: () => void;
};

/** Live countdown with optional depleting progress bar (skribbl-style). */
export default function CountdownTimer({
  endsAt,
  totalSeconds = 80,
  label,
  variant = "bar",
  onExpire,
}: Props) {
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [progress, setProgress] = useState(1);

  useEffect(() => {
    if (endsAt == null) {
      setSecondsLeft(null);
      setProgress(1);
      return;
    }
    const deadline = endsAt;
    const totalMs = totalSeconds * 1000;

    let expired = false;
    function tick() {
      const msLeft = Math.max(0, deadline - Date.now());
      const left = Math.ceil(msLeft / 1000);
      setSecondsLeft(left);
      setProgress(Math.min(1, Math.max(0, msLeft / totalMs)));
      if (left === 0 && !expired) {
        expired = true;
        onExpire?.();
      }
    }

    tick();
    const id = setInterval(tick, 100);
    return () => clearInterval(id);
  }, [endsAt, totalSeconds, onExpire]);

  if (secondsLeft === null) return null;

  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const display = `${mins}:${secs.toString().padStart(2, "0")}`;
  const urgent = secondsLeft <= 10;
  const warn = secondsLeft <= 30 && !urgent;

  if (variant === "pill") {
    return (
      <div className={`timer timer--pill ${urgent ? "timer--urgent" : warn ? "timer--warn" : ""}`}>
        {label && <span className="timer__label">{label}</span>}
        <span className="timer__value">{display}</span>
      </div>
    );
  }

  return (
    <div className={`timer timer--bar ${urgent ? "timer--urgent" : warn ? "timer--warn" : ""}`}>
      <div className="timer__meta">
        {label && <span className="timer__label">{label}</span>}
        <span className="timer__value">{display}</span>
      </div>
      <div className="timer__track" role="progressbar" aria-valuenow={secondsLeft} aria-valuemin={0} aria-valuemax={totalSeconds}>
        <div className="timer__fill" style={{ width: `${progress * 100}%` }} />
      </div>
    </div>
  );
}
