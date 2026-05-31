#!/usr/bin/env node

const EXPECTED_TEXT = "HERMES_RUNS_EXPERIMENTAL_CHAT_OK";
const args = parseArgs(process.argv.slice(2));
const baseUrl = args.baseUrl || process.env.STUDIO_WEB_UI_URL || "http://127.0.0.1:3000";
const probeUrl = new URL("/api/hermes/runs/experimental-chat", ensureTrailingSlash(baseUrl)).toString();
const message = args.message || `Reply exactly: ${EXPECTED_TEXT}`;

const result = await postProbe(probeUrl, {
  context: makeContext(args),
  expectedText: EXPECTED_TEXT,
  message,
  model: null,
  provider: null,
  recentMessages: []
});

if (args.expectDisabled) {
  if (result.status === 403 && result.body?.mode === "disabled") {
    printDisabledReport(result.body, result.status);
    process.exit(0);
  }
  console.error(
    `Experimental Runs disabled-state check failed: expected HTTP 403 mode=disabled, got HTTP ${result.status || "none"} mode=${result.body?.mode || "none"}.`
  );
  process.exit(1);
}

if (!result.ok) {
  const message = result.error ?? `Could not reach ${probeUrl}.`;
  if (args.requireHermes) {
    console.error(`Experimental Hermes Runs chat failed: ${message}`);
    process.exit(1);
  }
  console.warn(`Experimental Hermes Runs chat skipped: ${message}`);
  process.exit(0);
}

const report = result.body;
printReport(report);

if (report?.ok && report.mode === "success" && outputIncludesExpected(report)) {
  process.exit(0);
}

const blocker = report?.error?.message || "Experimental Hermes Runs chat did not pass.";
if (args.requireHermes || report?.mode === "failed") {
  console.error(`Experimental Hermes Runs chat failed: ${blocker}`);
  process.exit(1);
}

console.warn(`Experimental Hermes Runs chat skipped: ${blocker}`);
process.exit(0);

function parseArgs(argv) {
  const parsed = {
    baseUrl: "",
    expectDisabled: false,
    message: "",
    projectId: "project-runs-experimental-16g",
    requireHermes: false,
    sessionId: "session-runs-experimental-16g",
    tenantId: "local-dev"
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--expect-disabled") {
      parsed.expectDisabled = true;
    } else if (arg === "--require-hermes") {
      parsed.requireHermes = true;
    } else if (arg === "--base-url") {
      parsed.baseUrl = argv[index + 1] ?? "";
      index += 1;
    } else if (arg.startsWith("--base-url=")) {
      parsed.baseUrl = arg.slice("--base-url=".length);
    } else if (arg === "--message") {
      parsed.message = argv[index + 1] ?? "";
      index += 1;
    } else if (arg.startsWith("--message=")) {
      parsed.message = arg.slice("--message=".length);
    } else if (arg === "--tenant-id") {
      parsed.tenantId = sanitizeId(argv[index + 1], parsed.tenantId);
      index += 1;
    } else if (arg.startsWith("--tenant-id=")) {
      parsed.tenantId = sanitizeId(arg.slice("--tenant-id=".length), parsed.tenantId);
    } else if (arg === "--project-id") {
      parsed.projectId = sanitizeId(argv[index + 1], parsed.projectId);
      index += 1;
    } else if (arg.startsWith("--project-id=")) {
      parsed.projectId = sanitizeId(arg.slice("--project-id=".length), parsed.projectId);
    } else if (arg === "--session-id") {
      parsed.sessionId = sanitizeId(argv[index + 1], parsed.sessionId);
      index += 1;
    } else if (arg.startsWith("--session-id=")) {
      parsed.sessionId = sanitizeId(arg.slice("--session-id=".length), parsed.sessionId);
    }
  }
  return parsed;
}

async function postProbe(url, body) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45_000);
  try {
    const response = await fetch(url, {
      body: JSON.stringify(body),
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      method: "POST",
      signal: controller.signal
    });
    const responseBody = await response.json().catch(() => null);
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        body: responseBody,
        error: `BFF route returned HTTP ${response.status}.`
      };
    }
    return { ok: true, status: response.status, body: responseBody };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      body: null,
      error: error instanceof Error ? error.message : "Unknown fetch error."
    };
  } finally {
    clearTimeout(timeout);
  }
}

