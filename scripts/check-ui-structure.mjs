import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const requiredFiles = [
  "apps/web/src/components/shell/AppShell.tsx",
  "apps/web/src/components/shell/AppShell.module.css",
  "apps/web/src/components/shell/SidebarRow.tsx",
  "apps/web/src/components/shell/SidebarRow.module.css",
  "apps/web/src/components/chat/Composer.module.css",
  "apps/web/src/components/chat/AgentActivityBlock.tsx",
  "apps/web/src/components/chat/AgentActivityBlock.module.css",
  "apps/web/src/components/chat/MessageMarkdown.tsx",
  "apps/web/src/components/chat/MessageMarkdown.module.css",
  "apps/web/src/components/chat/MessageBubble.module.css",
  "apps/web/src/data/markdownFixture.ts",
  "apps/web/src/app/design/markdown-fixture/page.tsx",
  "apps/web/src/app/design/markdown-fixture/page.module.css",
  "apps/web/src/data/longMarkdownFixture.ts",
  "apps/web/src/app/design/markdown-long-fixture/page.tsx",
  "apps/web/src/app/design/markdown-long-fixture/page.module.css",
  "apps/web/src/data/memoryDetailFixture.ts",
  "apps/web/src/app/design/memory-detail-fixture/page.tsx",
  "apps/web/src/app/design/memory-detail-fixture/page.module.css",
  "apps/web/src/data/longSessionFixture.ts",
  "apps/web/src/app/design/long-session-fixture/page.tsx",
  "apps/web/src/app/design/long-session-fixture/page.module.css",
  "apps/web/src/data/largeSidebarFixture.ts",
  "apps/web/src/app/design/sidebar-large-fixture/page.tsx",
  "apps/web/src/app/design/sidebar-large-fixture/page.module.css",
  "apps/web/src/data/largeArtifactsToolsFixture.ts",
  "apps/web/src/app/design/artifacts-tools-large-fixture/page.tsx",
  "apps/web/src/app/design/artifacts-tools-large-fixture/page.module.css",
  "apps/web/src/app/api/hermes/runs/approval-probe/route.ts",
  "apps/web/src/app/api/hermes/runs/experimental-chat/route.ts",
  "apps/web/src/app/api/hermes/runs/chat/stream/route.ts",
  "apps/web/src/app/api/hermes/chat/stream/route.ts",
  "apps/web/src/types/hermesRunsBffRequest.ts",
  "apps/web/src/types/hermesRunsBffEvents.ts",
  "apps/web/src/data/agentAccessPolicyFixtures.ts",
  "apps/web/src/data/hermesRunsBffLifecycleFixtures.ts",
  "apps/web/src/data/hermesRunsDisabledRouteResponseFixtures.ts",
  "apps/web/src/data/hermesRunsBffRequestFixtures.ts",
  "apps/web/src/data/hermesRunsBffEventFixtures.ts",
  "apps/web/src/lib/hermesRunsBffLifecycleDryRun.ts",
  "apps/web/src/lib/hermesRunsDisabledRouteResponseValidation.ts",
  "apps/web/src/lib/hermesRunsBffRequestValidation.ts",
  "apps/web/src/lib/hermesRunsBffEventReducer.ts",
  "apps/web/src/lib/hermesRunsReplayPreview.ts",
  "scripts/check-hermes-runs-bff-request.mjs",
  "scripts/check-agent-access-policy.mjs",
  "scripts/check-hermes-runs-lifecycle-dry-run.mjs",
  "scripts/check-hermes-runs-bff-events.mjs",
  "scripts/hermes-runs-production-route-guard.mjs",
  "scripts/hermes-runs-replay-ui-smoke.mjs",
  "apps/web/src/app/api/hermes/runs/memory-probe/route.ts",
  "apps/web/src/app/api/hermes/runs/probe/route.ts",
  "apps/web/src/app/api/hermes/runs/stop-probe/route.ts",
  "docs/checkpoints/HERMES_RUNS_APPROVAL_PROBE_16F.md",
  "docs/checkpoints/HERMES_RUNS_BRAIN_MEMORY_PARITY_16D.md",
  "docs/checkpoints/HERMES_RUNS_DEFAULT_DECISION_16H.md",
  "docs/checkpoints/HERMES_RUNS_BRAIN_MEMORY_ENV_HARDENING_16I.md",
  "docs/checkpoints/HERMES_RUNS_RUNRECORD_REPLAY_PROTOTYPE_16K.md",
  "docs/checkpoints/HERMES_RUNS_REPLAY_UI_HYDRATION_16L.md",
  "docs/architecture/HERMES_RUNS_EXECUTION_STATE_MACHINE_16M.md",
  "docs/architecture/HERMES_RUNS_BFF_EVENT_CONTRACT_16N.md",
  "docs/checkpoints/HERMES_RUNS_BFF_EVENT_FIXTURES_16O.md",
  "docs/checkpoints/HERMES_RUNS_DISABLED_ROUTE_GUARD_16P.md",
  "docs/checkpoints/HERMES_RUNS_REQUEST_VALIDATION_16Q.md",
  "docs/checkpoints/HERMES_RUNS_DISABLED_ROUTE_VALIDATION_AND_AGENT_ACCESS_16R.md",
  "docs/checkpoints/AGENT_ACCESS_POLICY_MATRIX_16S.md",
  "docs/checkpoints/HERMES_RUNS_BFF_LIFECYCLE_DRY_RUN_16T.md",
  "docs/architecture/HERMES_RUNS_PRODUCTION_MIGRATION_GATE_16U.md",
  "docs/architecture/AGENT_ACCESS_APPROVAL_POLICY_16R.md",
  "docs/architecture/HERMES_RUNS_REPLAY_RECONCILIATION_16J.md",
  "docs/checkpoints/HERMES_RUNS_EVENT_NORMALIZATION_16C.md",
  "docs/checkpoints/HERMES_RUNS_EXPERIMENTAL_MODE_16G.md",
  "docs/checkpoints/HERMES_RUNS_STOP_EXPERIMENT_16E.md",
  "apps/web/src/components/memory/BrainMemoryConsole.module.css"
];

const failures = [];

for (const file of requiredFiles) {
  if (!existsSync(join(root, file))) {
    failures.push(`Missing required UI structure file: ${file}`);
  }
}

const globals = readFileSync(join(root, "apps/web/src/app/globals.css"), "utf8");
const bannedGlobalSelectors = [
  ".app-shell",
  ".row-with-actions",
  ".composer-box",
  ".context-panel",
  ".summary-card",
  ".memory-card",
  ".message-card"
];

for (const selector of bannedGlobalSelectors) {
  if (globals.includes(selector)) {
    failures.push(`globals.css still contains component selector: ${selector}`);
  }
}

const appShell = readFileSync(join(root, "apps/web/src/components/shell/AppShell.tsx"), "utf8");
for (const token of [
  "data-left-collapsed",
  "data-right-collapsed",
  "studio-left-rail-toggle",
  "studio-right-rail-toggle",
  "const [leftCollapsed, setLeftCollapsed]",
  "const [rightCollapsed, setRightCollapsed]",
  "setLeftCollapsed(event.currentTarget.checked)",
  "setRightCollapsed(event.currentTarget.checked)"
]) {
  if (!appShell.includes(token)) {
    failures.push(`AppShell is missing ${token}`);
  }
}

const topBar = readFileSync(join(root, "apps/web/src/components/shell/TopBar.tsx"), "utf8");
for (const token of [
  "leftToggleId",
  "rightToggleId",
  "activateToggle(leftToggleId)",
  "activateToggle(rightToggleId)",
  "aria-pressed={!leftCollapsed}",
  "aria-pressed={!rightCollapsed}",
  "title={leftCollapsed ?",
  "title={rightCollapsed ?"
]) {
  if (!topBar.includes(token)) {
    failures.push(`TopBar panel toggle contract is missing ${token}`);
  }
}

const appShellCss = readFileSync(join(root, "apps/web/src/components/shell/AppShell.module.css"), "utf8");
for (const token of [
  '.shell[data-left-collapsed="true"]',
  '.shell[data-right-collapsed="true"]',
  ".shell:has(.leftToggle:checked)",
  ".shell:has(.rightToggle:checked)",
  "transition: grid-template-columns 500ms",
  ':global([data-shell-rail="left"])',
  ':global([data-shell-rail="right"])'
]) {
  if (!appShellCss.includes(token)) {
    failures.push(`AppShell CSS panel toggle contract is missing ${token}`);
  }
}

const chatViewVisualCss = readFileSync(join(root, "apps/web/src/components/chat/ChatView.module.css"), "utf8");
const chatViewVisualSource = readFileSync(join(root, "apps/web/src/components/chat/ChatView.tsx"), "utf8");
const chatTranscriptVisualSource = readFileSync(join(root, "apps/web/src/components/chat/ChatTranscript.tsx"), "utf8");
const composerVisualSource = readFileSync(join(root, "apps/web/src/components/chat/Composer.tsx"), "utf8");
const composerVisualCss = readFileSync(join(root, "apps/web/src/components/chat/Composer.module.css"), "utf8");
const contextRailVisualCss = readFileSync(join(root, "apps/web/src/components/shell/ContextRail.module.css"), "utf8");

for (const token of [
  "data-start-state",
  "startStage",
  "isStartState",
  "showContextPanel"
]) {
  if (!chatViewVisualSource.includes(token)) {
    failures.push(`ChatView new-chat visual contract is missing ${token}`);
  }
}

for (const token of [
  "What should Hermes work on?",
  "Hermes is reached through the BFF",
  "data-start-state"
]) {
  if (!chatTranscriptVisualSource.includes(token)) {
    failures.push(`ChatTranscript empty-start contract is missing ${token}`);
  }
}

for (const token of [
  "contextItems",
  "contextPanel",
  "data-visible",
  "Browser -> BFF -> Hermes"
]) {
  if (!composerVisualSource.includes(token) && !chatViewVisualSource.includes(token)) {
    failures.push(`Composer context-panel source contract is missing ${token}`);
  }
}

for (const token of [
  "radial-gradient(circle at 54% 8%",
  ".startStage",
  ".startHero",
  "color: var(--warning)"
]) {
  if (!chatViewVisualCss.includes(token)) {
    failures.push(`ChatView visual CSS contract is missing ${token}`);
  }
}

for (const token of [
  "var(--bg-glass-strong)",
  "backdrop-filter: blur(24px)",
  ".contextPanel[data-visible=\"true\"]",
  "@media (prefers-reduced-motion: reduce)"
]) {
  if (!composerVisualCss.includes(token)) {
    failures.push(`Composer glass/context CSS contract is missing ${token}`);
  }
}

