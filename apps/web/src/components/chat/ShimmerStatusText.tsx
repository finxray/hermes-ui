import { memo } from "react";
import styles from "./ShimmerStatusText.module.css";

type ShimmerStatusTextProps = {
  children: string;
  className?: string;
};

export const ShimmerStatusText = memo(function ShimmerStatusText({
  children,
  className
}: ShimmerStatusTextProps) {
  return (
    <span className={[styles.shimmerText, className].filter(Boolean).join(" ")}>{children}</span>
  );
});
