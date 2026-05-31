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
  "apps/web/src/app/api/hermes/runs/memory-probe/route.ts",
  "apps/web/src/app/api/hermes/runs/probe/route.ts",
  "apps/web/src/app/api/hermes/runs/stop-probe/route.ts",
  "docs/checkpoints/HERMES_RUNS_APPROVAL_PROBE_16F.md",
  "docs/checkpoints/HERMES_RUNS_BRAIN_MEMORY_PARITY_16D.md",
  "docs/checkpoints/HERMES_RUNS_DEFAULT_DECISION_16H.md",
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

if (!packageJson.includes("\"smoke:hermes:runs:memory\"")) {
  failures.push("package.json is missing smoke:hermes:runs:memory script.");
}

if (!packageJson.includes("\"smoke:hermes:runs:approval\"")) {
  failures.push("package.json is missing smoke:hermes:runs:approval script.");
}

if (!packageJson.includes("\"smoke:hermes:runs:experimental-chat\"")) {
  failures.push("package.json is missing smoke:hermes:runs:experimental-chat script.");
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
