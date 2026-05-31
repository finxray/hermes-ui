#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(process.cwd());
const packageJson = readJson("package.json");
const results = [];

const docs = {
  readiness: readText("docs/packaging/PACKAGING_READINESS_14K.md"),
  readme: readText("README.md"),
  roadmap: readText("ROADMAP.md"),
  packagingModes: readText("docs/packaging/PACKAGING_MODES.md"),
  oneCommandPlan: readText("docs/packaging/ONE_COMMAND_CLI_PLAN.md"),
  localStartupGuide: readText("docs/packaging/LOCAL_STARTUP_GUIDE.md"),
  mvpRunbook: readText("docs/runbooks/MVP_LOCAL_LAUNCH_RUNBOOK.md"),
  healthyServerRunbook: readText("docs/runbooks/HEALTHY_STUDIO_SERVER_RECOVERY.md"),
  studioLauncher14A: readText("docs/packaging/STUDIO_LAUNCHER_14A.md"),
  studioLauncher14H: readText("docs/packaging/STUDIO_LAUNCHER_14H_CONTRACT_TESTS.md"),
  studioLauncher14I: readText("docs/packaging/STUDIO_LAUNCHER_14I_HEALTHY_SERVER_RECOVERY.md"),
  studioWeb14J: readText("docs/packaging/STUDIO_WEB_DEV_14J.md")
};

const scripts = {
  studioLaunch: readText("scripts/studio-launch.mjs"),
  studioWeb: readText("scripts/studio-web-dev.mjs"),
  mvpSmoke: readText("scripts/mvp-smoke.mjs"),
  uiSmoke: readText("scripts/ui-interaction-smoke.mjs")
};

main();

function main() {
  checkRequiredDocs();
  checkPackageScripts();
  checkSmokeScripts();
  checkEnvExamples();
  checkReadmeLinks();
  checkReadinessDoc();
  checkPackagingDocs();
  checkNoPrematureClaims();
  checkSecretSafety();
  checkLauncherSafety();
  printResults();

  if (results.some((result) => result.status === "fail")) {
    process.exitCode = 1;
  }
}

function checkRequiredDocs() {
  const required = [
    "docs/packaging/PACKAGING_READINESS_14K.md",
    "docs/packaging/PACKAGING_MODES.md",
    "docs/packaging/ONE_COMMAND_CLI_PLAN.md",
    "docs/packaging/LOCAL_STARTUP_GUIDE.md",
    "docs/runbooks/MVP_LOCAL_LAUNCH_RUNBOOK.md",
    "docs/runbooks/HEALTHY_STUDIO_SERVER_RECOVERY.md",
    "docs/packaging/STUDIO_LAUNCHER_14A.md",
    "docs/packaging/STUDIO_LAUNCHER_14B_PORT_DIAGNOSTICS.md",
    "docs/packaging/STUDIO_LAUNCHER_14C_GUIDED_RECOVERY.md",
    "docs/packaging/STUDIO_LAUNCHER_14H_CONTRACT_TESTS.md",
    "docs/packaging/STUDIO_LAUNCHER_14I_HEALTHY_SERVER_RECOVERY.md",
    "docs/packaging/STUDIO_WEB_DEV_14J.md",
    "docs/checkpoints/MVP_CHECKPOINT_12A.md",
    "docs/checkpoints/MVP_SMOKE_12B.md",
    "docs/checkpoints/UI_INTERACTION_SMOKE_12E.md"
  ];

  for (const path of required) {
    passIf(`doc:${path}`, existsSync(join(root, path)), `${path} exists.`);
  }
}