for (const token of [
  "display: inline-flex",
  "align-items: center",
  "line-height: 1"
]) {
  if (!contextRailVisualCss.includes(token)) {
    failures.push(`Context rail tab alignment CSS is missing ${token}`);
  }
}

const memoryDetailPanel = readFileSync(
  join(root, "apps/web/src/components/memory/MemoryDetailPanel.tsx"),
  "utf8"
);
const memoryDetailFixture = readFileSync(join(root, "apps/web/src/data/memoryDetailFixture.ts"), "utf8");
const memoryDetailFixturePage = readFileSync(
  join(root, "apps/web/src/app/design/memory-detail-fixture/page.tsx"),
  "utf8"
);
const memoryDetailSmoke = readFileSync(join(root, "scripts/memory-detail-fixture-smoke.mjs"), "utf8");
const contextRail = readFileSync(join(root, "apps/web/src/components/shell/ContextRail.tsx"), "utf8");
const longSessionFixture = readFileSync(join(root, "apps/web/src/data/longSessionFixture.ts"), "utf8");
const longSessionFixturePage = readFileSync(
  join(root, "apps/web/src/app/design/long-session-fixture/page.tsx"),
  "utf8"
);
const largeSidebarFixture = readFileSync(join(root, "apps/web/src/data/largeSidebarFixture.ts"), "utf8");
const largeSidebarFixturePage = readFileSync(
  join(root, "apps/web/src/app/design/sidebar-large-fixture/page.tsx"),
  "utf8"
);
const largeSidebarSmoke = readFileSync(join(root, "scripts/sidebar-large-smoke.mjs"), "utf8");
const largeArtifactsToolsFixture = readFileSync(
  join(root, "apps/web/src/data/largeArtifactsToolsFixture.ts"),
  "utf8"
);
const largeArtifactsToolsFixturePage = readFileSync(
  join(root, "apps/web/src/app/design/artifacts-tools-large-fixture/page.tsx"),
  "utf8"
);
const largeArtifactsToolsSmoke = readFileSync(
  join(root, "scripts/artifacts-tools-large-smoke.mjs"),
  "utf8"
);
const longSessionSmoke = readFileSync(join(root, "scripts/long-session-performance-smoke.mjs"), "utf8");
const longSessionPlan = readFileSync(
  join(root, "docs/performance/LONG_SESSION_PERFORMANCE_PLAN_15N.md"),
  "utf8"
);
const longSessionMeasurement = readFileSync(
  join(root, "docs/performance/LONG_SESSION_MEASUREMENT_15O.md"),
  "utf8"
);
const lazyExportPreviewMeasurement = readFileSync(
  join(root, "docs/performance/LAZY_EXPORT_PREVIEW_15P.md"),
  "utf8"
);
const largeSidebarMeasurement = readFileSync(
  join(root, "docs/performance/SIDEBAR_LARGE_MEASUREMENT_15Q.md"),
  "utf8"
);
const largeArtifactsToolsMeasurement = readFileSync(
  join(root, "docs/performance/ARTIFACTS_TOOLS_LARGE_MEASUREMENT_15R.md"),
  "utf8"
);
const scalableLoadingDecision = readFileSync(
  join(root, "docs/performance/SCALABLE_LOADING_DECISION_15S.md"),
  "utf8"
);
const hermesRunsMigrationAssessment = readFileSync(
  join(root, "docs/architecture/HERMES_RUNS_MIGRATION_ASSESSMENT_16A.md"),
  "utf8"
);
const hermesRunsProbeCheckpoint = existsSync(
  join(root, "docs/checkpoints/HERMES_RUNS_PROBE_16B.md")
)
  ? readFileSync(join(root, "docs/checkpoints/HERMES_RUNS_PROBE_16B.md"), "utf8")
  : "";
const hermesRunsEventNormalizationCheckpoint = existsSync(
  join(root, "docs/checkpoints/HERMES_RUNS_EVENT_NORMALIZATION_16C.md")
)
  ? readFileSync(join(root, "docs/checkpoints/HERMES_RUNS_EVENT_NORMALIZATION_16C.md"), "utf8")
  : "";
const hermesRunsBrainMemoryParityCheckpoint = existsSync(
  join(root, "docs/checkpoints/HERMES_RUNS_BRAIN_MEMORY_PARITY_16D.md")
)
  ? readFileSync(join(root, "docs/checkpoints/HERMES_RUNS_BRAIN_MEMORY_PARITY_16D.md"), "utf8")
  : "";
const hermesRunsApprovalProbeCheckpoint = existsSync(
  join(root, "docs/checkpoints/HERMES_RUNS_APPROVAL_PROBE_16F.md")
)
  ? readFileSync(join(root, "docs/checkpoints/HERMES_RUNS_APPROVAL_PROBE_16F.md"), "utf8")
  : "";
const hermesRunsStopExperimentCheckpoint = existsSync(
  join(root, "docs/checkpoints/HERMES_RUNS_STOP_EXPERIMENT_16E.md")
)
  ? readFileSync(join(root, "docs/checkpoints/HERMES_RUNS_STOP_EXPERIMENT_16E.md"), "utf8")
  : "";
const hermesRunsExperimentalModeCheckpoint = existsSync(
  join(root, "docs/checkpoints/HERMES_RUNS_EXPERIMENTAL_MODE_16G.md")
)
  ? readFileSync(join(root, "docs/checkpoints/HERMES_RUNS_EXPERIMENTAL_MODE_16G.md"), "utf8")
  : "";
const hermesRunsDefaultDecisionCheckpoint = existsSync(
  join(root, "docs/checkpoints/HERMES_RUNS_DEFAULT_DECISION_16H.md")
)
  ? readFileSync(join(root, "docs/checkpoints/HERMES_RUNS_DEFAULT_DECISION_16H.md"), "utf8")
  : "";
const hermesRunsBrainMemoryEnvCheckpoint = existsSync(
  join(root, "docs/checkpoints/HERMES_RUNS_BRAIN_MEMORY_ENV_HARDENING_16I.md")
)
  ? readFileSync(join(root, "docs/checkpoints/HERMES_RUNS_BRAIN_MEMORY_ENV_HARDENING_16I.md"), "utf8")
  : "";
const hermesRunsReplayReconciliation = existsSync(
  join(root, "docs/architecture/HERMES_RUNS_REPLAY_RECONCILIATION_16J.md")
)
  ? readFileSync(join(root, "docs/architecture/HERMES_RUNS_REPLAY_RECONCILIATION_16J.md"), "utf8")
  : "";
const hermesRunsRunRecordReplayCheckpoint = existsSync(
  join(root, "docs/checkpoints/HERMES_RUNS_RUNRECORD_REPLAY_PROTOTYPE_16K.md")
)
  ? readFileSync(join(root, "docs/checkpoints/HERMES_RUNS_RUNRECORD_REPLAY_PROTOTYPE_16K.md"), "utf8")
  : "";
const hermesRunsReplayUiHydrationCheckpoint = existsSync(
  join(root, "docs/checkpoints/HERMES_RUNS_REPLAY_UI_HYDRATION_16L.md")
)
  ? readFileSync(join(root, "docs/checkpoints/HERMES_RUNS_REPLAY_UI_HYDRATION_16L.md"), "utf8")
  : "";
const hermesRunsExecutionStateMachine = existsSync(
  join(root, "docs/architecture/HERMES_RUNS_EXECUTION_STATE_MACHINE_16M.md")
)
  ? readFileSync(join(root, "docs/architecture/HERMES_RUNS_EXECUTION_STATE_MACHINE_16M.md"), "utf8")
  : "";
const hermesRunsBffEventContract = existsSync(
  join(root, "docs/architecture/HERMES_RUNS_BFF_EVENT_CONTRACT_16N.md")
)
  ? readFileSync(join(root, "docs/architecture/HERMES_RUNS_BFF_EVENT_CONTRACT_16N.md"), "utf8")
  : "";
const hermesRunsBffEventFixturesCheckpoint = existsSync(
  join(root, "docs/checkpoints/HERMES_RUNS_BFF_EVENT_FIXTURES_16O.md")
)
  ? readFileSync(join(root, "docs/checkpoints/HERMES_RUNS_BFF_EVENT_FIXTURES_16O.md"), "utf8")
  : "";
const hermesRunsDisabledRouteCheckpoint = existsSync(
  join(root, "docs/checkpoints/HERMES_RUNS_DISABLED_ROUTE_GUARD_16P.md")
)
  ? readFileSync(join(root, "docs/checkpoints/HERMES_RUNS_DISABLED_ROUTE_GUARD_16P.md"), "utf8")
  : "";
const hermesRunsRequestValidationCheckpoint = existsSync(
  join(root, "docs/checkpoints/HERMES_RUNS_REQUEST_VALIDATION_16Q.md")
)
  ? readFileSync(join(root, "docs/checkpoints/HERMES_RUNS_REQUEST_VALIDATION_16Q.md"), "utf8")
  : "";
const hermesRunsDisabledRouteValidationCheckpoint = existsSync(
  join(root, "docs/checkpoints/HERMES_RUNS_DISABLED_ROUTE_VALIDATION_AND_AGENT_ACCESS_16R.md")
)
  ? readFileSync(join(root, "docs/checkpoints/HERMES_RUNS_DISABLED_ROUTE_VALIDATION_AND_AGENT_ACCESS_16R.md"), "utf8")
  : "";
const agentAccessApprovalPolicy = existsSync(
  join(root, "docs/architecture/AGENT_ACCESS_APPROVAL_POLICY_16R.md")
)
  ? readFileSync(join(root, "docs/architecture/AGENT_ACCESS_APPROVAL_POLICY_16R.md"), "utf8")
  : "";
const agentAccessPolicyMatrixCheckpoint = existsSync(
  join(root, "docs/checkpoints/AGENT_ACCESS_POLICY_MATRIX_16S.md")
)
  ? readFileSync(join(root, "docs/checkpoints/AGENT_ACCESS_POLICY_MATRIX_16S.md"), "utf8")
  : "";
const hermesRunsLifecycleDryRunCheckpoint = existsSync(
  join(root, "docs/checkpoints/HERMES_RUNS_BFF_LIFECYCLE_DRY_RUN_16T.md")
)
  ? readFileSync(join(root, "docs/checkpoints/HERMES_RUNS_BFF_LIFECYCLE_DRY_RUN_16T.md"), "utf8")
  : "";
