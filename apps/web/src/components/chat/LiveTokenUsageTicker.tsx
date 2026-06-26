import { memo, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import styles from "./LiveTokenUsageTicker.module.css";

export type LiveTokenUsageSnapshot = {
  promptTokens?: number;
  completionTokens?: number;
};

type LiveTokenUsageTickerProps = LiveTokenUsageSnapshot;

const TOKEN_DIGITS = Array.from({ length: 10 }, (_, index) => index);
const TOKEN_TICKER_MIN_FRAME_MS = 84;

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
  const lastPaintAtRef = useRef(0);

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
    const delta = Math.abs(to - from);
    const durationMs = Math.min(2600, Math.max(1000, Math.sqrt(delta) * 110));
    const displayStep = tokenDisplayStep(delta, durationMs);
    lastPaintAtRef.current = 0;

    const step = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / durationMs);
      const eased = 1 - Math.pow(1 - progress, 3);
      const rawNext = from + (to - from) * eased;
      const canPaint =
        progress >= 1 ||
        lastPaintAtRef.current === 0 ||
        now - lastPaintAtRef.current >= TOKEN_TICKER_MIN_FRAME_MS;
      const next =
        progress >= 1
          ? to
          : quantizeTokenDisplayValue(rawNext, to, displayStep);

      if (canPaint && next !== displayValueRef.current) {
        displayValueRef.current = next;
        setDisplayValue(next);
        lastPaintAtRef.current = now;
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

function tokenDisplayStep(delta: number, durationMs: number) {
  const tokensPerSecond = (delta / durationMs) * 1000;
  if (tokensPerSecond >= 500 || delta >= 1000) {
    return 25;
  }
  if (tokensPerSecond >= 180 || delta >= 300) {
    return 10;
  }
  if (tokensPerSecond >= 70 || delta >= 120) {
    return 5;
  }
  return 1;
}

function quantizeTokenDisplayValue(value: number, target: number, step: number) {
  if (step <= 1) {
    return Math.round(value);
  }
  const rounded = Math.round(value / step) * step;
  return value <= target ? Math.min(rounded, target) : Math.max(rounded, target);
}

function formatTokenCount(value: number) {
  const safe = Math.max(0, Math.round(value));
  if (safe >= 1_000_000) {
    return `${formatCompactTokenValue(safe / 1_000_000)}m`;
  }
  if (safe >= 1_000) {
    return `${formatCompactTokenValue(safe / 1_000)}k`;
  }
  return new Intl.NumberFormat().format(safe);
}

function formatCompactTokenValue(value: number) {
  if (value >= 100) {
    return String(Math.round(value));
  }
  if (value >= 10) {
    return value.toFixed(1).replace(/\.0$/, "");
  }
  return value.toFixed(2).replace(/\.0+$/, "").replace(/(\.\d)0$/, "$1");
}
