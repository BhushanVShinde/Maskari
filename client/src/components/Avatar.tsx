type Props = {
  nickname: string;
  color: string;
  size?: "sm" | "md" | "lg";
  className?: string;
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase() || "?";
}

export default function Avatar({
  nickname,
  color,
  size = "md",
  className = "",
}: Props) {
  return (
    <span
      className={`avatar avatar--${size} ${className}`.trim()}
      style={{ background: color }}
      title={nickname}
      aria-hidden
    >
      {initials(nickname)}
    </span>
  );
}