const hermesRunsProductionMigrationGate = existsSync(
  join(root, "docs/architecture/HERMES_RUNS_PRODUCTION_MIGRATION_GATE_16U.md")
)
  ? readFileSync(join(root, "docs/architecture/HERMES_RUNS_PRODUCTION_MIGRATION_GATE_16U.md"), "utf8")
  : "";
const scalableLoadingRoadmap = readFileSync(
  join(root, "docs/product/SCALABLE_UI_LOADING_ROADMAP.md"),
  "utf8"
);
const packageJson = readFileSync(join(root, "package.json"), "utf8");
const hermesRunsProbeRoute = readFileSync(
  join(root, "apps/web/src/app/api/hermes/runs/probe/route.ts"),
  "utf8"
);
const hermesRunsApprovalProbeRoute = readFileSync(
  join(root, "apps/web/src/app/api/hermes/runs/approval-probe/route.ts"),
  "utf8"
);
const hermesRunsMemoryProbeRoute = readFileSync(
  join(root, "apps/web/src/app/api/hermes/runs/memory-probe/route.ts"),
  "utf8"
);
const hermesRunsExperimentalChatRoute = readFileSync(
  join(root, "apps/web/src/app/api/hermes/runs/experimental-chat/route.ts"),
  "utf8"
);
const productionHermesChatStreamRoute = readFileSync(
  join(root, "apps/web/src/app/api/hermes/chat/stream/route.ts"),
  "utf8"
);
const hermesRunsDisabledProductionRoute = readFileSync(
  join(root, "apps/web/src/app/api/hermes/runs/chat/stream/route.ts"),
  "utf8"
);
const hermesRunsBffRequestTypesSource = readFileSync(
  join(root, "apps/web/src/types/hermesRunsBffRequest.ts"),
  "utf8"
);
const hermesRunsBffRequestFixturesSource = readFileSync(
  join(root, "apps/web/src/data/hermesRunsBffRequestFixtures.ts"),
  "utf8"
);
const agentAccessPolicyFixturesSource = readFileSync(
  join(root, "apps/web/src/data/agentAccessPolicyFixtures.ts"),
  "utf8"
);
const hermesRunsLifecycleFixturesSource = readFileSync(
  join(root, "apps/web/src/data/hermesRunsBffLifecycleFixtures.ts"),
  "utf8"
);
const hermesRunsDisabledRouteResponseFixturesSource = readFileSync(
  join(root, "apps/web/src/data/hermesRunsDisabledRouteResponseFixtures.ts"),
  "utf8"
);
const hermesRunsBffRequestValidationSource = readFileSync(
  join(root, "apps/web/src/lib/hermesRunsBffRequestValidation.ts"),
  "utf8"
);
const hermesRunsLifecycleDryRunSource = readFileSync(
  join(root, "apps/web/src/lib/hermesRunsBffLifecycleDryRun.ts"),
  "utf8"
);
const hermesRunsDisabledRouteResponseValidationSource = readFileSync(
  join(root, "apps/web/src/lib/hermesRunsDisabledRouteResponseValidation.ts"),
  "utf8"
);
const hermesRunsBffEventTypesSource = readFileSync(
  join(root, "apps/web/src/types/hermesRunsBffEvents.ts"),
  "utf8"
);
const hermesRunsBffEventFixturesSource = readFileSync(
  join(root, "apps/web/src/data/hermesRunsBffEventFixtures.ts"),
  "utf8"
);
const hermesRunsBffEventReducerSource = readFileSync(
  join(root, "apps/web/src/lib/hermesRunsBffEventReducer.ts"),
  "utf8"
);
const hermesRunsBffEventCheckScript = readFileSync(
  join(root, "scripts/check-hermes-runs-bff-events.mjs"),
  "utf8"
);
const hermesRunsProductionRouteGuardScript = readFileSync(
  join(root, "scripts/hermes-runs-production-route-guard.mjs"),
  "utf8"
);
const hermesRunsBffRequestCheckScript = readFileSync(
  join(root, "scripts/check-hermes-runs-bff-request.mjs"),
  "utf8"
);
const agentAccessPolicyCheckScript = readFileSync(
  join(root, "scripts/check-agent-access-policy.mjs"),
  "utf8"
);
const hermesRunsLifecycleCheckScript = readFileSync(
  join(root, "scripts/check-hermes-runs-lifecycle-dry-run.mjs"),
  "utf8"
);
const hermesRunsReplayPreviewSource = readFileSync(
  join(root, "apps/web/src/lib/hermesRunsReplayPreview.ts"),
  "utf8"
);
const hermesRunsStopProbeRoute = readFileSync(
  join(root, "apps/web/src/app/api/hermes/runs/stop-probe/route.ts"),
  "utf8"
);
const hermesRunsProbeScript = existsSync(join(root, "scripts/hermes-runs-probe.mjs"))
  ? readFileSync(join(root, "scripts/hermes-runs-probe.mjs"), "utf8")
  : "";
const hermesRunsApprovalProbeScript = existsSync(join(root, "scripts/hermes-runs-approval-probe.mjs"))
  ? readFileSync(join(root, "scripts/hermes-runs-approval-probe.mjs"), "utf8")
  : "";
const hermesRunsExperimentalChatScript = existsSync(join(root, "scripts/hermes-runs-experimental-chat.mjs"))
  ? readFileSync(join(root, "scripts/hermes-runs-experimental-chat.mjs"), "utf8")
  : "";
const hermesRunsReplayUiSmokeScript = existsSync(join(root, "scripts/hermes-runs-replay-ui-smoke.mjs"))
  ? readFileSync(join(root, "scripts/hermes-runs-replay-ui-smoke.mjs"), "utf8")
  : "";
const hermesRunsMemoryProbeScript = existsSync(join(root, "scripts/hermes-runs-memory-probe.mjs"))
  ? readFileSync(join(root, "scripts/hermes-runs-memory-probe.mjs"), "utf8")
  : "";
const hermesRunsStopProbeScript = existsSync(join(root, "scripts/hermes-runs-stop-probe.mjs"))
  ? readFileSync(join(root, "scripts/hermes-runs-stop-probe.mjs"), "utf8")
  : "";
const hermesClientSource = readFileSync(join(root, "packages/hermes-client/src/index.ts"), "utf8");
const agentActivityEventsSource = readFileSync(
  join(root, "apps/web/src/lib/agentActivityEvents.ts"),
  "utf8"
);

for (const token of [
  "Read-only detail",
  "Scoped result",
  "Evidence: not implemented by Gateway yet.",
  "Supersession chain: not implemented by Gateway yet.",
  "Metadata only",
  "Audit metadata"
]) {
  if (!memoryDetailPanel.includes(token)) {
    failures.push(`MemoryDetailPanel is missing honest detail label: ${token}`);
  }
}

for (const token of [
  "fullScopedMemoryDetailFixture",
  "wrongScopeMemoryDetailFixture",
  "status: \"not_implemented\"",
  "memoryDetailSecretSentinels",
  "fixture-api-key-should-not-render",
  "fixture-bearer-should-not-render",
  "fixture-token-should-not-render"
]) {
  if (!memoryDetailFixture.includes(token)) {
    failures.push(`Memory detail fixture data is missing ${token}`);
  }
}

for (const token of [
  "MemoryDetailPanel",
  "fullScopedMemoryDetailFixture",
  "wrongScopeMemoryDetailFixture"
]) {
  if (!memoryDetailFixturePage.includes(token)) {
    failures.push(`Memory detail fixture page is missing ${token}`);
  }
}

for (const token of [
  "fixture-no-mutation-controls",
  "fixture-no-secret-sentinels",
  "fixture-no-service-calls",
  "Evidence: not implemented by Gateway yet.",
  "Supersession chain: not implemented by Gateway yet."
]) {
  if (!memoryDetailSmoke.includes(token)) {
    failures.push(`Memory detail fixture smoke is missing ${token}`);
  }
}

for (const token of [
  "dangerouslySetInnerHTML",
  "Delete memory",
  "Mark stale",
  "Supersede memory",
  "Pin memory",
  "Edit memory"
]) {
  if (memoryDetailPanel.includes(token)) {
    failures.push(`MemoryDetailPanel includes forbidden detail fixture token: ${token}`);
  }
}

if (!packageJson.includes("\"smoke:memory-detail\"")) {
  failures.push("package.json is missing smoke:memory-detail script.");
}

for (const token of [
  "LONG_SESSION_MESSAGE_COUNT = 120",
  "LONG_SESSION_ACTIVITY_EVENT_COUNT = 80",
  "LONG_SESSION_RUN_RECORD_COUNT = 24",
  "longSessionMessages",
  "longSessionActivityEvents",
  "longSessionWorkspaceState"
]) {
  if (!longSessionFixture.includes(token)) {
    failures.push(`Long-session fixture data is missing ${token}`);
  }
}

for (const token of [
  "Long-session performance fixture",
  "Sidebar",
  "ChatTranscript",
  "ContextRail",
  "longSessionActivityEvents",
  "longSessionActiveSession"
]) {
  if (!longSessionFixturePage.includes(token)) {
    failures.push(`Long-session fixture page is missing ${token}`);
  }
}

for (const token of [
  "LARGE_SIDEBAR_PROJECT_COUNT = 25",
  "LARGE_SIDEBAR_SESSIONS_PER_PROJECT = 40",
  "LARGE_SIDEBAR_SESSION_COUNT",
  "largeSidebarProjects",
  "largeSidebarSessions",
  "largeSidebarWorkspaceState"
]) {
  if (!largeSidebarFixture.includes(token)) {
    failures.push(`Large sidebar fixture data is missing ${token}`);
  }
}

for (const token of [
  "Large sidebar measurement fixture",
  "Sidebar",
  "largeSidebarProjects",
  "largeSidebarSessions",
  "setActiveSessionId"
]) {
  if (!largeSidebarFixturePage.includes(token)) {
    failures.push(`Large sidebar fixture page is missing ${token}`);
  }
}

for (const token of [
  "LARGE_ARTIFACTS_COUNT = 500",
  "LARGE_LEGACY_TOOL_EVENT_COUNT = 500",
  "LARGE_ACTIVITY_EVENT_COUNT = 500",
  "largeArtifacts",
  "largeLegacyToolEvents",
  "largeActivityEvents",
  "largeArtifactsToolsSession"
]) {
  if (!largeArtifactsToolsFixture.includes(token)) {
    failures.push(`Large artifacts/tools fixture data is missing ${token}`);
  }
}

