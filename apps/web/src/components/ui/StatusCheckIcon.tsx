import { Check } from "lucide-react";
import styles from "./StatusCheckIcon.module.css";

type StatusCheckIconProps = {
  className?: string;
  size?: number;
};

export function StatusCheckIcon({ className, size = 14 }: StatusCheckIconProps) {
  return (
    <span className={[styles.root, className].filter(Boolean).join(" ")} aria-hidden="true">
      <Check size={size} strokeWidth={2} />
    </span>
  );
}
