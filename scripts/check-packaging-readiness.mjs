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
  packagingIndex: readText("docs/packaging/README.md"),
  localBundleChecklist: readText("docs/packaging/LOCAL_BUNDLE_CHECKLIST_14O.md"),
  packagingModes: readText("docs/packaging/PACKAGING_MODES.md"),
  oneCommandPlan: readText("docs/packaging/ONE_COMMAND_CLI_PLAN.md"),
  localStartupGuide: readText("docs/packaging/LOCAL_STARTUP_GUIDE.md"),
  mvpRunbook: readText("docs/runbooks/MVP_LOCAL_LAUNCH_RUNBOOK.md"),
  healthyServerRunbook: readText("docs/runbooks/HEALTHY_STUDIO_SERVER_RECOVERY.md"),
  studioLauncher14A: readText("docs/packaging/STUDIO_LAUNCHER_14A.md"),
  studioLauncher14H: readText("docs/packaging/STUDIO_LAUNCHER_14H_CONTRACT_TESTS.md"),
  studioLauncher14I: readText("docs/packaging/STUDIO_LAUNCHER_14I_HEALTHY_SERVER_RECOVERY.md"),
  studioWeb14J: readText("docs/packaging/STUDIO_WEB_DEV_14J.md"),
  mvpCompletionAudit17A: readText("docs/release/MVP_COMPLETION_AUDIT_17A.md"),
  finalMvpLiveSmokeChecklist17A: readText("docs/release/FINAL_MVP_LIVE_SMOKE_CHECKLIST_17A.md"),
  releaseDecision17A: readText("docs/release/RELEASE_DECISION_17A.md"),
  mvpComprehensiveE2e17C: readText("docs/release/MVP_COMPREHENSIVE_E2E_17C.md"),
  mvpLocalRcReleaseNotes17D: readText("docs/release/MVP_LOCAL_RC_RELEASE_NOTES_17D.md"),
  localHandoffManifest17D: readText("docs/packaging/LOCAL_HANDOFF_MANIFEST_17D.md"),
  privateDeveloperHandoff17D: readText("docs/release/PRIVATE_DEVELOPER_HANDOFF_17D.md")
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
    "docs/packaging/README.md",
    "docs/packaging/LOCAL_BUNDLE_CHECKLIST_14O.md",
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
    "docs/checkpoints/UI_INTERACTION_SMOKE_12E.md",
    "docs/release/MVP_COMPLETION_AUDIT_17A.md",
    "docs/release/FINAL_MVP_LIVE_SMOKE_CHECKLIST_17A.md",
    "docs/release/RELEASE_DECISION_17A.md",
    "docs/release/MVP_COMPREHENSIVE_E2E_17C.md",
    "docs/release/MVP_LOCAL_RC_RELEASE_NOTES_17D.md",
    "docs/packaging/LOCAL_HANDOFF_MANIFEST_17D.md",
    "docs/release/PRIVATE_DEVELOPER_HANDOFF_17D.md"
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
    "docs/packaging/README.md",
    "docs/packaging/LOCAL_BUNDLE_CHECKLIST_14O.md",
    "docs/runbooks/MVP_LOCAL_LAUNCH_RUNBOOK.md",
    "docs/packaging/PACKAGING_READINESS_14K.md",
    "docs/release/MVP_COMPLETION_AUDIT_17A.md",
    "docs/release/FINAL_MVP_LIVE_SMOKE_CHECKLIST_17A.md",
    "docs/release/MVP_COMPREHENSIVE_E2E_17C.md",
    "docs/release/MVP_LOCAL_RC_RELEASE_NOTES_17D.md",
    "docs/packaging/LOCAL_HANDOFF_MANIFEST_17D.md",
    "docs/release/PRIVATE_DEVELOPER_HANDOFF_17D.md"
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
  passIf("packaging-index:local-bundle", docs.packagingIndex.includes("LOCAL_BUNDLE_CHECKLIST_14O.md"), "Packaging index links the local bundle checklist.");
  passIf("packaging-index:one-command-future", docs.packagingIndex.includes("ONE_COMMAND_CLI_PLAN.md") && /not\s+implemented\s+yet/i.test(docs.packagingIndex), "Packaging index labels one-command CLI as future.");
  passIf("local-bundle:modes", docs.localBundleChecklist.includes("Web UI standalone / mock Brain Memory") && docs.localBundleChecklist.includes("Web UI + Hermes") && docs.localBundleChecklist.includes("Web UI + attach-later Brain Memory"), "Local bundle checklist summarizes current supported modes.");
  passIf("local-bundle:quick-path", docs.localBundleChecklist.includes("npm run studio:web -- --port 3002 --open") && docs.localBundleChecklist.includes("npm run smoke:ui -- --base-url http://127.0.0.1:3002"), "Local bundle checklist includes the 3002 quick path.");
  passIf("local-bundle:brain-memory-mock", docs.localBundleChecklist.includes("acceptable for the UI and checks to report Brain Memory as mock"), "Local bundle checklist accepts mock/unconfigured Brain Memory for MVP.");
  passIf("local-bundle:release-gate", docs.localBundleChecklist.includes("npm run release:check") && /browser\s+smokes\s+or\s+live\s+services/i.test(docs.localBundleChecklist), "Local bundle checklist documents release gate scope.");
  passIf("local-bundle:deferred", docs.localBundleChecklist.includes("production installer") && docs.localBundleChecklist.includes("final one-command GitHub bundle") && docs.localBundleChecklist.includes("export/import"), "Local bundle checklist keeps deferred items explicit.");
  passIf("one-command:future-plan", docs.oneCommandPlan.includes("future plan") && docs.oneCommandPlan.includes("not an implemented production CLI"), "One-command CLI is documented as future only.");
  passIf("one-command:14k-checkpoint", docs.oneCommandPlan.includes("Slice 14K"), "One-command CLI plan records the 14K checkpoint.");
  passIf("runbook:release-check", docs.mvpRunbook.includes("npm run release:check"), "MVP runbook documents release:check.");
  passIf("startup:studio-web", docs.localStartupGuide.includes("npm run studio:web"), "Local startup guide uses studio:web.");
  checkMvpCompletionDocs();
  checkLocalHandoffDocs();
}

