import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");
const failures = [];

const adr = read("docs/architecture/ADR-0002-hermes-dashboard-recovery.md");
const route = read("apps/web/src/app/api/hermes/dashboard/route.ts");
const launcher = read("apps/web/src/server/hermesDashboardLauncher.ts");
const recoveryClient = read("apps/web/src/lib/hermesDashboardRecovery.ts");
const pluginsView = read("apps/web/src/components/plugins/PluginsView.tsx");
const recoveryState = read("apps/web/src/components/ui/HermesDashboardRecoveryState.tsx");
const configView = read("apps/web/src/components/config/ConfigView.tsx");
const keysView = read("apps/web/src/components/keys/KeysView.tsx");
const logsView = read("apps/web/src/components/logs/LogsView.tsx");
const launcherModule = await import(
  pathToFileURL(path.join(root, "apps/web/src/server/hermesDashboardLauncher.ts")).href
);

function requireTokens(label, source, tokens) {
  for (const token of tokens) {
    if (!source.includes(token)) {
      failures.push(`${label} is missing ${token}`);
    }
  }
}

requireTokens("Dashboard recovery ADR", adr, [
  "fixed allowlisted argument vector",
  "127.0.0.1",
  "same-origin",
  "not as a stopped process",
  "Windows",
  "macOS",
  "Linux",
  "HERMES_DASHBOARD_EXECUTABLE"
]);

requireTokens("Dashboard recovery route", route, [
  'export const runtime = "nodejs"',
  "isAllowedDashboardStartRequest",
  "probeHermesDashboard",
  "waitForHermesDashboard",
  'status: "blocked"'
]);

requireTokens("Dashboard launcher", launcher, [
  'import { spawn } from "node:child_process"',
  "process.platform",
  '"--host", "127.0.0.1"',
  '"--no-open"',
  '"wsl.exe"',
  '"where.exe"',
  '"/bin/zsh"',
  '"/bin/bash"',
  '"/bin/sh"',
  '"command -v hermes"',
  "resolveWslHermesExecutable",
  "resolveWindowsHermesExecutable",
  "resolveUnixHermesExecutable",
  "validatedUnixHermesExecutable",
  "validatedWindowsHermesExecutable",
  "HERMES_DASHBOARD_WINDOWS_MODE",
  "HERMES_DASHBOARD_EXECUTABLE",
  "buildDashboardLaunchSpec",
  "captureSpawnedText",
  '"X-Hermes-UI-Action"'.toLowerCase(),
  "origin",
  'request.headers.get("x-forwarded-host")',
  'request.headers.get("host")',
  "originUrl.host.toLowerCase() === requestHost.toLowerCase()"
]);

if (launcher.includes("--insecure") || launcher.includes("shell: true")) {
  failures.push("Dashboard launcher must not enable insecure binding or shell execution.");
}

const fixedDashboardArgs = ["dashboard", "--host", "127.0.0.1", "--port", "9119", "--no-open"];
const platformCases = [
  {
    label: "Windows native",
    platform: "win32",
    executable: { kind: "native", path: "C:\\Program Files\\Hermes\\hermes.exe" },
    expectedCommand: "C:\\Program Files\\Hermes\\hermes.exe",
    expectedArgs: fixedDashboardArgs
  },
  {
    label: "Windows WSL",
    platform: "win32",
    executable: { distro: "Ubuntu-24.04", kind: "wsl", path: "/home/user/.local/bin/hermes" },
    expectedCommand: "wsl.exe",
    expectedArgs: ["-d", "Ubuntu-24.04", "--", "/home/user/.local/bin/hermes", ...fixedDashboardArgs]
  },
  {
    label: "Linux native",
    platform: "linux",
    executable: { kind: "native", path: "/home/user/.local/bin/hermes" },
    expectedCommand: "/home/user/.local/bin/hermes",
    expectedArgs: fixedDashboardArgs
  },
  {
    label: "macOS native",
    platform: "darwin",
    executable: { kind: "native", path: "/opt/homebrew/bin/hermes" },
    expectedCommand: "/opt/homebrew/bin/hermes",
    expectedArgs: fixedDashboardArgs
  }
];

for (const testCase of platformCases) {
  const spec = launcherModule.buildDashboardLaunchSpec(
    testCase.platform,
    testCase.executable,
    fixedDashboardArgs
  );
  if (spec.command !== testCase.expectedCommand || JSON.stringify(spec.args) !== JSON.stringify(testCase.expectedArgs)) {
    failures.push(`${testCase.label} launch spec is incorrect: ${JSON.stringify(spec)}`);
  }
}

try {
  launcherModule.buildDashboardLaunchSpec(
    "darwin",
    { distro: "Ubuntu", kind: "wsl", path: "/usr/bin/hermes" },
    fixedDashboardArgs
  );
  failures.push("Non-Windows hosts must reject WSL launch specs.");
} catch {
  // Expected: WSL is a Windows-only transport.
}

requireTokens("Dashboard recovery client", recoveryClient, [
  'fetch("/api/hermes/dashboard"',
  '"X-Hermes-UI-Action": "start-dashboard"',
  'method: "POST"'
]);

requireTokens("Shared Dashboard recovery UI", recoveryState, [
  "Hermes Dashboard is not running",
  "Start Dashboard",
  "Start Hermes Dashboard?",
  "Confirm start",
  "Cancel",
  "Hermes Dashboard cannot provide",
  "await onRecovered()"
]);

requireTokens("Dashboard-backed views", configView + keysView + logsView + pluginsView, [
  'resourceName="Config"',
  'resourceName="Keys"',
  'resourceName="Logs"',
  'resourceName="Plugins"'
]);

if ((pluginsView + recoveryState).includes("hermes -z") || (pluginsView + recoveryState).includes("--oneshot")) {
  failures.push("Dashboard recovery must not send an agent prompt to start infrastructure.");
}

if (failures.length) {
  console.error("Hermes Dashboard recovery checks failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Hermes Dashboard recovery checks passed.");
