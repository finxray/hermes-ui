"use client";

import type { NormalizedHermesStatus } from "@hermes-ui/hermes-client";
import { RefreshCw, Search } from "@/components/ui/AppIcons";
import { EmptyState } from "@/components/ui/EmptyState";
import { HermesDashboardRecoveryState } from "@/components/ui/HermesDashboardRecoveryState";
import { useSectionNav } from "@/components/shell/SectionNavContext";
import { useHermesLogs } from "@/hooks/useHermesLogs";
import { useEffect, useMemo, useState } from "react";
import styles from "./LogsView.module.css";

type LogsViewProps = {
  hermesStatus: NormalizedHermesStatus | null;
};

const LOG_FILES = [
  { id: "agent", label: "Agent" },
  { id: "gateway", label: "Gateway" }
];

type LogFilter = "all" | "warn" | "error";

export function LogsView({ hermesStatus }: LogsViewProps) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<LogFilter>("all");
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
  const filteredLines = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return lines.filter((line) => {
      const level = detectLevel(line);
      const levelMatches = filter === "all" || level === filter;
      const queryMatches = normalizedQuery.length === 0 || line.toLowerCase().includes(normalizedQuery);
      return levelMatches && queryMatches;
    });
  }, [filter, lines, query]);

  return (
    <section className={styles.view} aria-labelledby="logs-heading">
      <div className={styles.header}>
        <div>
          <h1 id="logs-heading">Logs</h1>
          <p>
            {canLoad
              ? `${activeLabel} log - ${filteredLines.length} of ${lines.length} lines`
              : "Agent and gateway runtime logs"}
          </p>
        </div>
        <button
          aria-label="Refresh logs"
          className={`${styles.iconButton} ${styles.refreshButton}${isLoading ? ` ${styles.refreshing}` : ""}`}
          disabled={!canLoad || isLoading}
          onClick={() => void refresh()}
          type="button"
        >
          <RefreshCw size={20} />
        </button>
      </div>

      {canLoad ? (
        <div className={styles.toolbar} aria-label="Log controls">
          <label className={styles.searchBox}>
            <Search size={15} aria-hidden="true" />
            <span className={styles.srOnly}>Search logs</span>
            <input
              aria-label="Search logs"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search logs"
              type="search"
              value={query}
            />
          </label>
          <div className={styles.segmented} aria-label="Log severity" role="group">
            <FilterButton active={filter === "all"} label="All" onClick={() => setFilter("all")} />
            <FilterButton active={filter === "warn"} label="Warnings" onClick={() => setFilter("warn")} />
            <FilterButton active={filter === "error"} label="Errors" onClick={() => setFilter("error")} />
          </div>
        </div>
      ) : null}

      {!canLoad ? (
        <EmptyState compact tone="important" title="Logs are unavailable" body="Connect a reachable Hermes runtime to read its logs." />
      ) : result?.ok === false ? (
        <HermesDashboardRecoveryState onRecovered={refresh} resourceName="Logs" />
      ) : isLoading && lines.length === 0 ? (
        <div className={styles.loading}>Loading {activeLabel} log...</div>
      ) : lines.length === 0 ? (
        <EmptyState compact title="No log lines" body="This log is currently empty." />
      ) : filteredLines.length === 0 ? (
        <EmptyState compact title="No matching log lines" body="Adjust the search or severity filter." />
      ) : (
        <div className={styles.consoleFrame}>
          <pre className={styles.console} data-scrollable="true" aria-label={`${activeLabel} log`}>
            {filteredLines.map((line, index) => (
              <LogLine key={index} line={line} />
            ))}
          </pre>
        </div>
      )}
    </section>
  );
}

function FilterButton({
  active,
  label,
  onClick
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      aria-pressed={active}
      className={styles.filterButton}
      data-active={active ? "true" : "false"}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
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
