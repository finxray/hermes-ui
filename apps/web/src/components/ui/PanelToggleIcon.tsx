type PanelToggleIconProps = {
  side: "left" | "right";
};

export function PanelToggleIcon({ side }: PanelToggleIconProps) {
  const isLeft = side === "left";

  return (
    <svg
      aria-hidden="true"
      fill="none"
      focusable="false"
      viewBox="0 0 20 20"
    >
      <rect x="3.5" y="3.5" width="13" height="13" rx="3" stroke="currentColor" strokeWidth="1.5" />
      <path
        d={isLeft ? "M8 4.25V15.75" : "M12 4.25V15.75"}
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.5"
      />
      <path
        d={isLeft ? "M6.25 7.5V12.5" : "M13.75 7.5V12.5"}
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.5"
        opacity="0.55"
      />
    </svg>
  );
}
