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

const shapeValidation = validateRunRecordReplayShape(report);
if (!shapeValidation.ok) {
  console.error(`Experimental Hermes Runs replay shape failed: ${shapeValidation.message}`);
  process.exit(1);
}

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
  console.log(`- runRecordPreview: ${report.runRecordPreview ? "present" : "none"}`);
  console.log(`- runRecordPreview.id: ${report.runRecordPreview?.id ?? "none"}`);
  console.log(`- runRecordPreview.hermesRunId: ${report.runRecordPreview?.hermesRunId ?? "none"}`);
  console.log(`- activityReplayPreview: ${report.activityReplayPreview?.length ?? 0}`);
  console.log(`- replayExcludedFields: ${report.replayExcludedFields?.length ?? 0}`);
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

function validateRunRecordReplayShape(report) {
  if (!report || report.mode !== "success") {
    return { ok: true, message: "Shape validation skipped for non-success result." };
  }
  const record = report.runRecordPreview;
  const replay = Array.isArray(report.activityReplayPreview) ? report.activityReplayPreview : [];
  if (!record) {
    return { ok: false, message: "runRecordPreview is missing." };
  }
  if (!record.id || record.id === report.runId) {
    return { ok: false, message: "runRecordPreview.id must be a local id distinct from the Hermes run id." };
  }
  if (record.hermesRunId !== report.runId) {
    return { ok: false, message: "runRecordPreview.hermesRunId does not match runId." };
  }
  if (record.hermesSessionId !== report.context?.hermesSessionId) {
    return { ok: false, message: "runRecordPreview.hermesSessionId does not match context." };
  }
  if (record.projectId !== report.context?.projectId || record.sessionId !== report.context?.sessionId) {
    return { ok: false, message: "runRecordPreview project/session ids do not match context." };
  }
  if (record.status !== "completed") {
    return { ok: false, message: `runRecordPreview status should be completed, got ${record.status}.` };
  }
  if (record.sourceChannel !== "web-ui") {
    return { ok: false, message: "runRecordPreview sourceChannel should be web-ui." };
  }
  if (!Array.isArray(record.activityReplay) || record.activityReplay.length !== replay.length) {
    return { ok: false, message: "runRecordPreview.activityReplay must match activityReplayPreview." };
  }
  if (replay.length > 40) {
    return { ok: false, message: "activityReplayPreview exceeds the persisted replay bound." };
  }
  if (replay.some((event) => event?.hermes?.eventType === "message.delta")) {
    return { ok: false, message: "message.delta was persisted as a replay row." };
  }
  if (!Array.isArray(report.replayExcludedFields) || !report.replayExcludedFields.includes("per-token message.delta replay rows")) {
    return { ok: false, message: "replayExcludedFields does not document message.delta exclusion." };
  }
  if (!activitySummaryMatches(record.activitySummary, report.activitySummary)) {
    return { ok: false, message: "activitySummary does not match runRecordPreview.activitySummary." };
  }
  if (record.activitySummary.toolCount !== (report.activitySummary?.toolCount ?? 0)) {
    return { ok: false, message: "tool activity count is incoherent." };
  }
  const serialized = JSON.stringify({ replay, record });
  if (serialized.includes("message.delta")) {
    return { ok: false, message: "message.delta appeared in persisted replay JSON." };
  }
  if (serialized.includes("rawReasoningTextRendered\":true")) {
    return { ok: false, message: "hidden reasoning text render flag was persisted as true." };
  }
  if (/chain[_-]?of[_-]?thought|private reasoning|hidden reasoning/i.test(serialized)) {
    return { ok: false, message: "reasoning-like private text appeared in persisted replay." };
  }
  if (/\bBearer\s+(?!\[redacted\])[A-Za-z0-9._~+/=-]+/i.test(serialized)) {
    return { ok: false, message: "unredacted bearer value appeared in persisted replay." };
  }
  if (record.metadata?.rawRunsPayloadPersisted !== false) {
    return { ok: false, message: "runRecordPreview metadata must state raw Runs payloads are not persisted." };
  }
  return { ok: true, message: "RunRecord/replay shape is valid." };
}

function activitySummaryMatches(left, right) {
  const keys = ["toolCount", "memoryCount", "commandCount", "approvalCount", "errorCount"];
  return keys.every((key) => Number(left?.[key] ?? 0) === Number(right?.[key] ?? 0));
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
