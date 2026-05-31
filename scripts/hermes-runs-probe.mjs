#!/usr/bin/env node

const args = parseArgs(process.argv.slice(2));
const baseUrl = args.baseUrl || process.env.STUDIO_WEB_UI_URL || "http://127.0.0.1:3000";
const probeUrl = new URL("/api/hermes/runs/probe", ensureTrailingSlash(baseUrl)).toString();

const result = await postProbe(probeUrl);
if (!result.ok) {
  const message = result.error ?? `Could not reach ${probeUrl}.`;
  if (args.requireHermes) {
    console.error(`Hermes Runs probe failed: ${message}`);
    process.exit(1);
  }
  console.warn(`Hermes Runs probe skipped: ${message}`);
  process.exit(0);
}

const report = result.body;
printReport(report);

if (report?.ok && report.mode === "success") {
  process.exit(0);
}

const errorMessage = report?.error?.message || "Hermes Runs probe did not succeed.";
if (args.requireHermes || report?.mode === "failed") {
  console.error(`Hermes Runs probe failed: ${errorMessage}`);
  process.exit(1);
}

console.warn(`Hermes Runs probe skipped: ${errorMessage}`);
process.exit(0);

function parseArgs(argv) {
  const parsed = {
    baseUrl: "",
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
    }
  }
  return parsed;
}

async function postProbe(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25_000);
  try {
    const response = await fetch(url, {
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      method: "POST",
      signal: controller.signal
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      return {
        ok: false,
        error: `BFF route returned HTTP ${response.status}.`
      };
    }
    return { ok: true, body };
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
    console.log("Hermes Runs probe returned no JSON body.");
    return;
  }
  console.log("Hermes Runs probe result:");
  console.log(`- mode: ${report.mode}`);
  console.log(`- ok: ${String(report.ok)}`);
  console.log(`- prompt: ${report.prompt}`);
  console.log(`- runId: ${report.runId ?? "none"}`);
  console.log(`- status: ${report.status ?? "none"}`);
  console.log(`- eventTypes: ${(report.eventTypes ?? []).join(", ") || "none"}`);
  console.log(`- events: ${report.counts?.events ?? 0}`);
  console.log(`- messageDeltaEvents: ${report.counts?.messageDeltaEvents ?? 0}`);
  console.log(`- toolEvents: ${report.counts?.toolEvents ?? 0}`);
  console.log(`- brainMemoryToolEvents: ${report.counts?.brainMemoryToolEvents ?? 0}`);
  console.log(`- approvalEvents: ${report.counts?.approvalEvents ?? 0}`);
  console.log(`- assistantTextPreview: ${report.assistantTextPreview || "none"}`);
  console.log(`- outputPreview: ${report.outputPreview || "none"}`);
  if (report.error) {
    console.log(`- error: ${report.error.message}`);
  }
}

function ensureTrailingSlash(value) {
  return value.endsWith("/") ? value : `${value}/`;
}