function checkLocalHandoffDocs() {
  const releaseNotes = docs.mvpLocalRcReleaseNotes17D;
  const manifest = docs.localHandoffManifest17D;
  const handoff = docs.privateDeveloperHandoff17D;

  passIf(
    "handoff-release-notes:release-name",
    releaseNotes.includes("v0.1.0-local-rc.1") && releaseNotes.includes("local/demo RC"),
    "17D release notes include local RC release name and posture."
  );
  passIf(
    "handoff-release-notes:not-production",
    /not\s+production-ready/i.test(releaseNotes) &&
      /not\s+a\s+public\s+beta/i.test(releaseNotes) &&
      /not\s+the\s+final\s+one-command/i.test(releaseNotes),
    "17D release notes state this is not production/public/final one-command."
  );
  passIf(
    "handoff-release-notes:supported-modes",
    releaseNotes.includes("Web UI local/demo with mock Brain Memory") &&
      releaseNotes.includes("Web UI + Hermes live") &&
      releaseNotes.includes("Brain Memory attach-later") &&
      releaseNotes.includes("Runs diagnostics/guarded experimental"),
    "17D release notes list supported modes."
  );
  passIf(
    "handoff-release-notes:deferred-boundaries",
    releaseNotes.includes("export/import") &&
      releaseNotes.includes("Production Runs remains deferred") &&
      releaseNotes.includes("memory mutation/admin") &&
      releaseNotes.includes("Browser code calls only the Web UI BFF"),
    "17D release notes keep deferred features and BFF boundaries explicit."
  );

  passIf(
    "handoff-manifest:commands",
    manifest.includes("npm install") &&
      manifest.includes("npm run studio:web -- --port 3002 --open") &&
      manifest.includes("npm run studio:launch -- --check --base-url http://127.0.0.1:3002") &&
      manifest.includes("npm run release:check") &&
      manifest.includes("npm run smoke:ui:send") &&
      manifest.includes("npm run smoke:ui:stop"),
    "17D handoff manifest includes key commands."
  );
  passIf(
    "handoff-manifest:do-not-commit",
    manifest.includes("apps/web/.env.local") &&
      manifest.includes("API keys") &&
      manifest.includes(".codex-smoke-logs") &&
      manifest.includes(".next"),
    "17D handoff manifest lists files that must not be committed."
  );
  passIf(
    "handoff-manifest:caveats",
    manifest.includes("Stale Next servers") &&
      manifest.includes("healthy selected base URL") &&
      manifest.includes("Brain Memory live claims require") &&
      manifest.includes("Runs is experimental/diagnostic only"),
    "17D handoff manifest documents operational caveats."
  );
  passIf(
    "handoff-manifest:not-release-artifact",
    manifest.includes("does not create a package archive") &&
      manifest.includes("implement export/import") &&
      manifest.includes("change runtime behavior"),
    "17D handoff manifest avoids archive/export/runtime claims."
  );

  passIf(
    "private-handoff:setup-and-smoke",
    handoff.includes("npm install") &&
      handoff.includes("npm run studio:web -- --port 3002 --open") &&
      handoff.includes("npm run smoke:ui -- --base-url http://127.0.0.1:3002"),
    "17D private developer handoff includes setup and first smoke path."
  );
  passIf(
    "private-handoff:attach-services",
    handoff.includes("Attach Hermes") &&
      handoff.includes("Attach Brain Memory Later") &&
      handoff.includes("BFF env/key posture"),
    "17D private developer handoff explains Hermes and Brain Memory attachment."
  );
  passIf(
    "private-handoff:do-not-touch",
    handoff.includes("direct browser-to-Hermes") &&
      handoff.includes("memory mutation/admin controls") &&
      handoff.includes("production Runs default") &&
      handoff.includes("secrets or env files"),
    "17D private developer handoff lists protected areas."
  );
}

