#!/usr/bin/env node

import { execFile } from "node:child_process";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const root = resolve(process.cwd());
const launcherPath = join(root, "scripts", "studio-launch.mjs");
const smokeBaseUrlPath = join(root, "scripts", "smoke-base-url.mjs");
const packagePath = join(root, "package.json");

const launcher = readFileSync(launcherPath, "utf8");
const smokeBaseUrl = readFileSync(smokeBaseUrlPath, "utf8");
const packageJson = JSON.parse(readFileSync(packagePath, "utf8"));

const results = [];

await main();

async function main() {
  await checkHelpCli();
  checkHelpSource();
  checkBaseUrlContract();
  checkJsonShapeContract();
  checkSecretRedactionContract();
  checkRecoveryContract();
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
    "--recovery"
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
  passIf("recovery-destructive-marked", /command:\s*"Remove-Item -Recurse -Force apps\\\\web\\\\\.next"[\s\S]*?destructive:\s*true/.test(launcher), "Windows cache cleanup is marked destructive.");
  passIf("recovery-rm-marked", /command:\s*"rm -rf apps\/web\/\.next"[\s\S]*?destructive:\s*true/.test(launcher), "POSIX cache cleanup is marked destructive.");
  passIf("recovery-note", launcher.includes("Print-only. Do not run until the server is stopped and the path is confirmed."), "Destructive recovery commands carry guarded notes.");
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
  passIf("safety-no-env-write", !launcher.includes(".env.local") || !/writeFile|appendFile/.test(launcher), "Launcher does not write apps/web/.env.local.");
  passIf("safety-no-hermes-home-write", !/join\([^)]*\.hermes|homedir\(\)|process\.env\.HOME/.test(launcher), "Launcher does not modify ~/.hermes.");
}

function checkPackageScripts() {
  passIf("package-studio-launch", packageJson.scripts?.["studio:launch"] === "node scripts/studio-launch.mjs", "package.json keeps studio:launch.");
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
