#!/usr/bin/env node

import { execFile } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const root = resolve(process.cwd());
const launcherPath = join(root, "scripts", "studio-launch.mjs");
const studioWebPath = join(root, "scripts", "studio-web-dev.mjs");
const smokeBaseUrlPath = join(root, "scripts", "smoke-base-url.mjs");
const packagePath = join(root, "package.json");
const healthyServerRunbookPath = join(root, "docs", "runbooks", "HEALTHY_STUDIO_SERVER_RECOVERY.md");
const studioWebDocPath = join(root, "docs", "packaging", "STUDIO_WEB_DEV_14J.md");

const launcher = readFileSync(launcherPath, "utf8");
const studioWeb = existsSync(studioWebPath) ? readFileSync(studioWebPath, "utf8") : "";
const smokeBaseUrl = readFileSync(smokeBaseUrlPath, "utf8");
const packageJson = JSON.parse(readFileSync(packagePath, "utf8"));
const healthyServerRunbook = existsSync(healthyServerRunbookPath)
  ? readFileSync(healthyServerRunbookPath, "utf8")
  : "";
const studioWebDoc = existsSync(studioWebDocPath)
  ? readFileSync(studioWebDocPath, "utf8")
  : "";

const results = [];

await main();

async function main() {
  await checkHelpCli();
  checkHelpSource();
  checkBaseUrlContract();
  checkJsonShapeContract();
  checkSecretRedactionContract();
  checkRecoveryContract();
  checkStudioWebContract();
  checkSafetyContract();
  checkPackageScripts();
  printResults();

  if (results.some((result) => result.status === "fail")) {
    process.exitCode = 1;
  }
}

async function checkHelpCli() {
  try {
    const { stdout, stderr } = await execFileAsync(process.execPath, [launcherPath, "--help"], {
      cwd: root,
      timeout: 10_000
    });
    const output = `${stdout}\n${stderr}`;
    passIf("help-cli-exits", true, "--help exits successfully.");
    passIf("help-cli-title", output.includes("Brain Memory Studio launcher"), "Help output has launcher title.");
    passIf("help-cli-no-diagnostics", !output.includes("Port diagnostics"), "Help exits before live diagnostics.");
    passIf("help-cli-safety", output.includes("The launcher does not kill processes"), "Help includes safety notice.");
  } catch (error) {
    passIf("help-cli-exits", false, `--help failed: ${error.message}`);
  }
}

function checkHelpSource() {
  const expectedFlags = [
    "--check",
    "--open",
    "--smoke",
    "--ui-smoke",
    "--require-hermes",
    "--require-brain-memory",
    "--base-url",
    "--no-port-scan",
    "--json",
    "--verbose",
    "--dev-command",
    "--recovery",
    "--print-recovery-plan"
  ];

  passIf("help-parser", launcher.includes("args.help") && launcher.includes("printHelp()"), "Launcher parses --help and calls printHelp.");
  passIf("help-function", /function printHelp\(\)/.test(launcher), "Launcher defines printHelp.");
  for (const flag of expectedFlags) {
    passIf(`help-flag-${flag}`, launcher.includes(flag), `Help/source includes ${flag}.`);
  }
}

function checkBaseUrlContract() {
  passIf("launcher-base-url-arg", launcher.includes('value === "--base-url"') && launcher.includes('value.startsWith("--base-url=")'), "Launcher accepts --base-url forms.");
  passIf("launcher-selected-base-url", launcher.includes("selectedBaseUrl: webUiUrl"), "Launcher reports selectedBaseUrl.");
  passIf("smoke-default-base-url", smokeBaseUrl.includes('DEFAULT_BASE_URL = "http://127.0.0.1:3000"'), "Smoke base URL helper keeps localhost default.");
  passIf("smoke-selected-base-url", smokeBaseUrl.includes("selectedBaseUrl(value)") && smokeBaseUrl.includes("trimSlash"), "Smoke base URL helper trims selected URL.");
}

function checkJsonShapeContract() {
  const expectedFields = [
    "selectedBaseUrl",
    "diagnostics",
    "ports",
    "healthyStudioPorts",
    "brokenStudioPorts",
    "staticChunkFailures",
    "recommendedActions",
    "recoveryCommands",
    "summary",
    "warnings",
    "failures"
  ];

  for (const field of expectedFields) {
    passIf(`json-field-${field}`, launcher.includes(field), `JSON report source includes ${field}.`);
  }
  passIf("json-mode", launcher.includes("JSON.stringify(report, null, 2)"), "Launcher supports --json report output.");
}