function checkPackageScripts() {
  const expected = {
    "build": "npm run build -w @hermes-ui/web",
    "check:agent-activity": "node scripts/check-agent-activity-events.mjs",
    "check:agent-activity-rendering": "node scripts/check-agent-activity-rendering.mjs",
    "check:brain-memory-client": "node scripts/check-brain-memory-client-shapes.mjs",
    "check-message-rendering": "node scripts/check-message-rendering.mjs",
    "check:packaging": "node scripts/check-packaging-readiness.mjs",
    "check:studio-launch": "node scripts/check-studio-launch-contract.mjs",
    "check:ui-structure": "node scripts/check-ui-structure.mjs",
    "check:workspace-state": "node --no-warnings scripts/check-workspace-state.mjs",
    "studio:launch": "node scripts/studio-launch.mjs",
    "studio:web": "node scripts/studio-web-dev.mjs",
    "typecheck": "npm run typecheck -w @hermes-ui/web"
  };

  for (const [name, command] of Object.entries(expected)) {
    passIf(`script:${name}`, packageJson.scripts?.[name] === command, `${name} is wired to ${command}.`);
  }

  const release = packageJson.scripts?.["release:check"] || "";
  const releaseParts = [
    "npm run check:packaging",
    "npm run check:studio-launch",
    "npm run check:workspace-state",
    "npm run check:brain-memory-client",
    "npm run check:agent-activity",
    "npm run check:agent-activity-rendering",
    "npm run check-message-rendering",
    "npm run check:ui-structure",
    "npm run typecheck",
    "npm run build",
    "npm audit --audit-level=moderate"
  ];
  passIf("script:release:check", Boolean(release), "release:check exists.");
  for (const part of releaseParts) {
    passIf(`release-check:${part}`, release.includes(part), `release:check includes ${part}.`);
  }
  passIf(
    "release-check:no-browser-smoke",
    !/\bsmoke:ui\b|\bsmoke:mvp\b/.test(release),
    "release:check does not require browser or route smokes by default."
  );

  const scriptNames = Object.keys(packageJson.scripts || {});
  const exportImportScripts = scriptNames.filter((name) => /\b(export|import)\b|:export|:import|export:|import:/i.test(name));
  passIf(
    "scripts:no-export-import",
    exportImportScripts.length === 0,
    exportImportScripts.length === 0
      ? "No export/import npm script is exposed."
      : `Unexpected export/import scripts: ${exportImportScripts.join(", ")}.`
  );

  const productionInstallers = scriptNames.filter((name) => /installer|one-command|bootstrap|setup:prod|release:install/i.test(name));
  passIf(
    "scripts:no-production-installer",
    productionInstallers.length === 0,
    productionInstallers.length === 0
      ? "No production installer or one-command distribution script is exposed."
      : `Unexpected installer-like scripts: ${productionInstallers.join(", ")}.`
  );
}

function checkSmokeScripts() {
  const requiredScripts = [
    "scripts/mvp-smoke.mjs",
    "scripts/ui-interaction-smoke.mjs",
    "scripts/markdown-fixture-smoke.mjs",
    "scripts/markdown-long-fixture-smoke.mjs",
    "scripts/smoke-base-url.mjs",
    "scripts/check-studio-launch-contract.mjs",
    "scripts/studio-web-dev.mjs"
  ];
  for (const path of requiredScripts) {
    passIf(`file:${path}`, existsSync(join(root, path)), `${path} exists.`);
  }
}

function checkEnvExamples() {
  const examples = [
    "env/web-ui-only.env.example",
    "env/web-ui-with-hermes.env.example",
    "env/attach-brain-memory-later.env.example",
    "env/bundle-with-brain-memory.env.example"
  ];
  for (const path of examples) {
    passIf(`env:${path}`, existsSync(join(root, path)), `${path} exists.`);
  }
}

function checkReadmeLinks() {
  const expected = [
    "docs/packaging/PACKAGING_MODES.md",
    "docs/runbooks/MVP_LOCAL_LAUNCH_RUNBOOK.md",
    "docs/packaging/PACKAGING_READINESS_14K.md",
    "docs/packaging/STUDIO_WEB_DEV_14J.md",
    "docs/packaging/STUDIO_LAUNCHER_14H_CONTRACT_TESTS.md"
  ];
  for (const link of expected) {
    passIf(`readme-link:${link}`, docs.readme.includes(link), `README links ${link}.`);
  }
}