for (const token of [
  "Large artifacts and tools fixture",
  "ContextRail",
  "AgentActivityBlock",
  "largeArtifactsToolsProject",
  "largeArtifactsToolsSession",
  "largeActivityEvents"
]) {
  if (!largeArtifactsToolsFixturePage.includes(token)) {
    failures.push(`Large artifacts/tools fixture page is missing ${token}`);
  }
}

for (const token of [
  "fixture-no-service-calls",
  "fixture-export-preview-lazy-before-open",
  "exportPreviewBuiltBeforeOpen",
  "exportPreviewBuildWarnMs",
  "exportPreviewBuildMs",
  "fixture-details-collapsed-by-default",
  "fixture-message-count",
  "fixture-sidebar-session-count",
  "/design/long-session-fixture",
  "routeLoadMs",
  "renderedMessageCount",
  "renderedSidebarRowCount",
  "rightRailTabSwitches",
  "--budget-strict",
  "--verbose"
]) {
  if (!longSessionSmoke.includes(token)) {
    failures.push(`Long-session smoke is missing ${token}`);
  }
}

for (const token of [
  "/design/sidebar-large-fixture",
  "fixture-sidebar-project-count",
  "fixture-sidebar-session-count",
  "fixture-sidebar-scroll-responsive",
  "fixture-active-row-selection",
  "renderedSidebarRowCount",
  "sidebarScroll",
  "activeRowSelectionMs",
  "--budget-strict",
  "--verbose"
]) {
  if (!largeSidebarSmoke.includes(token)) {
    failures.push(`Large sidebar smoke is missing ${token}`);
  }
}

for (const token of [
  "/design/artifacts-tools-large-fixture",
  "fixture-rendered-artifact-count",
  "fixture-rendered-tool-event-count",
  "fixture-rendered-command-count",
  "fixture-details-collapsed-by-default",
  "filesTabSwitchMs",
  "toolsTabSwitchMs",
  "rightRailScroll",
  "renderedArtifactCount",
  "renderedToolEventCount",
  "--budget-strict",
  "--verbose"
]) {
  if (!largeArtifactsToolsSmoke.includes(token)) {
    failures.push(`Large artifacts/tools smoke is missing ${token}`);
  }
}

for (const token of [
  "isExportPreviewOpen",
  "exportPreviewCache",
  "createExportPreviewCacheKey",
  "onToggle",
  "SESSION_EXPORT_EXCLUDED_FIELDS",
  "Preparing local preview"
]) {
  if (!contextRail.includes(token)) {
    failures.push(`ContextRail lazy export preview contract is missing ${token}`);
  }
}

if (contextRail.includes("const runCount = preview.runs.length;")) {
  failures.push("ContextRail still eagerly stringifies export preview JSON during render.");
}

for (const token of [
  "Chat transcript",
  "Sidebar projects/sessions",
  "Export preview",
  "Measurement Targets For Future Slices",
  "does not implement infinite scroll, virtualization, runtime pagination"
]) {
  if (!longSessionPlan.includes(token)) {
    failures.push(`Long-session performance plan is missing ${token}`);
  }
}

for (const token of [
  "Long-Session Measurement Report 15O",
  "Export preview lazy construction",
  "494,133 characters",
  "--json",
  "--budget-strict",
  "Slice 15P"
]) {
  if (!longSessionMeasurement.includes(token)) {
    failures.push(`Long-session measurement report is missing ${token}`);
  }
}

for (const token of [
  "Lazy Export Preview 15P",
  "Before 15P",
  "After 15P",
  "local-only",
  "redaction and bounding",
  "no download",
  "no import",
  "no backend export"
]) {
  if (!lazyExportPreviewMeasurement.includes(token)) {
    failures.push(`Lazy export preview report is missing ${token}`);
  }
}

for (const token of [
  "Sidebar Large Measurement 15Q",
  "25 projects",
  "1,000 sessions",
  "routeLoadMs",
  "active row selection",
  "Show More",
  "virtualization is premature",
  "no runtime Show More",
  "no pagination",
  "no virtualization"
]) {
  if (!largeSidebarMeasurement.includes(token)) {
    failures.push(`Large sidebar measurement report is missing ${token}`);
  }
}

for (const token of [
  "Artifacts Tools Large Measurement 15R",
  "500 artifacts",
  "500 legacy tool-event rows",
  "500 normalized",
  "Files tab switch",
  "Tools tab switch",
  "Lazy collapsed activity JSON details",
  "no runtime Show More",
  "no pagination",
  "no virtualization"
]) {
  if (!largeArtifactsToolsMeasurement.includes(token)) {
    failures.push(`Large artifacts/tools measurement report is missing ${token}`);
  }
}

for (const token of [
  "LONG_SESSION_MEASUREMENT_15O.md",
  "LAZY_EXPORT_PREVIEW_15P.md",
  "SIDEBAR_LARGE_MEASUREMENT_15Q.md",
  "ARTIFACTS_TOOLS_LARGE_MEASUREMENT_15R.md",
  "SCALABLE_LOADING_DECISION_15S.md",
  "lazy construction of export preview JSON",
  "not transcript virtualization",
  "runtime Show More, pagination, infinite scroll, and virtualization deferred"
]) {
  if (!scalableLoadingRoadmap.includes(token)) {
    failures.push(`Scalable UI loading roadmap is missing 15O measurement link token: ${token}`);
  }
}

for (const token of [
  "Scalable Loading Decision 15S",
  "do not implement runtime Show More, pagination, infinite scroll, or",
  "virtualization yet",
  "LONG_SESSION_MEASUREMENT_15O.md",
  "LAZY_EXPORT_PREVIEW_15P.md",
  "SIDEBAR_LARGE_MEASUREMENT_15Q.md",
  "ARTIFACTS_TOOLS_LARGE_MEASUREMENT_15R.md",
  "transcript count above 500 messages becomes slow",
  "sidebar above 2,000 visible rows becomes slow",
  "Files/artifacts above 1,000 rows becomes slow",
  "right rail tab switch exceeds 500 ms",
  "scroll action exceeds 100 ms",
  "page-level horizontal overflow appears",
  "export preview becomes eager again",
  "live users report jank",
  "Context compaction runtime",
  "Cross-channel session pagination",
  "Transcript virtualization",
  "Sidebar Show More",
  "Right rail timeline pagination",
  "Slice 16A: Hermes Runs API migration assessment"
]) {
  if (!scalableLoadingDecision.includes(token)) {
    failures.push(`Scalable loading decision is missing token: ${token}`);
  }
}

for (const token of [
  "Hermes Runs Migration Assessment 16A",
  "Session stream remains default until proven otherwise",
  "Recommendation: **do not migrate immediately.**",
  "Browser UI -> Next.js BFF -> Hermes API server",
  "No live run was created in this assessment.",
  "X-Hermes-Session-Key",
  "serverSideRunStop: false",
  "Option B, hybrid experimental Runs path",
  "Slice 16B: Runs API harmless probe via BFF",
  "no direct browser-to-Hermes calls"
]) {
  if (!hermesRunsMigrationAssessment.includes(token)) {
    failures.push(`Hermes Runs migration assessment is missing token: ${token}`);
  }
}

for (const token of [
  "Hermes Runs Probe 16B",
  "POST /api/hermes/runs/probe",
  "HERMES_RUNS_PROBE_OK",
  "Brain Memory tools involved: no",
  "Server-side run stop remains untested",
  "Approval actions remain untested",
  "composer Agent access selector was not implemented",
  "HERMES_RUNS_EVENT_NORMALIZATION_16C.md",
  "Slice 16D: Brain Memory MCP parity test in Runs flow"
]) {
  if (!hermesRunsProbeCheckpoint.includes(token)) {
    failures.push(`Hermes Runs probe checkpoint is missing token: ${token}`);
  }
}

for (const token of [
  "Hermes Runs Event Normalization 16C",
  "createActivityEventFromHermesRunsEvent",
  "`message.delta`",
  "`reasoning.available`",
  "Thinking signal received",
  "[omitted: reasoning text not rendered]",
  "`run.completed`",
  "Production chat was not switched to Runs",
  "composer Agent access selector was not implemented",
  "Slice 16D: Brain Memory MCP parity test in Runs flow"
]) {
  if (!hermesRunsEventNormalizationCheckpoint.includes(token)) {
    failures.push(`Hermes Runs event normalization checkpoint is missing token: ${token}`);
  }
}

for (const token of [
  "Hermes Runs Brain Memory Parity 16D",
  "POST /api/hermes/runs/memory-probe",
  "smoke:hermes:runs:memory",
  "BM_RUNS_MEMORY_16D_20260531120408_50ZNHG",
  "run_9598780e01984716b2676e4c11f7ef2c",
  "Brain Memory tool events | 2",
  "Different project",
  "different session",
  "Production chat still uses `/api/hermes/chat/stream`",
  "Slice 16E: server-side run stop experiment"
]) {
  if (!hermesRunsBrainMemoryParityCheckpoint.includes(token)) {
    failures.push(`Hermes Runs Brain Memory parity checkpoint is missing token: ${token}`);
  }
}

for (const token of [
  "Hermes Runs Approval Probe 16F",
  "POST /api/hermes/runs/approval-probe",
  "smoke:hermes:runs:approval",
  "approval.request",
  "approval.responded",
  "approval_denied_and_reconciled",
  "Production chat still uses `/api/hermes/chat/stream`",
  "No direct browser-to-Hermes path",
  "composer Agent access selector was not implemented",
  "Slice 16G: experimental Runs mode feature flag"
]) {
  if (!hermesRunsApprovalProbeCheckpoint.includes(token)) {
    failures.push(`Hermes Runs approval probe checkpoint is missing token: ${token}`);
  }
}

for (const token of [
  "Hermes Runs Experimental Mode 16G",
  "HERMES_UI_EXPERIMENTAL_RUNS_MODE",
  "POST /api/hermes/runs/experimental-chat",
  "smoke:hermes:runs:experimental-chat",
  "HERMES_RUNS_EXPERIMENTAL_CHAT_OK",
  "HTTP 403",
  "run_6a1dd54df8574373be1d7d19b09b48b4",
  "message.delta",
  "reasoning.available",
  "run.completed",
  "Production chat still uses `/api/hermes/chat/stream`",
  "composer Agent access selector was not implemented",
  "Slice 16H: Runs default migration decision"
]) {
  if (!hermesRunsExperimentalModeCheckpoint.includes(token)) {
    failures.push(`Hermes Runs experimental mode checkpoint is missing token: ${token}`);
  }
}