function checkSecretRedactionContract() {
  const expectedSecretShapes = [
    "apiKeySet",
    "gatewayMemoryApiKeySet",
    "uiApiKeySet",
    "legacyApiKeySet",
    "sanitizeBody"
  ];
  for (const shape of expectedSecretShapes) {
    passIf(`secret-shape-${shape}`, launcher.includes(shape), `Launcher uses ${shape}.`);
  }

  const rawSecretPrints = [
    /console\.log\([^)]*HERMES_API_KEY/s,
    /console\.log\([^)]*BRAIN_MEMORY_GATEWAY_MEMORY_API_KEY/s,
    /console\.log\([^)]*BRAIN_MEMORY_UI_API_KEY/s,
    /console\.log\([^)]*BRAIN_MEMORY_API_KEY/s
  ];
  passIf("secret-no-raw-console", rawSecretPrints.every((pattern) => !pattern.test(launcher)), "Launcher does not console.log raw secret env keys.");
  passIf("secret-hermes-boolean", launcher.includes("apiKeySet: Boolean(values.HERMES_API_KEY)"), "Hermes API key is reported as boolean presence.");
  passIf("secret-brain-memory-boolean", launcher.includes("gatewayMemoryApiKeySet: Boolean(values.BRAIN_MEMORY_GATEWAY_MEMORY_API_KEY)") && launcher.includes("uiApiKeySet: Boolean(values.BRAIN_MEMORY_UI_API_KEY)"), "Brain Memory keys are reported as boolean presence.");
}

function checkRecoveryContract() {
  passIf("recovery-print-only-text", launcher.includes("The launcher does not execute recovery commands."), "Recovery output states commands are print-only.");
  passIf("recovery-data-only", launcher.includes("function buildRecoveryCommands()"), "Recovery commands are built as report data.");
  passIf("recovery-runbook-exists", existsSync(healthyServerRunbookPath), "Healthy Studio server recovery runbook exists.");
  passIf("recovery-runbook-referenced", launcher.includes("HEALTHY_STUDIO_SERVER_RECOVERY.md"), "Launcher references the healthy-server recovery runbook.");
  passIf("recovery-no-healthy-message", launcher.includes("No healthy Studio server found"), "Launcher has no-healthy-server recovery wording.");
  passIf("recovery-print-plan-alias", launcher.includes("--print-recovery-plan") && launcher.includes("parsed.printRecoveryPlan = true"), "--print-recovery-plan aliases print-only recovery.");
  passIf("recovery-base-url-smoke-guidance", launcher.includes("Run browser smokes only after the selected base URL is healthy") && healthyServerRunbook.includes("Do not run smokes without `--base-url` while `3000` is stale."), "Launcher/runbook require healthy selected base URL before smokes.");
  passIf("recovery-destructive-marked", /command:\s*"Remove-Item -Recurse -Force apps\\\\web\\\\\.next"[\s\S]*?destructive:\s*true/.test(launcher), "Windows cache cleanup is marked destructive.");
  passIf("recovery-rm-marked", /command:\s*"rm -rf apps\/web\/\.next"[\s\S]*?destructive:\s*true/.test(launcher), "POSIX cache cleanup is marked destructive.");
  passIf("recovery-note", launcher.includes("Print-only. Do not run until the server is stopped and the path is confirmed."), "Destructive recovery commands carry guarded notes.");
  passIf("recovery-runbook-manual-stop", healthyServerRunbook.includes("The launcher does not stop processes automatically."), "Runbook keeps process stopping manual.");
  passIf("recovery-runbook-web-wrapper", healthyServerRunbook.includes("npm run studio:web -- --port 3002 --open --ui-smoke"), "Runbook documents the optional Web UI wrapper.");
  passIf("recovery-runbook-no-start-script", healthyServerRunbook.includes("There is currently no committed root or web `start` script"), "Runbook does not document unsupported npm start flow.");
}

