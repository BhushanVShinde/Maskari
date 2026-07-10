type Props = {
  enabled: boolean;
  onToggle: () => void;
  className?: string;
};

export default function SoundToggle({ enabled, onToggle, className = "" }: Props) {
  return (
    <button
      type="button"
      className={`sound-toggle ${className}`.trim()}
      onClick={onToggle}
      aria-pressed={enabled}
      title={enabled ? "Mute sounds" : "Enable sounds"}
    >
      <span className="sound-toggle__icon" aria-hidden>
        {enabled ? "🔊" : "🔇"}
      </span>
      <span className="sound-toggle__label">{enabled ? "On" : "Off"}</span>
    </button>
  );
}