function checkReadinessDoc() {
  const expectedTerms = [
    "Current Readiness Summary",
    "Packaging Modes",
    "Current Commands",
    "Release Gate Checklist",
    "Optional Live-Service Gates",
    "Deferred / Not Claimable Yet",
    "Safety Boundaries",
    "production installer",
    "final one-command GitHub bundle",
    "auto-install Hermes",
    "auto-install Brain Memory",
    "export/import",
    "Browser code talks only to the Next.js BFF"
  ];
  for (const term of expectedTerms) {
    passIf(`readiness:${term}`, docs.readiness.includes(term), `Readiness manifest includes ${term}.`);
  }
}

function checkPackagingDocs() {
  passIf("modes:web-ui-standalone", docs.packagingModes.includes("Web UI Standalone"), "Packaging modes document Web UI standalone.");
  passIf("modes:brain-memory-standalone", docs.packagingModes.includes("Brain Memory Standalone"), "Packaging modes document Brain Memory standalone.");
  passIf("modes:bundle-future", docs.packagingModes.includes("future") && docs.packagingModes.includes("not implemented"), "Packaging modes label bundle as future/not implemented.");
  passIf("one-command:future-plan", docs.oneCommandPlan.includes("future plan") && docs.oneCommandPlan.includes("not an implemented production CLI"), "One-command CLI is documented as future only.");
  passIf("one-command:14k-checkpoint", docs.oneCommandPlan.includes("Slice 14K"), "One-command CLI plan records the 14K checkpoint.");
  passIf("runbook:release-check", docs.mvpRunbook.includes("npm run release:check"), "MVP runbook documents release:check.");
  passIf("startup:studio-web", docs.localStartupGuide.includes("npm run studio:web"), "Local startup guide uses studio:web.");
}

function checkNoPrematureClaims() {
  const claimTexts = [
    docs.readme,
    docs.packagingModes,
    docs.oneCommandPlan,
    docs.readiness,
    docs.mvpRunbook
  ].join("\n");

  const forbiddenClaims = [
    /production installer is implemented/i,
    /one-command GitHub distribution is implemented/i,
    /automatically installs Hermes/i,
    /automatically installs Brain Memory/i,
    /export\/import is implemented/i
  ];

  passIf(
    "claims:no-premature-production-claims",
    forbiddenClaims.every((pattern) => !pattern.test(claimTexts)),
    "Docs do not claim deferred production packaging features are implemented."
  );
}

function checkSecretSafety() {
  const filesToScan = {
    "README.md": docs.readme,
    "docs/packaging/PACKAGING_READINESS_14K.md": docs.readiness,
    "docs/packaging/PACKAGING_MODES.md": docs.packagingModes,
    "docs/packaging/ONE_COMMAND_CLI_PLAN.md": docs.oneCommandPlan,
    "docs/runbooks/MVP_LOCAL_LAUNCH_RUNBOOK.md": docs.mvpRunbook,
    "scripts/studio-launch.mjs": scripts.studioLaunch,
    "scripts/studio-web-dev.mjs": scripts.studioWeb,
    "scripts/mvp-smoke.mjs": scripts.mvpSmoke,
    "scripts/ui-interaction-smoke.mjs": scripts.uiSmoke
  };

  const leaked = [];
  for (const [path, text] of Object.entries(filesToScan)) {
    for (const line of text.split(/\r?\n/)) {
      if (looksLikeSecretLeak(line)) {
        leaked.push(`${path}: ${line.trim().slice(0, 120)}`);
      }
    }
  }

  passIf(
    "secrets:no-obvious-values",
    leaked.length === 0,
    leaked.length === 0 ? "No obvious secret values found in key docs/scripts." : `Possible secret values: ${leaked.join(" | ")}`
  );
}

