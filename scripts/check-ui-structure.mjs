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
const scalableLoadingRoadmap = readFileSync(
  join(root, "docs/product/SCALABLE_UI_LOADING_ROADMAP.md"),
  "utf8"
);
const packageJson = readFileSync(join(root, "package.json"), "utf8");

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
