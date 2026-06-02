"use client";

import { Brain, Route, ShieldCheck } from "lucide-react";
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
import styles from "./page.module.css";

const noop = () => undefined;
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
        <section className={styles.transcriptWrap} aria-label="Long-session transcript fixture">
          <ChatTranscript
            activeProject={longSessionActiveProject}
            activeSession={longSessionActiveSession}
            activityEvents={longSessionActivityEvents}
            bannerIcon={<Brain size={16} />}
            createSession={noop}
            isThinking={false}
            routeIcon={<Route size={13} />}
            scopeIcon={<ShieldCheck size={13} />}
          />
        </section>
        <ContextRail
          activeProject={longSessionActiveProject}
          activeSession={longSessionActiveSession}
          activityEvents={longSessionActivityEvents}
          brainMemoryStatus={null}
          hermesStatus={null}
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
