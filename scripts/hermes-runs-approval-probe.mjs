#!/usr/bin/env node

const args = parseArgs(process.argv.slice(2));
const baseUrl = args.baseUrl || process.env.STUDIO_WEB_UI_URL || "http://127.0.0.1:3000";
const probeUrl = new URL("/api/hermes/runs/approval-probe", ensureTrailingSlash(baseUrl)).toString();

const result = await postProbe(probeUrl, { choice: args.choice });
if (!result.ok) {
  const message = result.error ?? `Could not reach ${probeUrl}.`;
  if (args.requireHermes) {
    console.error(`Hermes Runs approval probe failed: ${message}`);
    process.exit(1);
  }
  console.warn(`Hermes Runs approval probe skipped: ${message}`);
  process.exit(0);
}

const report = result.body;
printReport(report);

if (report?.ok && report.mode === "success") {
  process.exit(0);
}

const blocker = report?.blocker || report?.error?.message || "Hermes Runs approval probe did not produce a useful result.";
if (args.requireHermes || report?.mode === "failed") {
  console.error(`Hermes Runs approval probe failed: ${blocker}`);
  process.exit(1);
}

console.warn(`Hermes Runs approval probe skipped: ${blocker}`);
process.exit(0);

function parseArgs(argv) {
  const parsed = {
    baseUrl: "",
    choice: "deny",
    requireHermes: false
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--require-hermes") {
      parsed.requireHermes = true;
    } else if (arg === "--base-url") {
      parsed.baseUrl = argv[index + 1] ?? "";
      index += 1;
    } else if (arg.startsWith("--base-url=")) {
      parsed.baseUrl = arg.slice("--base-url=".length);
    } else if (arg === "--choice") {
      parsed.choice = sanitizeChoice(argv[index + 1]) ?? "deny";
      index += 1;
    } else if (arg.startsWith("--choice=")) {
      parsed.choice = sanitizeChoice(arg.slice("--choice=".length)) ?? "deny";
    }
  }
  return parsed;
}

async function postProbe(url, body) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 75_000);
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
        error: `BFF route returned HTTP ${response.status}.`
      };
    }
    return { ok: true, body: responseBody };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Unknown fetch error."
    };
  } finally {
    clearTimeout(timeout);
  }
}

function printReport(report) {
  if (!report) {
    console.log("Hermes Runs approval probe returned no JSON body.");
    return;
  }
  console.log("Hermes Runs approval probe result:");
  console.log(`- mode: ${report.mode}`);
  console.log(`- ok: ${String(report.ok)}`);
  console.log(`- outcome: ${report.outcome ?? "none"}`);
  console.log(`- prompt: ${report.prompt ?? "none"}`);
  console.log(`- runId: ${report.runId ?? "none"}`);
  console.log(`- createStatus: ${report.createStatus ?? "none"}`);
  console.log(`- finalStatus: ${report.finalStatusName ?? "none"}`);
  console.log(`- approvalRequiredObserved: ${String(report.approvalRequiredObserved ?? false)}`);
  console.log(`- approvalEventTypes: ${(report.approvalEventTypes ?? []).join(", ") || "none"}`);
  console.log(`- approvalActionAttempted: ${report.approvalActionAttempted ?? "none"}`);
  console.log(`- approvalChoice: ${report.approvalChoice ?? "none"}`);
  console.log(`- approvalHttpStatus: ${report.approval?.statusCode ?? "none"}`);
  console.log(`- approvalResolved: ${report.approval?.resolved ?? "none"}`);
  console.log(`- approvalRequestedAt: ${report.approvalRequestedAt ?? "none"}`);
  console.log(`- approvalRespondedAt: ${report.approvalRespondedAt ?? "none"}`);
  console.log(`- eventTypes: ${(report.eventTypes ?? []).join(", ") || "none"}`);
  console.log(`- events: ${report.counts?.events ?? 0}`);
  console.log(`- messageDeltaEvents: ${report.counts?.messageDeltaEvents ?? 0}`);
  console.log(`- toolEvents: ${report.counts?.toolEvents ?? 0}`);
  console.log(`- brainMemoryToolEvents: ${report.counts?.brainMemoryToolEvents ?? 0}`);
  console.log(`- approvalEvents: ${report.counts?.approvalEvents ?? 0}`);
  console.log(`- approvalActivityEvents: ${report.activity?.approvalActivityEvents ?? 0}`);
  console.log(`- waitingForApprovalEvents: ${report.activity?.waitingForApprovalEvents ?? 0}`);
  console.log(`- completedApprovalEvents: ${report.activity?.completedApprovalEvents ?? 0}`);
  console.log(`- cancelledApprovalEvents: ${report.activity?.cancelledApprovalEvents ?? 0}`);
  console.log(`- rawSecretRendered: ${String(report.activity?.rawSecretRendered ?? false)}`);
  console.log(`- assistantTextPreview: ${report.assistantTextPreview || "none"}`);
  console.log(`- outputPreview: ${report.outputPreview || "none"}`);
  if (report.blocker) {
    console.log(`- blocker: ${report.blocker}`);
  }
  if (report.error) {
    console.log(`- error: ${report.error.message}`);
  }
}

function sanitizeChoice(value) {
  return ["once", "session", "always", "deny"].includes(value) ? value : null;
}

function ensureTrailingSlash(value) {
  return value.endsWith("/") ? value : `${value}/`;
}
