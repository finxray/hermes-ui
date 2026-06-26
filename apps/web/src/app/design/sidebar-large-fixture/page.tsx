"use client";

import { useMemo, useState } from "react";
import { Sidebar } from "@/components/shell/Sidebar";
import { SectionNavProvider } from "@/components/shell/SectionNavContext";
import {
  LARGE_SIDEBAR_PROJECT_COUNT,
  LARGE_SIDEBAR_SESSION_COUNT,
  LARGE_SIDEBAR_SESSIONS_PER_PROJECT,
  largeSidebarActiveSession,
  largeSidebarProjects,
  largeSidebarSessions,
  largeSidebarWorkspaceState
} from "@/data/largeSidebarFixture";
import styles from "./page.module.css";

const noop = () => undefined;

export default function SidebarLargeFixturePage() {
  const [activeSessionId, setActiveSessionId] = useState(largeSidebarActiveSession.id);
  const activeSession =
    largeSidebarSessions.find((session) => session.id === activeSessionId) ?? largeSidebarActiveSession;
  const activeProject =
    largeSidebarProjects.find((project) => project.id === activeSession.projectId) ?? largeSidebarProjects[0];

  const fixtureActions = useMemo(
    () => ({
      appendMessage: noop,
      appendRunRecord: noop,
      appendToolEvent: noop,
      archiveSession: noop,
      createProject: noop,
      createSession: noop,
      createSessionForProject: noop,
      renameProject: noop,
      renameSession: noop,
      reset: noop,
      switchProject: noop,
      switchSession: setActiveSessionId,
      updateMessage: noop,
      updateRunRecord: noop
    }),
    []
  );

  return (
    <main className={styles.page} aria-label="Large sidebar measurement fixture">
      <section className={styles.fixtureHeader} aria-labelledby="sidebar-large-fixture-title">
        <p>Measurement fixture</p>
        <h1 id="sidebar-large-fixture-title">Large sidebar measurement fixture</h1>
        <div className={styles.metrics} aria-label="Large sidebar scale metrics">
          <span>{LARGE_SIDEBAR_PROJECT_COUNT} projects</span>
          <span>{LARGE_SIDEBAR_SESSION_COUNT} sessions</span>
          <span>{LARGE_SIDEBAR_SESSIONS_PER_PROJECT} sessions per project</span>
        </div>
      </section>

      <section className={styles.shell} aria-label="Large sidebar Studio shell fixture">
        <SectionNavProvider>
          <Sidebar
            actions={fixtureActions as never}
            activeSection="workspace"
            activeProject={activeProject}
            activeSession={activeSession}
            allSessions={largeSidebarSessions}
            connectionStatus={largeSidebarWorkspaceState.connectionStatus}
            hermesStatus={null}
            isHermesStatusLoading={false}
            isHydrated
            onSectionChange={noop}
            projects={largeSidebarProjects}
            refreshHermesStatus={noop}
          />
        </SectionNavProvider>
        <section className={styles.panel} aria-label="Large sidebar measurement panel">
          <div className={styles.panelBody}>
            <p>Static local fixture</p>
            <h2>{activeSession.title}</h2>
            <dl className={styles.detailGrid}>
              <div>
                <dt>Active project</dt>
                <dd>{activeProject.name}</dd>
              </div>
              <div>
                <dt>Total sessions</dt>
                <dd>{LARGE_SIDEBAR_SESSION_COUNT}</dd>
              </div>
              <div>
                <dt>Selected session</dt>
                <dd>{activeSession.id}</dd>
              </div>
            </dl>
          </div>
        </section>
      </section>
    </main>
  );
}