for (const token of [
  "Hermes Runs Stop Experiment 16E",
  "POST /api/hermes/runs/stop-probe",
  "smoke:hermes:runs:stop",
  "server-side stop",
  "Production chat still uses `/api/hermes/chat/stream`",
  "No direct browser-to-Hermes path",
  "composer Agent access selector was not implemented",
  "Slice 16F: approvals action probe"
]) {
  if (!hermesRunsStopExperimentCheckpoint.includes(token)) {
    failures.push(`Hermes Runs stop experiment checkpoint is missing token: ${token}`);
  }
}

for (const token of [
  "runHermesRunsProbe",
  "Cache-Control",
  "no-store"
]) {
  if (!hermesRunsProbeRoute.includes(token)) {
    failures.push(`Hermes Runs probe BFF route is missing token: ${token}`);
  }
}

for (const token of [
  "runHermesRunsApprovalProbe",
  "sanitizeChoice",
  "Cache-Control",
  "no-store"
]) {
  if (!hermesRunsApprovalProbeRoute.includes(token)) {
    failures.push(`Hermes Runs approval probe BFF route is missing token: ${token}`);
  }
}

for (const token of [
  "runHermesRunsStopProbe",
  "Cache-Control",
  "no-store"
]) {
  if (!hermesRunsStopProbeRoute.includes(token)) {
    failures.push(`Hermes Runs stop probe BFF route is missing token: ${token}`);
  }
}

for (const token of [
  "/api/hermes/runs/probe",
  "--require-hermes",
  "--base-url",
  "normalizedActivity",
  "brainMemoryToolEvents",
  "approvalEvents"
]) {
  if (!hermesRunsProbeScript.includes(token)) {
    failures.push(`Hermes Runs probe script is missing token: ${token}`);
  }
}

for (const token of [
  "/api/hermes/runs/approval-probe",
  "--require-hermes",
  "--base-url",
  "--choice",
  "approvalRequiredObserved",
  "approvalActionAttempted",
  "approvalEventTypes",
  "rawSecretRendered"
]) {
  if (!hermesRunsApprovalProbeScript.includes(token)) {
    failures.push(`Hermes Runs approval probe script is missing token: ${token}`);
  }
}

for (const token of [
  "/api/hermes/runs/stop-probe",
  "--require-hermes",
  "--base-url",
  "stopHttpStatus",
  "completedBeforeStop",
  "serverSideStopEffective"
]) {
  if (!hermesRunsStopProbeScript.includes(token)) {
    failures.push(`Hermes Runs stop probe script is missing token: ${token}`);
  }
}

for (const token of [
  "/api/hermes/runs/experimental-chat",
  "--expect-disabled",
  "--require-hermes",
  "--base-url",
  "HERMES_RUNS_EXPERIMENTAL_CHAT_OK",
  "projectStableKey",
  "brainMemoryToolEvents",
  "productionChatUntouched"
]) {
  if (!hermesRunsExperimentalChatScript.includes(token)) {
    failures.push(`Hermes Runs experimental chat script is missing token: ${token}`);
  }
}

for (const token of [
  "blockerCategory",
  "brainMemoryGatewayMemoryKeySet",
  "brainMemoryUiBearerSet",
  "brain_memory_key_missing",
  "brain_memory_ui_bearer_unauthorized",
  "runs_mcp_failure"
]) {
  if (!hermesRunsMemoryProbeScript.includes(token)) {
    failures.push(`Hermes Runs memory probe script is missing diagnostics token: ${token}`);
  }
}

for (const token of [
  "runHermesRunsProbe",
  "HERMES_RUNS_PROBE_PROMPT",
  "HERMES_RUNS_PROBE_EXPECTED_TEXT",
  "/v1/runs",
  "/v1/runs/${encodeURIComponent(args.runId)}/events",
  "stopCalled: false",
  "approvalCalled: false",
  "browserDirectHermes: false",
  "memoryMutationRequested"
]) {
  if (!hermesClientSource.includes(token)) {
    failures.push(`Hermes client Runs probe helper is missing token: ${token}`);
  }
}

for (const token of [
  "runHermesRunsExperimentalChat",
  "HERMES_RUNS_EXPERIMENTAL_CHAT_EXPECTED_TEXT",
  "experimentalRunsMetadata",
  "experimentalRunsSafety",
  "conversation_history",
  "productionChatUntouched: true",
  "browserDirectBrainMemory: false",
  "directStorageAccess: false"
]) {
  if (!hermesClientSource.includes(token)) {
    failures.push(`Hermes client experimental Runs chat helper is missing token: ${token}`);
  }
}

for (const token of [
  "runHermesRunsApprovalProbe",
  "respondHermesRunApproval",
  "/v1/runs/${encodeURIComponent(args.runId)}/approval",
  "readHermesRunEventsWithApproval",
  "approvalRequiredObserved",
  "approvalCalled",
  "browserDirectHermes: false",
  "memoryMutationRequested: false",
  "productionChatUntouched: true"
]) {
  if (!hermesClientSource.includes(token)) {
    failures.push(`Hermes client Runs approval helper is missing token: ${token}`);
  }
}

for (const token of [
  "runHermesRunsStopProbe",
  "stopHermesRun",
  "/v1/runs/${encodeURIComponent(args.runId)}/stop",
  "pollHermesRunUntilStable",
  "serverSideStopEffective",
  "stopCalled",
  "browserDirectHermes: false",
  "memoryMutationRequested: false"
]) {
  if (!hermesClientSource.includes(token)) {
    failures.push(`Hermes client Runs stop helper is missing token: ${token}`);
  }
}

for (const token of [
  "runHermesRunsExperimentalChat",
  "HERMES_UI_EXPERIMENTAL_RUNS_MODE",
  "isExperimentalRunsModeEnabled",
  "buildMemoryScopeBridgeInstruction",
  "Cache-Control",
  "no-store",
  "productionChatUntouched: true",
  "browserDirectHermes: false",
  "browserDirectBrainMemory: false",
  "directStorageAccess: false"
]) {
  if (!hermesRunsExperimentalChatRoute.includes(token)) {
    failures.push(`Hermes Runs experimental chat route is missing token: ${token}`);
  }
}

for (const token of [
  "runHermesRunsProbe",
  "searchBrainMemory",
  "inspectBrainMemory",
  "buildMemoryScopeBridgeInstruction",
  "createActivityEventFromHermesRunsEvent",
  "memoryMutationRequested: true",
  "promptKind: \"memory-probe\"",
  "BM_RUNS_MEMORY_STORED",
  "differentProjectAbsent",
  "differentSessionAbsent",
  "browserDirectHermes: false",
  "browserDirectBrainMemory: false",
  "directStorageAccess: false"
]) {
  if (!hermesRunsMemoryProbeRoute.includes(token)) {
    failures.push(`Hermes Runs memory probe route is missing token: ${token}`);
  }
}

for (const token of [
  "blockerCategory",
  "envPosture",
  "brain_memory_gateway_unreachable",
  "brain_memory_key_missing",
  "brain_memory_key_unauthorized",
  "brain_memory_ui_bearer_unauthorized",
  "marker_not_found",
  "scope_mismatch",
  "runs_mcp_failure"
]) {
  if (!hermesRunsMemoryProbeRoute.includes(token)) {
    failures.push(`Hermes Runs memory probe route is missing diagnostics token: ${token}`);
  }
}

if (!packageJson.includes("\"smoke:hermes:runs:memory\"")) {
  failures.push("package.json is missing smoke:hermes:runs:memory script.");
}

if (!packageJson.includes("\"smoke:hermes:runs:approval\"")) {
  failures.push("package.json is missing smoke:hermes:runs:approval script.");
}

if (!packageJson.includes("\"smoke:hermes:runs:experimental-chat\"")) {
  failures.push("package.json is missing smoke:hermes:runs:experimental-chat script.");
}

if (!packageJson.includes("\"smoke:hermes:runs:replay-ui\"")) {
  failures.push("package.json is missing smoke:hermes:runs:replay-ui script.");
}

if (!packageJson.includes("\"smoke:hermes:runs:route-guard\"")) {
  failures.push("package.json is missing smoke:hermes:runs:route-guard script.");
}

if (!packageJson.includes("\"smoke:hermes:runs:stop\"")) {
  failures.push("package.json is missing smoke:hermes:runs:stop script.");
}

for (const token of [
  "Hermes Runs Default Decision 16H",
  "Decision: keep session stream as production default",
  "HERMES_UI_EXPERIMENTAL_RUNS_MODE",
  "BRAIN_MEMORY_GATEWAY_MEMORY_API_KEY",
  "POST /api/hermes/runs/experimental-chat",
  "Production chat still uses `/api/hermes/chat/stream`",
  "composer Agent access selector was not implemented",
  "Slice 16I: Runs Brain Memory live env/runbook hardening"
]) {
  if (!hermesRunsDefaultDecisionCheckpoint.includes(token)) {
    failures.push(`Hermes Runs default decision checkpoint is missing token: ${token}`);
  }
}

for (const token of [
  "Hermes Runs Brain Memory Env Hardening 16I",
  "BRAIN_MEMORY_GATEWAY_MEMORY_API_KEY",
  "BRAIN_MEMORY_UI_API_KEY",
  "BRAIN_MEMORY_DEFAULT_TENANT_ID=local-dev",
  "brain_memory_key_missing",
  "brain_memory_ui_bearer_unauthorized",
  "session stream remains the production default",
  "experimental Runs remains flag-gated",
  "Slice 16J: Runs replay/history reconciliation plan"
]) {
  if (!hermesRunsBrainMemoryEnvCheckpoint.includes(token)) {
    failures.push(`Hermes Runs Brain Memory env checkpoint is missing token: ${token}`);
  }
}

for (const token of [
  "Hermes Runs Replay Reconciliation 16J",
  "Keep `RunRecord.id` as a Web UI-generated id.",
  "Store Hermes `run_id` only in `RunRecord.hermesRunId`.",
  "`message.delta` should be represented by the persisted assistant transcript",
  "Do not persist:",
  "The composer Agent access selector remains a future idea",
  "Production chat still uses `/api/hermes/chat/stream`.",
  "No direct browser-to-Hermes path was added.",
  "Slice 16K: experimental Runs RunRecord/replay prototype"
]) {
  if (!hermesRunsReplayReconciliation.includes(token)) {
    failures.push(`Hermes Runs replay reconciliation doc is missing token: ${token}`);
  }
}

