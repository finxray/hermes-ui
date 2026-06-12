"use client";

import { Brain } from "lucide-react";
import { ChatTranscript } from "@/components/chat/ChatTranscript";
import { ContextRail } from "@/components/shell/ContextRail";
import { Sidebar } from "@/components/shell/Sidebar";
import {
  LONG_SESSION_ACTIVITY_EVENT_COUNT,
  LONG_SESSION_MESSAGE_COUNT,
  LONG_SESSION_PROJECT_COUNT,
  LONG_SESSION_RUN_RECORD_COUNT,
  LONG_SESSION_SESSIONS_PER_PROJECT,
  longSessionActiveProject,
  longSessionActiveSession,
  longSessionActivityEvents,
  longSessionProjects,
  longSessionSessions,
  longSessionWorkspaceState
} from "@/data/longSessionFixture";
import type { HermesSessionModelSync } from "@/hooks/useHermesSessionModel";
import styles from "./page.module.css";

const noop = () => undefined;
const asyncNoop = async () => undefined;
const fixtureActions = {
  appendMessage: noop,
  appendRunRecord: noop,
  appendToolEvent: noop,
  archiveSession: noop,
  createProject: noop,
  createSession: noop,
  renameProject: noop,
  renameSession: noop,
  reset: noop,
  switchProject: noop,
  switchSession: noop,
  updateMessage: noop,
  updateRunRecord: noop
};
const fixtureSessionModel: HermesSessionModelSync = {
  checkedAt: null,
  effectiveModel: null,
  effectiveProvider: null,
  error: null,
  hermesSessionId: longSessionActiveSession.hermesSessionId,
  modelLabel: "Hermes fixture model",
  modelRequest: null,
  modelSelectInProgress: false,
  modelState: {
    availableModels: [],
    clientSelectable: false,
    currentModelLabel: "Hermes fixture model",
    currentProviderLabel: "Fixture provider",
    explicitOverrideSupported: false,
    fastStreamProfile: "unknown",
    listAvailable: false,
    reason: "Static fixture only.",
    selectedModelId: null,
    selectionStatus: "deferred",
    serverAdvertisedModel: null,
    serverConfiguredOnly: true,
    sessionModelOverrideCapable: false,
    uiState: "deferred"
  },
  providerLabel: "Fixture provider",
  refresh: asyncNoop,
  selectModel: asyncNoop,
  sessionId: longSessionActiveSession.id,
  syncStatus: "fallback"
};

export default function LongSessionFixturePage() {
  return (
    <main className={styles.page} aria-label="Long-session performance fixture">
      <section className={styles.fixtureHeader} aria-labelledby="long-session-fixture-title">
        <p>Measurement fixture</p>
        <h1 id="long-session-fixture-title">Long-session performance fixture</h1>
        <div className={styles.metrics} aria-label="Fixture scale metrics">
          <span>{LONG_SESSION_MESSAGE_COUNT} messages</span>
          <span>{LONG_SESSION_PROJECT_COUNT * LONG_SESSION_SESSIONS_PER_PROJECT} sidebar sessions</span>
          <span>{LONG_SESSION_ACTIVITY_EVENT_COUNT} activity events</span>
          <span>{LONG_SESSION_RUN_RECORD_COUNT} run records</span>
        </div>
      </section>

      <section className={styles.shell} aria-label="Long-session Studio shell fixture">
        <Sidebar
          actions={fixtureActions as never}
          activeProject={longSessionActiveProject}
          activeSession={longSessionActiveSession}
          allSessions={longSessionSessions}
          connectionStatus={longSessionWorkspaceState.connectionStatus}
          hermesStatus={null}
          isHermesStatusLoading={false}
          isHydrated
          projects={longSessionProjects}
          refreshHermesStatus={noop}
          hermesSessions={[]}
          isHermesSessionsLoading={false}
          refreshHermesSessions={noop}
        />
        <section className={styles.transcriptWrap} aria-label="Chat transcript">
          <ChatTranscript
            activeProject={longSessionActiveProject}
            activeSession={longSessionActiveSession}
            activityEvents={longSessionActivityEvents}
            bannerIcon={<Brain size={16} />}
            createSession={noop}
          />
        </section>
        <ContextRail
          activeProject={longSessionActiveProject}
          activeSession={longSessionActiveSession}
          activityEvents={longSessionActivityEvents}
          brainMemoryStatus={null}
          hermesStatus={null}
          hermesSessionModel={fixtureSessionModel}
          isBrainMemoryStatusLoading={false}
          isHermesStatusLoading={false}
          refreshBrainMemoryStatus={noop}
          refreshHermesStatus={noop}
          tenantScopePosture={null}
        />
      </section>
    </main>
  );
}