function checkMvpCompletionDocs() {
  const auditTerms = [
    "MVP Completion Audit 17A",
    "conditionally complete",
    "Production chat still uses `/api/hermes/chat/stream`",
    "Runs production implementation remains deferred/post-MVP",
    "Brain Memory UI remains read-only for MVP",
    "No Agent access selector UI is part of MVP",
    "No approval buttons are part of MVP",
    "No memory mutation/admin controls are part of MVP",
    "No export/import runtime is part of MVP",
    "Slice 17B"
  ];
  for (const term of auditTerms) {
    passIf(`mvp-audit:${term}`, docs.mvpCompletionAudit17A.includes(term), `MVP completion audit includes ${term}.`);
  }

  const checklistTerms = [
    "Final MVP Live Smoke Checklist 17A",
    "Default Non-Live Checks",
    "Browser Checks With Healthy Selected Web UI",
    "Live Hermes And Brain Memory Checks",
    "Runs Experimental Checks, Optional/Post-MVP",
    "production chat still uses `/api/hermes/chat/stream`",
    "production Runs implementation remains deferred",
    "no Agent access selector UI exists",
    "no approval buttons exist"
  ];
  for (const term of checklistTerms) {
    passIf(`mvp-checklist:${term}`, docs.finalMvpLiveSmokeChecklist17A.includes(term), `Final smoke checklist includes ${term}.`);
  }

  for (const term of [
    "Release Decision 17A",
    "Conditionally complete",
    "Production chat still uses the session stream",
    "Runs production implementation remains deferred/post-MVP",
    "Slice 17B"
  ]) {
    passIf(`release-17a:${term}`, docs.releaseDecision17A.includes(term), `17A release decision includes ${term}.`);
  }
}

function checkNoPrematureClaims() {
  const claimTexts = [
    docs.readme,
    docs.packagingIndex,
    docs.localBundleChecklist,
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
    "docs/packaging/README.md": docs.packagingIndex,
    "docs/packaging/LOCAL_BUNDLE_CHECKLIST_14O.md": docs.localBundleChecklist,
    "docs/packaging/PACKAGING_READINESS_14K.md": docs.readiness,
    "docs/packaging/PACKAGING_MODES.md": docs.packagingModes,
    "docs/packaging/ONE_COMMAND_CLI_PLAN.md": docs.oneCommandPlan,
    "docs/packaging/LOCAL_HANDOFF_MANIFEST_17D.md": docs.localHandoffManifest17D,
    "docs/runbooks/MVP_LOCAL_LAUNCH_RUNBOOK.md": docs.mvpRunbook,
    "docs/release/MVP_LOCAL_RC_RELEASE_NOTES_17D.md": docs.mvpLocalRcReleaseNotes17D,
    "docs/release/PRIVATE_DEVELOPER_HANDOFF_17D.md": docs.privateDeveloperHandoff17D,
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
