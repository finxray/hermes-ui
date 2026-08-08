"use client";

import type { NormalizedHermesStatus } from "@hermes-ui/hermes-client";
import { ChevronRight, Cog, Cpu, Download, KeyRound, ScrollText } from "lucide-react";
import appPackage from "../../../package.json";
import { RefreshCw, RotateCcw } from "@/components/ui/AppIcons";
import type { Project, Session } from "@/data/types";
import type { AppUpdateController } from "@/hooks/useAppUpdate";
import { useSectionAnchors } from "@/hooks/useSectionAnchors";
import { useSectionNav } from "@/components/shell/SectionNavContext";
import { useEffect, type ReactNode } from "react";
import type { ShellSection } from "@/components/shell/TopBar";
import styles from "./SettingsView.module.css";

const SETTINGS_CATEGORIES = [
  { id: "general", label: "General", count: 3 },
  { id: "connections", label: "Connections", count: 1 },
  { id: "updates", label: "Updates", count: 2 },
  { id: "workspace", label: "Workspace", count: 4 }
];

type SettingsViewProps = {
  activeProject: Project;
  appUpdate: AppUpdateController;
  hermesStatus: NormalizedHermesStatus | null;
  isHermesStatusLoading: boolean;
  onNavigate: (section: ShellSection) => void;
  onRefreshHermes: () => void;
  onResetWorkspace: () => void;
  projects: Project[];
  sessions: Session[];
};

export function SettingsView({
  activeProject,
  appUpdate,
  hermesStatus,
  isHermesStatusLoading,
  onNavigate,
  onRefreshHermes,
  onResetWorkspace,
  projects,
  sessions
}: SettingsViewProps) {
  const sectionNav = useSectionNav();
  const register = useSectionAnchors("settings", SETTINGS_CATEGORIES);
  const activeSessionCount = sessions.filter((session) => !session.archivedAt).length;

  useEffect(() => {
    sectionNav.publishSectionLabel("settings", "Settings");
  }, [sectionNav]);

  function resetWorkspace() {
    if (window.confirm("Reset local projects and chats to their initial state?")) {
      onResetWorkspace();
    }
  }

  function refreshConnections() {
    onRefreshHermes();
  }

  return (
    <section className={styles.view} aria-labelledby="settings-heading">
      <div className={styles.header}>
        <div>
          <h1 id="settings-heading">Settings</h1>
          <p>Manage Stoix, Hermes access, and local workspace data</p>
        </div>
        <button
          aria-label="Refresh connections"
          className={`${styles.iconButton} ${styles.refreshButton}${isHermesStatusLoading ? ` ${styles.refreshing}` : ""}`}
          disabled={isHermesStatusLoading}
          onClick={refreshConnections}
          type="button"
        >
          <RefreshCw aria-hidden="true" size={20} strokeWidth={1.8} />
        </button>
      </div>

      <div className={styles.stack}>
        <SettingsGroup id="general" label="General" register={register}>
          <NavigationRow
            description="Inspect and edit the configuration exposed by the Hermes runtime"
            icon={<Cog size={20} strokeWidth={1.8} />}
            label="Runtime configuration"
            onClick={() => onNavigate("config")}
          />
          <NavigationRow
            description="Manage provider credentials through the Stoix backend"
            icon={<KeyRound size={20} strokeWidth={1.8} />}
            label="API keys"
            onClick={() => onNavigate("keys")}
          />
          <NavigationRow
            description="Review relevant Hermes runtime and request activity"
            icon={<ScrollText size={20} strokeWidth={1.8} />}
            label="Logs"
            onClick={() => onNavigate("logs")}
          />
        </SettingsGroup>

        <SettingsGroup id="connections" label="Connections" register={register}>
          <ConnectionRow
            description={connectionDescription(hermesStatus, "Hermes agent runtime")}
            icon={<Cpu size={20} strokeWidth={1.8} />}
            isLoading={isHermesStatusLoading}
            label="Hermes"
            onRefresh={onRefreshHermes}
            status={connectionLabel(hermesStatus, isHermesStatusLoading)}
            tone={connectionTone(hermesStatus)}
          />
        </SettingsGroup>

        <SettingsGroup id="updates" label="Updates" register={register}>
          <ValueRow description="Stable release channel" label="Stoix version" value={appPackage.version} />
          <UpdateRow
            isChecking={appUpdate.isChecking}
            onCheck={() => void appUpdate.check()}
            result={appUpdate.result}
          />
        </SettingsGroup>

        <SettingsGroup id="workspace" label="Workspace" register={register}>
          <ValueRow description="Project used by the active chat" label="Active project" value={activeProject.name} />
          <ValueRow description="Projects stored in this local Stoix profile" label="Projects" value={String(projects.length)} />
          <ValueRow description="Non-archived conversations stored locally" label="Conversations" value={String(activeSessionCount)} />
          <div className={styles.settingRow}>
            <span className={styles.rowIcon} aria-hidden="true"><RotateCcw size={20} strokeWidth={1.8} /></span>
            <span className={styles.rowCopy}>
              <strong>Reset local workspace</strong>
              <span>Restore the initial local projects and conversations</span>
            </span>
            <button className={styles.resetButton} onClick={resetWorkspace} type="button">Reset</button>
          </div>
        </SettingsGroup>
      </div>
    </section>
  );
}

