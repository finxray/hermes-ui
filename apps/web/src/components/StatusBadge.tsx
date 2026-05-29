type StatusBadgeProps = {
  label: string;
  tone?: "mock" | "quiet";
};

export function StatusBadge({ label, tone = "quiet" }: StatusBadgeProps) {
  return (
    <span className="status-badge" data-tone={tone}>
      <span className="status-dot" aria-hidden="true" />
      {label}
    </span>
  );
}
