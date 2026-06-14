import { memo, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import styles from "./LiveTokenUsageTicker.module.css";

export type LiveTokenUsageSnapshot = {
  promptTokens?: number;
  completionTokens?: number;
};

type LiveTokenUsageTickerProps = LiveTokenUsageSnapshot;

const TOKEN_DIGITS = Array.from({ length: 10 }, (_, index) => index);

export const LiveTokenUsageTicker = memo(function LiveTokenUsageTicker({
  promptTokens,
  completionTokens,
  variant = "composer"
}: LiveTokenUsageTickerProps & { variant?: "activity" | "composer" }) {
  const hasPrompt = typeof promptTokens === "number";
  const hasCompletion = typeof completionTokens === "number";

  if (!hasPrompt && !hasCompletion) {
    return null;
  }

  return (
    <div className={styles.ticker} data-variant={variant} aria-live="polite" aria-label="Live token usage">
      {hasPrompt ? <TokenMetric kind="in" label="in" value={promptTokens} /> : null}
      {hasCompletion ? <TokenMetric kind="out" label="out" value={completionTokens} /> : null}
    </div>
  );
});

function TokenMetric({
  kind,
  label,
  value
}: {
  kind: "in" | "out";
  label: string;
  value: number;
}) {
  const animatedValue = useAnimatedNumber(value);

  return (
    <span className={styles.metric} data-kind={kind}>
      <span className={styles.metricValueWrap}>
        <RollingTokenNumber value={animatedValue} />
      </span>
      <span className={styles.metricLabel}>{label}</span>
    </span>
  );
}

function RollingTokenNumber({ value }: { value: number }) {
  const formatted = useMemo(() => formatTokenCount(value), [value]);
  const chars = useMemo(() => Array.from(formatted), [formatted]);
  const digitSlotCount = useMemo(() => chars.filter((char) => /\d/.test(char)).length, [chars]);
  const separatorCount = chars.length - digitSlotCount;

  return (
    <span
      className={styles.numberSpin}
      aria-label={formatted}
      data-digit-slots={digitSlotCount}
      style={
        {
          "--digit-slots": digitSlotCount,
          "--separator-slots": separatorCount
        } as CSSProperties
      }
    >
      {chars.map((char, index) => {
        const isDigit = /\d/.test(char);
        if (!isDigit) {
          return (
            <span className={styles.numberSeparator} key={`sep-${index}`} aria-hidden="true">
              {char}
            </span>
          );
        }

        const digitIndexFromRight = formatted.slice(index + 1).replace(/\D/g, "").length;
        const stableKey = `digit-${digitIndexFromRight}`;

        return (
          <RollingDigit
            digit={Number(char)}
            digitIndexFromRight={digitIndexFromRight}
            key={stableKey}
          />
        );
      })}
    </span>
  );
}

function RollingDigit({
  digit,
  digitIndexFromRight
}: {
  digit: number;
  digitIndexFromRight: number;
}) {
  return (
    <span
      className={styles.digitCell}
      aria-hidden="true"
      style={
        {
          "--digit-index": digitIndexFromRight,
          "--digit-offset": `${digit * -1}em`,
          "--digit-value": digit
        } as CSSProperties
      }
    >
      <span className={styles.digitReel}>
        {TOKEN_DIGITS.map((value) => (
          <span className={styles.digitGlyph} key={value}>
            {value}
          </span>
        ))}
      </span>
    </span>
  );
}

function useAnimatedNumber(target: number) {
  const initialValue = Math.max(0, Math.round(target));
  const [displayValue, setDisplayValue] = useState(initialValue);
  const displayValueRef = useRef(initialValue);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    if (frameRef.current !== null) {
      window.cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }

    const from = displayValueRef.current;
    const to = Math.max(0, Math.round(target));
    if (from === to) {
      displayValueRef.current = to;
      setDisplayValue(to);
      return;
    }

    const startedAt = performance.now();
    const durationMs = Math.min(2200, Math.max(900, Math.sqrt(Math.abs(to - from)) * 95));

    const step = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / durationMs);
      const eased = 1 - Math.pow(1 - progress, 3);
      const next = Math.round(from + (to - from) * eased);
      if (next !== displayValueRef.current) {
        displayValueRef.current = next;
        setDisplayValue(next);
      }
      if (progress < 1) {
        frameRef.current = window.requestAnimationFrame(step);
        return;
      }
      displayValueRef.current = to;
      setDisplayValue(to);
      frameRef.current = null;
    };

    frameRef.current = window.requestAnimationFrame(step);
    return () => {
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
  }, [target]);

  return displayValue;
}

function formatTokenCount(value: number) {
  return new Intl.NumberFormat().format(Math.max(0, Math.round(value)));
}