for (const token of [
  "createRunRecordFromHermesRunsResult",
  "RUNS_REPLAY_EXCLUDED_FIELDS",
  "createActivityEventFromHermesRunsEvent",
  "createPersistedActivityEvent",
  "limitPersistedActivityEvents",
  "runRecordPreview",
  "activityReplayPreview",
  "per-token message.delta replay rows",
  "rawRunsPayloadPersisted: false",
  "replayGeneratedFrom: \"normalized-run-probe-events\""
]) {
  if (!hermesRunsReplayPreviewSource.includes(token)) {
    failures.push(`Hermes Runs replay preview helper is missing token: ${token}`);
  }
}

for (const token of [
  "createRunRecordFromHermesRunsResult",
  "runRecordPreview",
  "activityReplayPreview",
  "replayExcludedFields"
]) {
  if (!hermesRunsExperimentalChatRoute.includes(token)) {
    failures.push(`Experimental Runs chat route is missing replay preview token: ${token}`);
  }
}

for (const token of [
  "validateRunRecordReplayShape",
  "runRecordPreview.hermesRunId",
  "message.delta was persisted as a replay row",
  "rawRunsPayloadPersisted",
  "unredacted bearer value"
]) {
  if (!hermesRunsExperimentalChatScript.includes(token)) {
    failures.push(`Experimental Runs chat smoke is missing replay validation token: ${token}`);
  }
}

for (const token of [
  "/api/hermes/runs/experimental-chat",
  "--expect-disabled",
  "--require-hermes",
  "--base-url",
  "HERMES_RUNS_REPLAY_UI_OK",
  "runRecordPreview",
  "activityReplayPreview",
  "localStorage.setItem",
  "hermes-ui.workspace.v1",
  "Run history",
  "hermesRunId",
  "Persisted replay",
  "message.delta",
  "No direct browser-to-Hermes",
  "composer Agent access selector"
]) {
  if (!hermesRunsReplayUiSmokeScript.includes(token) && !hermesRunsReplayUiHydrationCheckpoint.includes(token)) {
    failures.push(`Runs replay UI hydration coverage is missing token: ${token}`);
  }
}

for (const token of [
  "Hermes Runs RunRecord Replay Prototype 16K",
  "runRecordPreview",
  "activityReplayPreview",
  "per-token `message.delta` replay rows",
  "Production chat still uses `/api/hermes/chat/stream`.",
  "Experimental Runs remains flag-gated",
  "No direct browser-to-Hermes path was added.",
  "composer Agent access selector was not implemented"
]) {
  if (!hermesRunsRunRecordReplayCheckpoint.includes(token)) {
    failures.push(`Hermes Runs RunRecord replay checkpoint is missing token: ${token}`);
  }
}

for (const token of [
  "Hermes Runs Replay UI Hydration 16L",
  "Option A",
  "test-only browser smoke hydration",
  "runRecordPreview",
  "activityReplayPreview",
  "localStorage",
  "Run history",
  "hermesRunId",
  "Persisted replay",
  "message.delta",
  "Production chat still uses `/api/hermes/chat/stream`.",
  "Experimental Runs remains flag-gated",
  "No direct browser-to-Hermes path was added.",
  "composer Agent access selector was not implemented"
]) {
  if (!hermesRunsReplayUiHydrationCheckpoint.includes(token)) {
    failures.push(`Hermes Runs replay UI hydration checkpoint is missing token: ${token}`);
  }
}

for (const token of [
  "Hermes Runs Execution State Machine 16M",
  "session stream remains the production default",
  "HERMES_UI_EXPERIMENTAL_RUNS_MODE",
  "idle",
  "preparing_context",
  "creating_run",
  "streaming_events",
  "waiting_for_approval",
  "stopping",
  "reconnecting",
  "replaying",
  "Browser Responsibilities",
  "BFF Responsibilities",
  "Stop Contract",
  "Approval Contract",
  "Agent Access Selector Future Contract",
  "Migration Gates",
  "Rollback Plan",
  "future-only",
  "No production Runs execution implementation",
  "No production composer Runs selector",
  "No direct browser-to-Hermes",
  "Slice 16N"
]) {
  if (!hermesRunsExecutionStateMachine.includes(token)) {
    failures.push(`Hermes Runs execution state machine doc is missing token: ${token}`);
  }
}

for (const token of [
  "Hermes Runs BFF Event Contract 16N",
  "POST /api/hermes/runs/chat/stream",
  "production session stream remains the default",
  "No runtime route is implemented in this slice.",
  "No direct browser-to-Hermes",
  "Agent access selector remains future-only",
  "HermesRunsBffEvent",
  "run.started",
  "message.delta",
  "activity.event",
  "approval.request",
  "approval.responded",
  "run.stopping",
  "run.stopped",
  "run.reconnecting",
  "replay.snapshot",
  "error",
  "done",
  "RunRecord",
  "activityReplay",
  "run_create_failed",
  "approval_invalid_choice",
  "tenant_scope_mismatch",
  "No raw Runs payload",
  "Slice 16O",
  "apps/web/src/types/hermesRunsBffEvents.ts",
  "npm run check:hermes-runs-bff-events",
  "Slice 16P"
]) {
  if (!hermesRunsBffEventContract.includes(token)) {
    failures.push(`Hermes Runs BFF event contract doc is missing token: ${token}`);
  }
}

for (const token of [
  "Hermes Runs BFF Event Fixtures 16O",
  "HermesRunsBffEvent",
  "hermesRunsBffBasicSuccessEvents",
  "hermesRunsBffActivityToolEvents",
  "hermesRunsBffApprovalDenyEvents",
  "hermesRunsBffStopEvents",
  "hermesRunsBffErrorEvents",
  "hermesRunsBffReconnectReplayEvents",
  "message.delta",
  "activityReplay",
  "npm run check:hermes-runs-bff-events",
  "Production chat still uses `/api/hermes/chat/stream`",
  "No production Runs execution runtime",
  "No composer Agent access selector",
  "No direct browser-to-Hermes path",
  "Slice 16P"
]) {
  if (!hermesRunsBffEventFixturesCheckpoint.includes(token)) {
    failures.push(`Hermes Runs BFF event fixtures checkpoint is missing token: ${token}`);
  }
}

for (const token of [
  "HERMES_RUNS_BFF_EVENT_SCHEMA_VERSION",
  "HermesRunsBffEvent",
  "HermesRunsBffRunRef",
  "HermesRunsBffMessagePayload",
  "HermesRunsBffApprovalPayload",
  "HermesRunsBffReplayPayload",
  "HermesRunsBffErrorPayload",
  "HermesRunsStopRequest",
  "HermesRunsApprovalRequest",
  "run.reconnecting",
  "replay.snapshot"
]) {
  if (!hermesRunsBffEventTypesSource.includes(token)) {
    failures.push(`Hermes Runs BFF event types source is missing token: ${token}`);
  }
}

for (const token of [
  "hermesRunsBffBasicSuccessEvents",
  "hermesRunsBffActivityToolEvents",
  "hermesRunsBffApprovalDenyEvents",
  "hermesRunsBffStopEvents",
  "hermesRunsBffErrorEvents",
  "hermesRunsBffReconnectReplayEvents",
  "hermesRunsBffRequiredEventTypes",
  "full raw Hermes Runs event payloads",
  "per-token message.delta replay rows",
  "rawRunsPayloadPersisted: false"
]) {
  if (!hermesRunsBffEventFixturesSource.includes(token)) {
    failures.push(`Hermes Runs BFF event fixtures source is missing token: ${token}`);
  }
}

for (const token of [
  "createEmptyHermesRunsBffDraftState",
  "reduceHermesRunsBffEvents",
  "applyHermesRunsBffEvent",
  "assistantText",
  "activityReplay",
  "approvals",
  "replaySnapshot",
  "message.delta",
  "createPersistedActivityEvent",
  "limitPersistedActivityEvents"
]) {
  if (!hermesRunsBffEventReducerSource.includes(token)) {
    failures.push(`Hermes Runs BFF event reducer source is missing token: ${token}`);
  }
}

for (const token of [
  "checkRequiredEventTypes",
  "checkBasicSuccessfulRun",
  "checkMessageDeltaNoReplayRows",
  "checkActivityEventCreatesReplayState",
  "checkApprovalLifecycle",
  "checkStopSequence",
  "checkErrorSequence",
  "checkReplaySnapshotHydrates",
  "checkDisabledProductionRunsRoute",
  "checkNoDirectBrowserHermesPath"
]) {
  if (!hermesRunsBffEventCheckScript.includes(token)) {
    failures.push(`Hermes Runs BFF event check script is missing token: ${token}`);
  }
}

for (const token of [
  "Hermes Runs Disabled Route Guard 16P",
  "POST /api/hermes/runs/chat/stream",
  "HTTP 501",
  "production_runs_route_not_enabled",
  "sessionStreamDefault: true",
  "hermesRunCreated: false",
  "hermesCalled: false",
  "brainMemoryCalled: false",
  "eventStreamStarted: false",
  "productionChatUntouched: true",
  "No direct browser-to-Hermes path",
  "No production Runs composer switch",
  "npm run smoke:hermes:runs:route-guard",
  "Slice 16Q"
]) {
  if (!hermesRunsDisabledRouteCheckpoint.includes(token)) {
    failures.push(`Hermes Runs disabled route checkpoint is missing token: ${token}`);
  }
}

for (const token of [
  "Hermes Runs Request Validation 16Q",
  "HermesRunsBffRequest",
  "validateHermesRunsBffRequest",
  "hermesRunsBffValidMinimalRequest",
  "missing_project_id",
  "missing_memory_scope",
  "invalid_agent_access_mode",
  "message_too_large",
  "forbidden_credential_field",
  "provider/model are accepted as inert future metadata",
  "HTTP 501",
  "production_runs_route_not_enabled",
  "Production chat still uses `/api/hermes/chat/stream`",
  "No production Runs composer switch",
  "composer Agent access selector was not implemented",
  "npm run check:hermes-runs-bff-request",
  "Slice 16S"
]) {
  if (!hermesRunsRequestValidationCheckpoint.includes(token)) {
    failures.push(`Hermes Runs request validation checkpoint is missing token: ${token}`);
  }
}

