#!/usr/bin/env node

const args = parseArgs(process.argv.slice(2));
const baseUrl = args.baseUrl || process.env.STUDIO_WEB_UI_URL || "http://127.0.0.1:3000";
const probeUrl = new URL("/api/hermes/runs/memory-probe", ensureTrailingSlash(baseUrl)).toString();
const BLOCKER_CATEGORIES = [
  "hermes_unreachable",
  "brain_memory_disabled",
  "brain_memory_gateway_unreachable",
  "brain_memory_key_missing",
  "brain_memory_key_unauthorized",
  "brain_memory_ui_bearer_unauthorized",
  "marker_not_stored",
  "marker_not_found",
  "scope_mismatch",
  "runs_mcp_failure",
  "unknown"
];

const result = await postProbe(probeUrl, { marker: args.marker || undefined });
if (!result.ok) {
  const message = result.error ?? `Could not reach ${probeUrl}.`;
  if (args.requireHermes || args.requireBrainMemory) {
    console.error(`Hermes Runs Brain Memory probe failed: ${message}`);
    process.exit(1);
  }
  console.warn(`Hermes Runs Brain Memory probe skipped: ${message}`);
  process.exit(0);
}

const report = result.body;
printReport(report);

if (report?.ok && report.mode === "success") {
  process.exit(0);
}

const blocker = report?.blocker || report?.error?.message || "Hermes Runs Brain Memory probe did not pass.";
const category = report?.blockerCategory || "unknown";
if (args.requireHermes || args.requireBrainMemory || report?.mode === "failed") {
  console.error(`Hermes Runs Brain Memory probe failed [${category}]: ${blocker}`);
  process.exit(1);
}

console.warn(`Hermes Runs Brain Memory probe skipped [${category}]: ${blocker}`);
process.exit(0);

function parseArgs(argv) {
  const parsed = {
    baseUrl: "",
    marker: "",
    requireBrainMemory: false,
    requireHermes: false
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--require-brain-memory") {
      parsed.requireBrainMemory = true;
    } else if (arg === "--require-hermes") {
      parsed.requireHermes = true;
    } else if (arg === "--base-url") {
      parsed.baseUrl = argv[index + 1] ?? "";
      index += 1;
    } else if (arg.startsWith("--base-url=")) {
      parsed.baseUrl = arg.slice("--base-url=".length);
    } else if (arg === "--marker") {
      parsed.marker = argv[index + 1] ?? "";
      index += 1;
    } else if (arg.startsWith("--marker=")) {
      parsed.marker = arg.slice("--marker=".length);
    }
  }
  return parsed;
}

async function postProbe(url, body) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000);
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
    console.log("Hermes Runs Brain Memory probe returned no JSON body.");
    return;
  }
  console.log("Hermes Runs Brain Memory probe result:");
  console.log(`- mode: ${report.mode}`);
  console.log(`- ok: ${String(report.ok)}`);
  console.log(`- marker: ${report.marker ?? "none"}`);
  console.log(`- hermesStatus: ${statusLine(report.hermesStatus)}`);
  console.log(`- brainMemoryStatus: ${statusLine(report.brainMemoryStatus)}`);
  console.log(`- brainMemoryRealGatewayEnabled: ${String(report.envPosture?.realGatewayEnabled ?? false)}`);
  console.log(`- brainMemoryGatewayUrlConfigured: ${String(report.envPosture?.gatewayUrlConfigured ?? false)}`);
  console.log(`- brainMemoryGatewayMemoryKeySet: ${String(report.envPosture?.gatewayMemoryKeySet ?? false)}`);
  console.log(`- brainMemoryUiBearerSet: ${String(report.envPosture?.uiBearerSet ?? false)}`);
  console.log(`- brainMemoryMcpApiKeyObservedByWebUi: ${String(report.envPosture?.mcpApiKeyObservedByWebUi ?? false)}`);
  console.log(`- runId: ${report.run?.runId ?? "none"}`);
  console.log(`- status: ${report.run?.status ?? "none"}`);
  console.log(`- eventTypes: ${(report.run?.eventTypes ?? []).join(", ") || "none"}`);
  console.log(`- messageDeltaEvents: ${report.run?.counts?.messageDeltaEvents ?? 0}`);
  console.log(`- toolEvents: ${report.run?.counts?.toolEvents ?? 0}`);
  console.log(`- brainMemoryToolEvents: ${report.run?.counts?.brainMemoryToolEvents ?? 0}`);
  console.log(`- approvalEvents: ${report.run?.counts?.approvalEvents ?? 0}`);
  console.log(`- memoryActivityEvents: ${report.normalization?.memoryActivityEvents ?? 0}`);
  console.log(`- uniqueEventIds: ${String(report.normalization?.uniqueEventIds ?? false)}`);
  console.log(`- sameSessionFound: ${String(report.scope?.sameSessionFound ?? false)}`);
  console.log(`- inspectMatchesProject: ${String(report.scope?.inspectMatchesProject ?? false)}`);
  console.log(`- inspectMatchesSession: ${String(report.scope?.inspectMatchesSession ?? false)}`);
  console.log(`- inspectScopeStatus: ${report.scope?.inspectScopeStatus ?? "none"}`);
  console.log(`- bffSearchStatus: ${readStatusLine(report.search?.sameSession)}`);
  console.log(`- inspectStatus: ${readStatusLine(report.inspect)}`);
  console.log(`- differentProjectAbsent: ${String(report.scope?.differentProjectAbsent ?? false)}`);
  console.log(`- differentSessionAbsent: ${String(report.scope?.differentSessionAbsent ?? false)}`);
  console.log(`- outputPreview: ${report.run?.outputPreview || "none"}`);
  console.log(`- blockerCategory: ${report.blockerCategory || "none"}`);
  if (report.blocker) {
    console.log(`- blocker: ${report.blocker}`);
  }
  if (report.error) {
    console.log(`- error: ${report.error.message}`);
  }
}

function statusLine(status) {
  if (!status || typeof status !== "object") {
    return "none";
  }
  return [
    `mode=${status.mode ?? "none"}`,
    `reachable=${String(status.reachable ?? false)}`,
    `configured=${String(status.configured ?? false)}`,
    status.error?.kind ? `error=${status.error.kind}` : "error=none"
  ].join(" ");
}

function readStatusLine(value) {
  if (!value || typeof value !== "object") {
    return "none";
  }
  return [
    `mode=${value.mode ?? "none"}`,
    `error=${value.error?.kind ?? "none"}`
  ].join(" ");
}

function ensureTrailingSlash(value) {
  return value.endsWith("/") ? value : `${value}/`;
}
