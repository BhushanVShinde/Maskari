type Props = {
  enabled: boolean;
  onToggle: () => void;
  className?: string;
};

export default function SoundToggle({ enabled, onToggle, className = "" }: Props) {
  return (
    <button
      type="button"
      className={`btn btn--ghost btn--sm sound-toggle ${className}`.trim()}
      onClick={onToggle}
      aria-pressed={enabled}
      title={enabled ? "Mute sounds" : "Enable sounds"}
    >
      {enabled ? "🔊 Sound on" : "🔇 Sound off"}
    </button>
  );
}