function UpdateRow({
  isChecking,
  onCheck,
  result
}: {
  isChecking: boolean;
  onCheck: () => void;
  result: AppUpdateController["result"];
}) {
  const updateAvailable = result?.status === "update-available";
  const description = updateStatusDescription(result, isChecking);

  return (
    <div className={styles.settingRow} data-update-available={updateAvailable ? "true" : "false"}>
      <span className={styles.rowIcon} aria-hidden="true">
        {updateAvailable ? (
          <Download size={20} strokeWidth={1.8} />
        ) : (
          <RefreshCw className={isChecking ? styles.inlineRefreshing : undefined} size={20} strokeWidth={1.8} />
        )}
      </span>
      <span className={styles.rowCopy}>
        <strong>Software updates</strong>
        <span>{description}</span>
      </span>
      {updateAvailable && result?.manifest ? (
        <a
          className={styles.updateButton}
          href={result.manifest.releaseUrl}
          rel="noreferrer noopener"
          target="_blank"
        >
          Review update
        </a>
      ) : (
        <button className={styles.updateButton} disabled={isChecking} onClick={onCheck} type="button">
          {isChecking ? "Checking" : "Check now"}
        </button>
      )}
    </div>
  );
}

function updateStatusDescription(
  result: AppUpdateController["result"],
  isChecking: boolean
) {
  if (isChecking) return "Checking the stable release channel";
  if (!result) return "Check the stable release channel for a newer version";
  if (result.status === "update-available") {
    const firstNote = result.manifest?.notes[0];
    return `Version ${result.latestVersion} is available${firstNote ? ` - ${firstNote}` : ""}`;
  }
  if (result.status === "current") return `Version ${result.currentVersion} is up to date. Checked just now`;
  if (result.status === "unconfigured") return "This release channel is not configured";
  return result.error ?? "The update service could not be reached";
}

function SettingsGroup({
  children,
  id,
  label,
  register
}: {
  children: ReactNode;
  id: string;
  label: string;
  register: (id: string) => (element: HTMLElement | null) => void;
}) {
  return (
    <section className={styles.group} data-category-id={id} id={`settings-${id}`} ref={register(id)}>
      <h2>{label}</h2>
      <div className={styles.panel}>{children}</div>
    </section>
  );
}

function NavigationRow({
  description,
  icon,
  label,
  onClick
}: {
  description: string;
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button className={`${styles.settingRow} ${styles.navigationRow}`} onClick={onClick} type="button">
      <span className={styles.rowIcon} aria-hidden="true">{icon}</span>
      <span className={styles.rowCopy}>
        <strong>{label}</strong>
        <span>{description}</span>
      </span>
      <ChevronRight aria-hidden="true" size={18} strokeWidth={1.8} />
    </button>
  );
}

function ConnectionRow({
  description,
  icon,
  isLoading,
  label,
  onRefresh,
  status,
  tone
}: {
  description: string;
  icon: ReactNode;
  isLoading: boolean;
  label: string;
  onRefresh: () => void;
  status: string;
  tone: "quiet" | "success" | "warning";
}) {
  return (
    <div className={styles.settingRow}>
      <span className={styles.rowIcon} aria-hidden="true">{icon}</span>
      <span className={styles.rowCopy}>
        <strong>{label}</strong>
        <span>{description}</span>
      </span>
      <span className={styles.connectionActions}>
        <span className={styles.status} data-tone={tone}><span aria-hidden="true" />{status}</span>
        <button
          aria-label={`Refresh ${label} status`}
          className={`${styles.rowIconButton} ${styles.refreshButton}${isLoading ? ` ${styles.refreshing}` : ""}`}
          disabled={isLoading}
          onClick={onRefresh}
          type="button"
        >
          <RefreshCw aria-hidden="true" size={20} strokeWidth={1.8} />
        </button>
      </span>
    </div>
  );
}

function ValueRow({ description, label, value }: { description: string; label: string; value: string }) {
  return (
    <div className={styles.settingRow}>
      <span className={styles.rowCopy}>
        <strong>{label}</strong>
        <span>{description}</span>
      </span>
      <span className={styles.value}>{value}</span>
    </div>
  );
}

type ConnectionStatus = Pick<NormalizedHermesStatus, "baseUrl" | "configured" | "mode" | "reachable">;

function connectionLabel(status: ConnectionStatus | null, isLoading: boolean) {
  if (isLoading && !status) return "Checking";
  if (status?.mode === "real" && status.reachable) return "Connected";
  if (!status || !status.configured || status.mode === "unconfigured") return "Not configured";
  return "Unavailable";
}

function connectionTone(status: ConnectionStatus | null): "quiet" | "success" | "warning" {
  if (status?.mode === "real" && status.reachable) return "success";
  if (status?.configured) return "warning";
  return "quiet";
}

function connectionDescription(status: ConnectionStatus | null, fallback: string) {
  return status?.baseUrl ? `${fallback} at ${status.baseUrl}` : fallback;
}
