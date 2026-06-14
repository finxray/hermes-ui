"use client";

import { AgentActivityBlock } from "@/components/chat/AgentActivityBlock";
import { ContextRail } from "@/components/shell/ContextRail";
import {
  LARGE_ACTIVITY_EVENT_COUNT,
  LARGE_ARTIFACTS_COUNT,
  LARGE_LEGACY_TOOL_EVENT_COUNT,
  largeActivityEvents,
  largeArtifactsToolsProject,
  largeArtifactsToolsSession
} from "@/data/largeArtifactsToolsFixture";
import type { HermesSessionModelSync } from "@/hooks/useHermesSessionModel";
import styles from "./page.module.css";

const noop = () => undefined;
const asyncNoop = async () => undefined;
const fixtureSessionModel: HermesSessionModelSync = {
  checkedAt: null,
  effectiveModel: null,
  effectiveProvider: null,
  error: null,
  hermesSessionId: largeArtifactsToolsSession.hermesSessionId,
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
  sessionId: largeArtifactsToolsSession.id,
  syncStatus: "fallback"
};

export default function ArtifactsToolsLargeFixturePage() {
  return (
    <main className={styles.page} aria-label="Large artifacts and tools measurement fixture">
      <section className={styles.fixtureHeader} aria-labelledby="artifacts-tools-large-fixture-title">
        <p>Measurement fixture</p>
        <h1 id="artifacts-tools-large-fixture-title">Large artifacts and tools fixture</h1>
        <div className={styles.metrics} aria-label="Large artifacts and tools scale metrics">
          <span>{LARGE_ARTIFACTS_COUNT} artifacts</span>
          <span>{LARGE_LEGACY_TOOL_EVENT_COUNT} legacy tool rows</span>
          <span>{LARGE_ACTIVITY_EVENT_COUNT} activity events</span>
        </div>
      </section>

      <section className={styles.shell} aria-label="Large artifacts tools Studio shell fixture">
        <section className={styles.activityPanel} aria-label="Large activity block measurement panel">
          <div className={styles.panelIntro}>
            <p>Static local fixture</p>
            <h2>Agent activity detail collapse baseline</h2>
            <span>
              Representative command, memory, tool, error, and status events are rendered with the production
              activity block component.
            </span>
          </div>
          <AgentActivityBlock events={largeActivityEvents} />
        </section>

        <ContextRail
          activeProject={largeArtifactsToolsProject}
          activeSession={largeArtifactsToolsSession}
          activityEvents={largeActivityEvents}
          allSessions={[largeArtifactsToolsSession]}
          brainMemoryStatus={null}
          hermesSessions={[]}
          hermesStatus={null}
          hermesSessionModel={fixtureSessionModel}
          isBrainMemoryStatusLoading={false}
          isHermesSessionsLoading={false}
          isHermesStatusLoading={false}
          refreshBrainMemoryStatus={noop}
          refreshHermesStatus={noop}
          refreshHermesSessions={noop}
          tenantScopePosture={null}
          workspaceActions={{} as never}
        />
      </section>
    </main>
  );
}