function checkStudioWebContract() {
  const expectedFlags = [
    "--dry-run",
    "--port",
    "--host",
    "--open",
    "--smoke",
    "--ui-smoke",
    "--no-open",
    "--json",
    "--verbose",
    "--help"
  ];

  passIf("studio-web-script-exists", existsSync(studioWebPath), "Optional Web UI dev wrapper script exists.");
  passIf("studio-web-uses-spawn", studioWeb.includes("import { spawn }") && studioWeb.includes("spawn(command"), "Wrapper starts child processes with spawn.");
  passIf("studio-web-own-child", studioWeb.includes("startedChild") && studioWeb.includes('startedChild.kill("SIGINT")'), "Wrapper only signals the child process it started.");
  passIf("studio-web-start-command", studioWeb.includes('"run", "dev"') && studioWeb.includes("--hostname") && studioWeb.includes("--port"), "Wrapper starts the root npm dev script with host and port.");
  passIf("studio-web-refuses-stale", studioWeb.includes("stale-or-broken-studio") && studioWeb.includes("Refusing to start Web UI"), "Wrapper refuses stale/broken selected servers.");
  passIf("studio-web-dry-run", studioWeb.includes("--dry-run") && studioWeb.includes('action: "dry-run"'), "Wrapper supports dry-run mode.");
  passIf("studio-web-json-limited", studioWeb.includes("--json is supported with --dry-run"), "Wrapper documents JSON limitation for long-running logs.");
  passIf("studio-web-smoke-base-url", studioWeb.includes("smoke:mvp") && studioWeb.includes("smoke:ui") && studioWeb.includes("--base-url"), "Wrapper runs smokes against the selected base URL.");
  for (const flag of expectedFlags) {
    passIf(`studio-web-flag-${flag}`, studioWeb.includes(flag), `Wrapper source/help includes ${flag}.`);
  }
  passIf("studio-web-doc-exists", existsSync(studioWebDocPath), "Studio Web 14J documentation exists.");
  passIf("studio-web-doc-boundary", studioWebDoc.includes("does not manage Hermes") && studioWebDoc.includes("does not implement export/import"), "Studio Web docs state service and export/import boundaries.");
}

function checkSafetyContract() {
  const forbiddenWriteCalls = [
    /\bwriteFile(?:Sync)?\s*\(/,
    /\bappendFile(?:Sync)?\s*\(/,
    /\bmkdir(?:Sync)?\s*\(/,
    /\brm(?:Sync)?\s*\(/,
    /\bunlink(?:Sync)?\s*\(/,
    /\brename(?:Sync)?\s*\(/
  ];
  passIf("safety-no-file-mutation-calls", forbiddenWriteCalls.every((pattern) => !pattern.test(launcher)), "Launcher has no file mutation calls.");
  passIf("safety-studio-web-no-file-mutation-calls", forbiddenWriteCalls.every((pattern) => !pattern.test(studioWeb)), "Web wrapper has no file mutation calls.");

  const destructiveExecPatterns = [
    /execFileAsync\([^)]*Stop-Process/s,
    /execFileAsync\([^)]*taskkill/s,
    /execFileAsync\([^)]*Remove-Item/s,
    /execFileAsync\([^)]*rm\s+-rf/s,
    /execFileAsync\([^)]*systemctl/s,
    /execFileAsync\([^)]*docker\s+(?:start|stop|compose)/s,
    /execFileAsync\([^)]*hermes\s+(?:start|serve|run)/s
  ];
  passIf("safety-no-destructive-exec", destructiveExecPatterns.every((pattern) => !pattern.test(launcher)), "Launcher does not execute destructive recovery/service commands.");
  passIf("safety-studio-web-no-destructive-text", [
    "Stop-Process",
    "taskkill",
    "Remove-Item",
    "rm -rf",
    "docker",
    "systemctl",
    ".hermes"
  ].every((value) => !studioWeb.includes(value)), "Web wrapper does not contain destructive/service-management command text.");
  passIf("safety-no-env-write", !launcher.includes(".env.local") || !/writeFile|appendFile/.test(launcher), "Launcher does not write apps/web/.env.local.");
  passIf("safety-studio-web-no-env-write", !/\.env\.local|writeFile|appendFile/.test(studioWeb), "Web wrapper does not write env files.");
  passIf("safety-no-hermes-home-write", !/join\([^)]*\.hermes|homedir\(\)|process\.env\.HOME/.test(launcher), "Launcher does not modify ~/.hermes.");
}

function checkPackageScripts() {
  passIf("package-studio-launch", packageJson.scripts?.["studio:launch"] === "node scripts/studio-launch.mjs", "package.json keeps studio:launch.");
  passIf("package-studio-web", packageJson.scripts?.["studio:web"] === "node scripts/studio-web-dev.mjs", "package.json exposes studio:web.");
  passIf("package-studio-web-3002", packageJson.scripts?.["studio:web:3002"] === "node scripts/studio-web-dev.mjs --port 3002", "package.json exposes studio:web:3002.");
  passIf("package-contract-check", packageJson.scripts?.["check:studio-launch"] === "node scripts/check-studio-launch-contract.mjs", "package.json exposes check:studio-launch.");
}

function passIf(name, ok, message) {
  results.push({
    message,
    name,
    status: ok ? "pass" : "fail"
  });
}

function printResults() {
  console.log("Studio launcher contract checks");
  console.log("===============================");
  for (const result of results) {
    console.log(`${result.status === "pass" ? "[ok]" : "[!!]"} ${result.name}: ${result.message}`);
  }
  const passed = results.filter((result) => result.status === "pass").length;
  const failed = results.filter((result) => result.status === "fail").length;
  console.log("");
  console.log(`Summary: ${passed} passed, ${failed} failed.`);
}