for (const token of [
  "Hermes Runs Disabled Route Validation And Agent Access 16R",
  "requestValidation",
  "attempted: true",
  "rawRequestEchoed: false",
  "execution",
  "storageAccess: false",
  "HTTP 501",
  "production_runs_route_not_enabled",
  "invalid_agent_access_mode",
  "forbidden_credential_field",
  "Agent Access Policy Summary",
  "Chat only",
  "Read-only tools",
  "Ask before tools",
  "Full access",
  "Custom",
  "Enforcement Ownership",
  "No production Runs composer switch",
  "No composer Agent access selector UI",
  "Slice 16S"
]) {
  if (!hermesRunsDisabledRouteValidationCheckpoint.includes(token)) {
    failures.push(`Hermes Runs disabled route validation checkpoint is missing token: ${token}`);
  }
}

for (const token of [
  "Agent Access Approval Policy 16R",
  "chat_only",
  "read_only_tools",
  "ask_before_tools",
  "full_access",
  "custom",
  "Chat Only",
  "Read-Only Tools",
  "Ask Before Tools",
  "Full Access",
  "Custom",
  "Enforcement Ownership",
  "Browser",
  "Web UI BFF",
  "Hermes Runs",
  "Brain Memory Gateway",
  "There must be no fake `Full access` control",
  "No composer Agent access selector UI",
  "Slice 16S"
]) {
  if (!agentAccessApprovalPolicy.includes(token)) {
    failures.push(`Agent access approval policy doc is missing token: ${token}`);
  }
}

for (const token of [
  "Agent Access Policy Matrix 16S",
  "agentAccessPolicyFixtures",
  "chat_only",
  "read_only_tools",
  "ask_before_tools",
  "full_access",
  "custom",
  "productionUiEnabled: false",
  "enforcementAvailable: false",
  "Full access",
  "not unrestricted OS",
  "npm run check:agent-access-policy",
  "No composer Agent access selector UI",
  "No approval buttons",
  "No enabled `Full access` production UI",
  "agentAccessSelector: \"future-only\"",
  "Slice 16T"
]) {
  if (!agentAccessPolicyMatrixCheckpoint.includes(token)) {
    failures.push(`Agent access policy matrix checkpoint is missing token: ${token}`);
  }
}

for (const token of [
  "Hermes Runs BFF Lifecycle Dry Run 16T",
  "HermesRunsBffLifecycleStage",
  "validate_request",
  "validate_scope",
  "validate_agent_access_policy",
  "prepare_context",
  "create_run",
  "stream_or_poll_events",
  "normalize_event",
  "update_run_record",
  "update_activity_replay",
  "handle_approval_request",
  "submit_approval_response",
  "handle_stop_request",
  "finalize_run",
  "emit_done",
  "emit_error",
  "createHermesRunsBffLifecycleDryRun",
  "lifecycleDryRun",
  "production_runs_route_not_enabled",
  "runtime execution flags all false",
  "No production Runs execution",
  "No composer Agent access selector UI",
  "No approval buttons",
  "npm run check:hermes-runs-lifecycle",
  "Slice 16U"
]) {
  if (!hermesRunsLifecycleDryRunCheckpoint.includes(token)) {
    failures.push(`Hermes Runs lifecycle dry-run checkpoint is missing token: ${token}`);
  }
}

for (const token of [
  "Hermes Runs Production Migration Gate 16U",
  "Current Decision",
  "not ready to implement production Runs default",
  "Gates Already Green",
  "Gates Still Required Before Production Runs Route Implementation",
  "Gates Required Before Runs Becomes Default",
  "Non-Goals",
  "Production chat still uses `/api/hermes/chat/stream`",
  "No production Runs execution",
  "No composer Agent access selector UI",
  "No approval buttons",
  "No direct browser-to-Hermes path",
  "No direct browser-to-Brain Memory Gateway path",
  "No direct storage access",
  "Slice 16V"
]) {
  if (!hermesRunsProductionMigrationGate.includes(token)) {
    failures.push(`Hermes Runs production migration gate doc is missing token: ${token}`);
  }
}

for (const token of [
  "AgentAccessPolicyFixture",
  "agentAccessPolicyFixtures",
  "agentAccessPolicyFixtureModes",
  "chat_only",
  "read_only_tools",
  "ask_before_tools",
  "full_access",
  "custom",
  "productionUiEnabled: false",
  "enforcementAvailable: false",
  "expectedToolPolicy",
  "expectedApprovalBehavior",
  "brainMemoryReadAllowed",
  "brainMemoryWriteAllowed",
  "commandAllowed",
  "externalActionAllowed",
  "Full access is not unrestricted OS",
  "future-only"
]) {
  if (!agentAccessPolicyFixturesSource.includes(token)) {
    failures.push(`Agent access policy fixtures source is missing token: ${token}`);
  }
}

for (const token of [
  "HERMES_RUNS_BFF_LIFECYCLE_DRY_RUN_SCHEMA_VERSION",
  "HERMES_RUNS_BFF_LIFECYCLE_DISABLED_REASON",
  "HERMES_RUNS_BFF_LIFECYCLE_STAGES",
  "HermesRunsBffLifecycleStage",
  "HermesRunsBffLifecycleDryRun",
  "createHermesRunsBffLifecycleDryRun",
  "validate_request",
  "validate_scope",
  "validate_agent_access_policy",
  "prepare_context",
  "create_run",
  "stream_or_poll_events",
  "normalize_event",
  "update_run_record",
  "update_activity_replay",
  "handle_approval_request",
  "submit_approval_response",
  "handle_stop_request",
  "finalize_run",
  "emit_done",
  "emit_error",
  "disabled_http_501",
  "production_runs_route_not_enabled",
  "rawRequestEchoed: false",
  "serviceSecretsRead: false",
  "hermesRunCreated: false",
  "brainMemoryCalled: false",
  "storageAccess: false"
]) {
  if (!hermesRunsLifecycleDryRunSource.includes(token)) {
    failures.push(`Hermes Runs lifecycle dry-run helper is missing token: ${token}`);
  }
}

for (const token of [
  "hermesRunsBffValidChatOnlyLifecycleDryRun",
  "hermesRunsBffValidAskBeforeToolsLifecycleDryRun",
  "hermesRunsBffInvalidMissingScopeLifecycleDryRun",
  "hermesRunsBffInvalidAgentAccessLifecycleDryRun",
  "hermesRunsBffStopLifecycleFutureFixture",
  "hermesRunsBffApprovalLifecycleFutureFixture",
  "hermesRunsBffErrorLifecycleFixture",
  "hermesRunsBffLifecycleDryRunFixtures",
  "hermesRunsBffRequiredLifecycleStages",
  "expectedRuntimeExecuted: false",
  "missing_memory_scope",
  "invalid_agent_access_mode"
]) {
  if (!hermesRunsLifecycleFixturesSource.includes(token)) {
    failures.push(`Hermes Runs lifecycle fixtures source is missing token: ${token}`);
  }
}

for (const token of [
  "HERMES_RUNS_DISABLED_ROUTE_HTTP_STATUS",
  "HERMES_RUNS_DISABLED_ROUTE_REASON",
  "validateHermesRunsDisabledRouteResponse",
  "expectedRequestValidationOk",
  "expectedErrorKinds",
  "requestValidation.rawRequestEchoed",
  "lifecycleDryRun.runtimeExecution",
  "disabled response must not include",
  "disabled response must not contain secret-like data"
]) {
  if (!hermesRunsDisabledRouteResponseValidationSource.includes(token)) {
    failures.push(`Hermes Runs disabled route response validator is missing token: ${token}`);
  }
}

for (const token of [
  "HermesRunsDisabledRouteResponseFixture",
  "hermesRunsDisabledValidMinimalResponseFixture",
  "hermesRunsDisabledValidFullFutureResponseFixture",
  "hermesRunsDisabledInvalidMissingScopeResponseFixture",
  "hermesRunsDisabledCredentialFieldResponseFixture",
  "hermesRunsDisabledOversizedMessageResponseFixture",
  "hermesRunsDisabledRouteResponseFixtures",
  "expectedRequestValidationOk",
  "missing_memory_scope",
  "forbidden_credential_field",
  "message_too_large",
  "rawRequestEchoed: false",
  "storageAccess: false",
  "createHermesRunsBffLifecycleDryRun"
]) {
  if (!hermesRunsDisabledRouteResponseFixturesSource.includes(token)) {
    failures.push(`Hermes Runs disabled route response fixtures source is missing token: ${token}`);
  }
}

for (const token of [
  "checkAllLifecycleStagesDefined",
  "checkFixtureMatrix",
  "checkRuntimeStagesNotExecuted",
  "checkDisabledRouteResponseFixtures",
  "checkDisabledRouteResponseSourcePurity",
  "checkDisabledReasonAndNoSecrets",
  "checkSourcePurity",
  "checkDisabledRouteLifecyclePosture",
  "checkProductionSessionStreamStillPresent",
  "checkNoAgentAccessSelector",
  "checkPackageScript",
  "createHermesRunsBffLifecycleDryRun",
  "validateHermesRunsDisabledRouteResponse",
  "runtime-stages-not-executed",
  "production_runs_route_not_enabled"
]) {
  if (!hermesRunsLifecycleCheckScript.includes(token)) {
    failures.push(`Hermes Runs lifecycle check script is missing token: ${token}`);
  }
}

for (const token of [
  "checkAllModesPresent",
  "checkAllModesDisabled",
  "checkFullAccessWarning",
  "checkModePolicySemantics",
  "checkValidatorModeContract",
  "checkNoComposerSelector",
  "checkNoEnabledFullAccessProductionUi",
  "checkNoApprovalButtonsInComposer",
  "checkDisabledRouteStillDisabled",
  "checkRouteGuardCoversAgentAccessModes",
  "validChatOnlyDisabledRequestBody",
  "validFullAccessDisabledRequestBody",
  "invalid_agent_access_mode"
]) {
  if (!agentAccessPolicyCheckScript.includes(token)) {
    failures.push(`Agent access policy check script is missing token: ${token}`);
  }
}

for (const token of [
  "HERMES_RUNS_BFF_REQUEST_SCHEMA_VERSION",
  "HERMES_RUNS_BFF_AGENT_ACCESS_MODES",
  "HermesRunsBffRequest",
  "HermesRunsBffMemoryScope",
  "HermesRunsBffAgentAccessMode",
  "ask_before_tools",
  "full_access",
  "custom",
  "model?: string",
  "provider?: string",
  "HermesRunsBffRequestValidationResult",
  "forbidden_credential_field"
]) {
  if (!hermesRunsBffRequestTypesSource.includes(token)) {
    failures.push(`Hermes Runs BFF request types source is missing token: ${token}`);
  }
}

