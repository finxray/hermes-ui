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

if (failures.length > 0) {
  console.error("UI structure checks failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("UI structure checks passed.");
