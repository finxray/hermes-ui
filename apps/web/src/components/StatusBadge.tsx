type StatusBadgeProps = {
  label: string;
  tone?: "error" | "mock" | "quiet" | "success";
};

export function StatusBadge({ label, tone = "quiet" }: StatusBadgeProps) {
  return (
    <span className="status-badge" data-tone={tone}>
      <span className="status-dot" aria-hidden="true" />
      {label}
    </span>
  );
}
