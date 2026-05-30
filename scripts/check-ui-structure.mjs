import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const requiredFiles = [
  "apps/web/src/components/shell/AppShell.tsx",
  "apps/web/src/components/shell/AppShell.module.css",
  "apps/web/src/components/shell/SidebarRow.tsx",
  "apps/web/src/components/shell/SidebarRow.module.css",
  "apps/web/src/components/chat/Composer.module.css",
  "apps/web/src/components/chat/MessageBubble.module.css",
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
  "studio-right-rail-toggle"
]) {
  if (!appShell.includes(token)) {
    failures.push(`AppShell is missing ${token}`);
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
