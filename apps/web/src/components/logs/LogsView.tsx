"use client";

import type { NormalizedHermesStatus } from "@hermes-ui/hermes-client";
import { RefreshCw } from "@/components/ui/AppIcons";
import { EmptyState } from "@/components/ui/EmptyState";
import { useSectionNav } from "@/components/shell/SectionNavContext";
import { useHermesLogs } from "@/hooks/useHermesLogs";
import { useEffect } from "react";
import styles from "./LogsView.module.css";

type LogsViewProps = {
  hermesStatus: NormalizedHermesStatus | null;
};

const LOG_FILES = [
  { id: "agent", label: "Agent" },
  { id: "gateway", label: "Gateway" }
];

export function LogsView({ hermesStatus }: LogsViewProps) {
  const canLoad = hermesStatus?.mode === "real" && hermesStatus.reachable;
  const { activeCategoryId, publishCategories, setActiveCategoryId } = useSectionNav();
  const selectedFile = LOG_FILES.some((file) => file.id === activeCategoryId) ? activeCategoryId! : "agent";
  const { isLoading, lines, refresh, result } = useHermesLogs(canLoad, selectedFile);

  // The left rail lists log files; selecting one updates activeCategoryId, which
  // this view reads to choose which file to stream.
  useEffect(() => {
    publishCategories(
      "logs",
      LOG_FILES.map((file) => ({ id: file.id, label: file.label, count: 0 }))
    );
  }, [publishCategories]);

  useEffect(() => {
    if (!LOG_FILES.some((file) => file.id === activeCategoryId)) {
      setActiveCategoryId("agent");
    }
  }, [activeCategoryId, setActiveCategoryId]);

  const activeLabel = LOG_FILES.find((file) => file.id === selectedFile)?.label ?? selectedFile;

  return (
    <section className={styles.view} aria-labelledby="logs-heading">
      <div className={styles.header}>
        <div>
          <h1 id="logs-heading">Logs</h1>
          <p>{canLoad ? `${activeLabel} log - ${lines.length} lines` : "Agent and gateway runtime logs"}</p>
        </div>
        <button
          aria-label="Refresh logs"
          className={styles.iconButton}
          disabled={!canLoad || isLoading}
          onClick={() => void refresh()}
          title="Refresh logs"
          type="button"
        >
          <RefreshCw size={15} />
        </button>
      </div>

      {!canLoad ? (
        <EmptyState compact title="Logs are unavailable" body="Connect a reachable Hermes runtime to read its logs." />
      ) : result?.ok === false ? (
        <EmptyState compact title="Could not load logs" body={result.error.message} />
      ) : isLoading && lines.length === 0 ? (
        <div className={styles.loading}>Loading {activeLabel} log...</div>
      ) : lines.length === 0 ? (
        <EmptyState compact title="No log lines" body="This log is currently empty." />
      ) : (
        <pre className={styles.console} aria-label={`${activeLabel} log`}>
          {lines.map((line, index) => (
            <LogLine key={index} line={line} />
          ))}
        </pre>
      )}
    </section>
  );
}

function LogLine({ line }: { line: string }) {
  const level = detectLevel(line);
  return <code className={`${styles.line} ${level ? styles[level] : ""}`}>{line.replace(/\n$/, "")}</code>;
}

function detectLevel(line: string): "error" | "warn" | "info" | null {
  if (/\b(ERROR|CRITICAL|Traceback)\b/.test(line)) {
    return "error";
  }
  if (/\bWARN(ING)?\b/.test(line)) {
    return "warn";
  }
  if (/\bINFO\b/.test(line)) {
    return "info";
  }
  return null;
}