for (const token of [
  "hermesRunsBffValidMinimalRequest",
  "hermesRunsBffValidAgentAccessRequest",
  "hermesRunsBffProviderModelFutureRequest",
  "hermesRunsBffInvalidRequestFixtures",
  "missing_project_id",
  "missing_memory_scope",
  "invalid_agent_access_mode",
  "message_too_large",
  "forbidden_credential_field",
  "timeout_out_of_range",
  "invalid_memory_scope_flags"
]) {
  if (!hermesRunsBffRequestFixturesSource.includes(token)) {
    failures.push(`Hermes Runs BFF request fixtures source is missing token: ${token}`);
  }
}

for (const token of [
  "validateHermesRunsBffRequest",
  "HERMES_RUNS_BFF_MAX_MESSAGE_CHARS",
  "HERMES_RUNS_BFF_MIN_TIMEOUT_MS",
  "HERMES_RUNS_BFF_MAX_TIMEOUT_MS",
  "forbiddenCredentialKeyPattern",
  "collectForbiddenCredentialFields",
  "invalid_agent_access_mode",
  "timeout_out_of_range",
  "inert_until_client_selectable",
  "inert_until_supported"
]) {
  if (!hermesRunsBffRequestValidationSource.includes(token)) {
    failures.push(`Hermes Runs BFF request validation source is missing token: ${token}`);
  }
}

for (const token of [
  "@hermes-ui/hermes-client",
  "@hermes-ui/brain-memory-client",
  "NextResponse",
  "buildMemoryScopeBridgeInstruction",
  "process.env",
  "fetch(",
  "/v1/runs",
  "/api/sessions",
  "searchBrainMemory",
  "inspectBrainMemory",
  "localStorage",
  "sessionStorage",
  "readFileSync",
  "writeFileSync"
]) {
  if (
    hermesRunsBffRequestTypesSource.includes(token) ||
    hermesRunsBffRequestFixturesSource.includes(token) ||
    hermesRunsBffRequestValidationSource.includes(token)
  ) {
    failures.push(`Hermes Runs BFF request contract source includes forbidden token: ${token}`);
  }
}

for (const token of [
  "@hermes-ui/hermes-client",
  "@hermes-ui/brain-memory-client",
  "NextResponse",
  "buildMemoryScopeBridgeInstruction",
  "process.env",
  "fetch(",
  "/v1/runs",
  "/api/sessions",
  "searchBrainMemory",
  "inspectBrainMemory",
  "localStorage",
  "sessionStorage",
  "readFileSync",
  "writeFileSync"
]) {
  if (
    hermesRunsDisabledRouteResponseFixturesSource.includes(token) ||
    hermesRunsDisabledRouteResponseValidationSource.includes(token)
  ) {
    failures.push(`Hermes Runs disabled route response contract source includes forbidden token: ${token}`);
  }
}

for (const token of [
  "checkValidFixturesPass",
  "checkInvalidFixturesFail",
  "checkProviderModelFutureFieldsRemainInert",
  "checkForbiddenCredentialFieldRejected",
  "checkDisabledRouteResponseFixtures",
  "checkValidationSourceIsPure",
  "checkDisabledRouteResponseSourceIsPure",
  "checkDisabledRouteValidationEcho",
  "checkProductionSessionStreamStillPresent",
  "checkNoComposerRunsSelector"
]) {
  if (!hermesRunsBffRequestCheckScript.includes(token)) {
    failures.push(`Hermes Runs BFF request check script is missing token: ${token}`);
  }
}

if (!packageJson.includes("\"check:hermes-runs-bff-events\"")) {
  failures.push("package.json is missing check:hermes-runs-bff-events script.");
}

if (!packageJson.includes("\"check:hermes-runs-bff-request\"")) {
  failures.push("package.json is missing check:hermes-runs-bff-request script.");
}

if (!packageJson.includes("\"check:hermes-runs-lifecycle\"")) {
  failures.push("package.json is missing check:hermes-runs-lifecycle script.");
}

if (!packageJson.includes("\"check:agent-access-policy\"")) {
  failures.push("package.json is missing check:agent-access-policy script.");
}

for (const token of [
  "streamHermesSessionChat",
  "request.signal",
  "text/event-stream"
]) {
  if (!productionHermesChatStreamRoute.includes(token)) {
    failures.push(`Production Hermes session stream route is missing token: ${token}`);
  }
}

for (const token of [
  "PRODUCTION_RUNS_ROUTE_DISABLED_REASON",
  "production_runs_route_not_enabled",
  "DisabledHermesRunsChatStreamResponse",
  "validateHermesRunsBffRequest",
  "createHermesRunsBffLifecycleDryRun",
  "readRequestValidationPosture",
  "requestValidation",
  "lifecycleDryRun",
  "attempted: true",
  "rawRequestEchoed: false",
  "errorKinds",
  "execution",
  "storageAccess: false",
  "sessionStreamDefault: true",
  "hermesRunCreated: false",
  "hermesCalled: false",
  "brainMemoryCalled: false",
  "eventStreamStarted: false",
  "productionChatUntouched: true",
  "directBrowserHermes: false",
  "directBrowserBrainMemory: false",
  "directStorageAccess: false",
  "approvalCalled: false",
  "stopCalled: false",
  "composerRunsSwitch: false",
  "agentAccessSelector: \"future-only\"",
  "status: 501",
  "Cache-Control"
]) {
  if (!hermesRunsDisabledProductionRoute.includes(token)) {
    failures.push(`Disabled production Runs route is missing token: ${token}`);
  }
}

for (const token of [
  "@hermes-ui/hermes-client",
  "streamHermesSessionChat",
  "runHermesRunsExperimentalChat",
  "runHermesRunsProbe",
  "runHermesRunsApprovalProbe",
  "runHermesRunsStopProbe",
  "runHermesRunsMemoryProbe",
  "buildMemoryScopeBridgeInstruction",
  "process.env.HERMES",
  "process.env.BRAIN_MEMORY",
  "fetch(",
  "/v1/runs",
  "/api/sessions",
  "searchBrainMemory",
  "inspectBrainMemory",
  "localStorage",
  "readFileSync",
  "writeFileSync"
]) {
  if (hermesRunsDisabledProductionRoute.includes(token)) {
    failures.push(`Disabled production Runs route includes forbidden token: ${token}`);
  }
}

for (const token of [
  "routePath",
  "source guard",
  "production_runs_route_not_enabled",
  "status: 501",
  "validMinimalDisabledRequestBody",
  "validFullFutureDisabledRequestBody",
  "validDisabledRequestBody",
  "validChatOnlyDisabledRequestBody",
  "validFullAccessDisabledRequestBody",
  "invalidDisabledRequestBody",
  "invalidMissingScopeDisabledRequestBody",
  "credentialDisabledRequestBody",
  "oversizedMessageDisabledRequestBody",
  "validateHermesRunsDisabledRouteResponse",
  "requestValidation",
  "lifecycleDryRun",
  "assertNoEnabledAgentAccess",
  "agentAccessMode: \"chat_only\"",
  "agentAccessMode: \"full_access\"",
  "hermesCalled: false",
  "brainMemoryCalled: false",
  "eventStreamStarted: false",
  "missing_memory_scope",
  "forbidden_credential_field",
  "message_too_large",
  "HERMES_RUNS_PRODUCTION_ROUTE_GUARD_OK",
  "--base-url",
  "--source-only"
]) {
  if (!hermesRunsProductionRouteGuardScript.includes(token)) {
    failures.push(`Hermes Runs production route guard script is missing token: ${token}`);
  }
}

for (const token of [
  "createActivityEventFromHermesRunsEvent",
  "normalizeHermesRunsEventType",
  "summarizeHermesRunsEvent",
  "eventType === \"message.delta\"",
  "eventType === \"reasoning.available\"",
  "Thinking signal received",
  "[omitted: reasoning text not rendered]",
  "titleFromHermesRunsEvent",
  "hermesRunsToolStatus"
]) {
  if (!agentActivityEventsSource.includes(token)) {
    failures.push(`Agent activity Runs normalizer is missing token: ${token}`);
  }
}

if (!packageJson.includes("\"smoke:hermes:runs\"")) {
  failures.push("package.json is missing smoke:hermes:runs script.");
}

const forbiddenRunRoutePaths = [
  "apps/web/src/app/api/hermes/runs/stop",
  "apps/web/src/app/api/hermes/runs/approval",
  "apps/web/src/app/api/hermes/runs/stream",
  "apps/web/src/app/api/hermes/run"
];

for (const path of forbiddenRunRoutePaths) {
  if (existsSync(join(root, path))) {
    failures.push(`Unexpected production Hermes Runs BFF route exists: ${path}`);
  }
}

const browserHermesFetchPattern = /fetch\(\s*["'`]https?:\/\/[^"'`]*8642|fetch\(\s*["'`]\/v1\/runs|fetch\(\s*["'`]\/api\/sessions/;
const browserFilesToCheck = [
  "apps/web/src/lib/hermesChatClient.ts",
  "apps/web/src/components/chat/ChatView.tsx",
  "apps/web/src/components/shell/ContextRail.tsx"
];

for (const file of browserFilesToCheck) {
  const source = readFileSync(join(root, file), "utf8");
  if (browserHermesFetchPattern.test(source)) {
    failures.push(`Browser source appears to call Hermes directly: ${file}`);
  }
}

if (!packageJson.includes("\"smoke:long-session\"")) {
  failures.push("package.json is missing smoke:long-session script.");
}

if (!packageJson.includes("\"smoke:sidebar:large\"")) {
  failures.push("package.json is missing smoke:sidebar:large script.");
}

if (!packageJson.includes("\"smoke:artifacts-tools:large\"")) {
  failures.push("package.json is missing smoke:artifacts-tools:large script.");
}

const runtimeLoadingForbiddenTokens = [
  "showMoreSessions",
  "visibleSessionLimit",
  "virtualizer",
  "react-window",
  "IntersectionObserver",
  "loadMoreSessions"
];

for (const token of runtimeLoadingForbiddenTokens) {
  if (largeSidebarFixturePage.includes(token) || largeSidebarFixture.includes(token)) {
    failures.push(`Large sidebar fixture includes runtime loading token: ${token}`);
  }
  if (largeArtifactsToolsFixturePage.includes(token) || largeArtifactsToolsFixture.includes(token)) {
    failures.push(`Large artifacts/tools fixture includes runtime loading token: ${token}`);
  }
}

if (failures.length > 0) {
  console.error("UI structure checks failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("UI structure checks passed.");