function printDisabledReport(report, status) {
  console.log("Experimental Hermes Runs chat disabled-state result:");
  console.log(`- httpStatus: ${status}`);
  console.log(`- mode: ${report?.mode ?? "none"}`);
  console.log(`- flag: ${report?.featureFlag ?? "none"}`);
  console.log(`- defaultEnabled: ${String(report?.defaultEnabled ?? false)}`);
  console.log(`- productionChatUntouched: ${String(report?.safety?.productionChatUntouched ?? false)}`);
  console.log(`- error: ${report?.error?.message ?? "none"}`);
}

function printReport(report) {
  if (!report) {
    console.log("Experimental Hermes Runs chat returned no JSON body.");
    return;
  }
  console.log("Experimental Hermes Runs chat result:");
  console.log(`- mode: ${report.mode}`);
  console.log(`- ok: ${String(report.ok)}`);
  console.log(`- flagEnabled: ${String(report.experimental?.enabled ?? false)}`);
  console.log(`- defaultEnabled: ${String(report.experimental?.defaultEnabled ?? false)}`);
  console.log(`- prompt: ${report.prompt}`);
  console.log(`- expectedText: ${report.expectedText}`);
  console.log(`- runId: ${report.runId ?? "none"}`);
  console.log(`- sessionId: ${report.sessionId ?? "none"}`);
  console.log(`- projectStableKey: ${report.context?.projectStableKey ?? "none"}`);
  console.log(`- sessionStableKey: ${report.context?.sessionStableKey ?? "none"}`);
  console.log(`- status: ${report.status ?? "none"}`);
  console.log(`- eventTypes: ${(report.eventTypes ?? []).join(", ") || "none"}`);
  console.log(`- events: ${report.counts?.events ?? 0}`);
  console.log(`- messageDeltaEvents: ${report.counts?.messageDeltaEvents ?? 0}`);
  console.log(`- toolEvents: ${report.counts?.toolEvents ?? 0}`);
  console.log(`- brainMemoryToolEvents: ${report.counts?.brainMemoryToolEvents ?? 0}`);
  console.log(`- approvalEvents: ${report.counts?.approvalEvents ?? 0}`);
  console.log(`- assistantTextPreview: ${report.assistantTextPreview || "none"}`);
  console.log(`- outputPreview: ${report.outputPreview || "none"}`);
  console.log(`- browserDirectHermes: ${String(report.safety?.browserDirectHermes ?? true)}`);
  console.log(`- browserDirectBrainMemory: ${String(report.safety?.browserDirectBrainMemory ?? true)}`);
  console.log(`- directStorageAccess: ${String(report.safety?.directStorageAccess ?? true)}`);
  console.log(`- productionChatUntouched: ${String(report.safety?.productionChatUntouched ?? false)}`);
  if (report.error) {
    console.log(`- error: ${report.error.message}`);
  }
}

function outputIncludesExpected(report) {
  const text = `${report.assistantTextPreview || ""}\n${report.outputPreview || ""}`;
  return text.includes(EXPECTED_TEXT);
}

function makeContext(parsed) {
  const tenantId = sanitizeId(parsed.tenantId, "local-dev");
  const projectId = sanitizeId(parsed.projectId, "project-runs-experimental-16g");
  const sessionId = sanitizeId(parsed.sessionId, "session-runs-experimental-16g");
  const projectStableKey = `studio:${tenantId}:project:${projectId}`;
  const sessionStableKey = `${projectStableKey}:session:${sessionId}`;
  return {
    project: {
      contextPolicy: "balanced",
      id: projectId,
      pinnedMemoryIds: [],
      retrievalProfile: "balanced",
      stableKey: projectStableKey,
      tenantId,
      title: "Runs Experimental Mode"
    },
    session: {
      hermesSessionId: `hermes-session-${sessionId}`,
      id: sessionId,
      includeProjectContext: true,
      includeSessionContext: true,
      stableKey: sessionStableKey,
      title: "Runs Experimental Mode"
    },
    ui: {
      source: "hermes-ui",
      workspaceVersion: 1
    }
  };
}

function sanitizeId(value, fallback) {
  return typeof value === "string"
    ? value.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 96) || fallback
    : fallback;
}

function ensureTrailingSlash(value) {
  return value.endsWith("/") ? value : `${value}/`;
}