function looksLikeSecretLeak(line) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("-") || trimmed.startsWith("|")) {
    return false;
  }
  if (/<redacted|<tenant-bound|placeholder|\[redacted\]|not set|set" : "not set|Boolean\(/i.test(trimmed)) {
    return false;
  }
  if (/apiKeySet|gatewayMemoryApiKeySet|uiApiKeySet|legacyApiKeySet/i.test(trimmed)) {
    return false;
  }
  if (/Authorization.*Bearer\s+\$\{|Bearer\s+\$\{|Bearer `|Bearer \${/i.test(trimmed)) {
    return false;
  }
  if (/\bBearer\s+[A-Za-z0-9._~+/=-]{20,}/i.test(trimmed)) {
    return true;
  }
  if (/\b[A-Z0-9_]*(API_KEY|TOKEN|SECRET|PASSWORD)\b\s*[:=]\s*["']?[A-Za-z0-9._~+/=-]{16,}/i.test(trimmed)) {
    return true;
  }
  return false;
}

function checkLauncherSafety() {
  const launcher = scripts.studioLaunch;
  const web = scripts.studioWeb;
  const mutationCalls = [
    /\bwriteFile(?:Sync)?\s*\(/,
    /\bappendFile(?:Sync)?\s*\(/,
    /\brm(?:Sync)?\s*\(/,
    /\bunlink(?:Sync)?\s*\(/,
    /\brename(?:Sync)?\s*\(/
  ];
  passIf("launcher:no-file-mutation", mutationCalls.every((pattern) => !pattern.test(launcher)), "studio:launch has no file mutation calls.");
  passIf("studio-web:no-file-mutation", mutationCalls.every((pattern) => !pattern.test(web)), "studio:web has no file mutation calls.");

  const destructiveExec = [
    /execFileAsync\([^)]*Stop-Process/s,
    /execFileAsync\([^)]*taskkill/s,
    /execFileAsync\([^)]*Remove-Item/s,
    /execFileAsync\([^)]*rm\s+-rf/s,
    /execFileAsync\([^)]*docker\s+(?:start|stop|compose)/s,
    /execFileAsync\([^)]*systemctl/s
  ];
  passIf("launcher:no-destructive-exec", destructiveExec.every((pattern) => !pattern.test(launcher)), "studio:launch does not execute destructive/service commands.");
  const webHasOnlyOwnTaskkill = !web.includes("taskkill") ||
    (web.includes("taskkill.exe") && web.includes("startedChild.pid"));
  passIf("studio-web:no-destructive-text", [
    "Stop-Process",
    "Remove-Item",
    "rm -rf",
    "docker",
    "systemctl",
    ".hermes"
  ].every((value) => !web.includes(value)) && webHasOnlyOwnTaskkill, "studio:web does not contain unrelated service-management/destructive command text.");
  passIf("studio-web:own-child-only", web.includes("startedChild") && web.includes('startedChild.kill("SIGINT")'), "studio:web only signals the child process it starts.");
}

function readText(path) {
  const absolute = join(root, path);
  return existsSync(absolute) ? readFileSync(absolute, "utf8") : "";
}

function readJson(path) {
  return JSON.parse(readFileSync(join(root, path), "utf8"));
}

function passIf(name, ok, message) {
  results.push({
    message,
    name,
    status: ok ? "pass" : "fail"
  });
}

function printResults() {
  console.log("Packaging readiness checks");
  console.log("==========================");
  for (const result of results) {
    console.log(`${result.status === "pass" ? "[ok]" : "[!!]"} ${result.name}: ${result.message}`);
  }
  const passed = results.filter((result) => result.status === "pass").length;
  const failed = results.filter((result) => result.status === "fail").length;
  console.log("");
  console.log(`Summary: ${passed} passed, ${failed} failed.`);
}
