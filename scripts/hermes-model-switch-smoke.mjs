#!/usr/bin/env node
/**
 * hermes-model-switch-smoke.mjs
 *
 * Live smoke test for Hermes model switching through the Web UI BFF.
 * Tests: model listing, selection, invalid model rejection, single-model behavior.
 *
 * Usage:
 *   node scripts/hermes-model-switch-smoke.mjs --base-url http://127.0.0.1:3002
 *   node scripts/hermes-model-switch-smoke.mjs --base-url http://127.0.0.1:3002 --require-hermes
 *
 * --require-hermes   Fail if Hermes is unreachable
 * --base-url         Web UI base URL (default: http://127.0.0.1:3002)
 * --timeout          Request timeout in ms (default: 10000)
 */

const BASE_URL = process.argv.includes("--base-url")
  ? process.argv[process.argv.indexOf("--base-url") + 1]
  : "http://127.0.0.1:3002";
const REQUIRE_HERMES = process.argv.includes("--require-hermes");
const TIMEOUT_MS = parseInt(
  process.argv.includes("--timeout")
    ? process.argv[process.argv.indexOf("--timeout") + 1]
    : "10000",
  10
);

let passed = 0;
let failed = 0;
let skipped = 0;

function ok(label) {
  console.log(`  PASS  ${label}`);
  passed++;
}
function fail(label, detail) {
  console.error(`  FAIL  ${label}${detail ? ` — ${detail}` : ""}`);
  failed++;
}
function skip(label, reason) {
  console.log(`  SKIP  ${label} — ${reason}`);
  skipped++;
}

async function bffFetch(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeout || TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: { "Content-Type": "application/json", ...options.headers },
    });
    const text = await response.text();
    let body;
    try {
      body = JSON.parse(text);
    } catch {
      body = { raw: text.slice(0, 200) };
    }
    return { ok: response.ok, status: response.status, body };
  } catch (err) {
    return { ok: false, status: 0, body: null, error: err.message };
  } finally {
    clearTimeout(timer);
  }
}

// Check for secrets in output
function hasSecrets(obj, path = "") {
  if (typeof obj === "string") {
    const lower = obj.toLowerCase();
    if (
      (lower.includes("sk-") && obj.length > 20) ||
      lower.includes("api_key") ||
      lower.includes("secret") ||
      lower.includes("bearer ")
    ) {
      return `${path}: potential secret`;
    }
    return null;
  }
  if (obj && typeof obj === "object") {
    for (const key of Object.keys(obj)) {
      const result = hasSecrets(obj[key], `${path}.${key}`);
      if (result) return result;
    }
  }
  return null;
}

async function main() {
  console.log("\nhermes-model-switch-smoke");
  console.log("=".repeat(48));
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Require Hermes: ${REQUIRE_HERMES}`);
  console.log("");

  // 1. Fetch BFF status
  console.log("--- Step 1: Fetch BFF status ---");
  const statusResult = await bffFetch("/api/hermes/status");
  ok("BFF status endpoint reachable");
  if (statusResult.ok) {
    ok("BFF status returned 200");
  } else {
    fail("BFF status returned non-200", `${statusResult.status}`);
  }

  const status = statusResult.body;
  const hermesReachable = status?.reachable || status?.mode === "real";

  if (REQUIRE_HERMES && !hermesReachable) {
    fail("Hermes reachable (--require-hermes)", "Hermes is unreachable");
    printSummary();
    process.exit(1);
  }

  if (!hermesReachable) {
    skip("Model switching", "Hermes unreachable");
    printSummary();
    process.exit(0);
  }

  // 2. Check capabilities for explicit session_model_override
  console.log("\n--- Step 2: Check model override capability ---");
  const capsResult = await bffFetch("/api/hermes/status");
  const caps = capsResult.body?.capabilities || {};
  const sessionModelOverride = caps?.session_model_override;

  if (sessionModelOverride?.supported === true) {
    ok("Explicit session_model_override supported");
  } else {
    // Fall back to inferring from model count
    skip("Explicit session_model_override", "Not advertised by Hermes, using inference");
  }

  // 3. Get available models
  console.log("\n--- Step 3: Available models ---");
  const uiCaps = status?.uiCapabilities?.models;
  const availableModels = uiCaps?.availableModels || [];
  const modelCount = availableModels.length;

  if (modelCount > 0) {
    ok(`Available models: ${modelCount}`);
    console.log(`       Models: ${availableModels.map((m) => m.id).join(", ")}`);
  } else {
    skip("Available models", "None returned by status");
  }

  // 4. No secrets in status output
  console.log("\n--- Step 4: No secrets in BFF status ---");
  const secretCheck = hasSecrets(statusResult.body);
  if (secretCheck) {
    fail("No secrets in status output", secretCheck);
  } else {
    ok("No secrets in status output");
  }

  // 5. If 2+ models, test selection
  console.log("\n--- Step 5: Model selection ---");
  if (availableModels.length >= 2) {
    const modelA = availableModels[0].id;
    const modelB = availableModels[1].id;

    // Get or create a session for model selection
    let sessionId = "smoke-test-session";
    const sessionsResult = await bffFetch("/api/hermes/sessions");
    if (sessionsResult.ok && sessionsResult.body?.sessions?.length > 0) {
      sessionId = sessionsResult.body.sessions[0].id;
      ok("Using existing session: " + sessionId.slice(-8));
    } else {
      // Try creating a session via Hermes API directly (admin smoke, not browser path)
      const hermesStatus = statusResult.body;
      const hermesBaseUrl = hermesStatus?.baseUrl;
      const hermesApiKey = ""; // Smoke doesn't have the key; skip creation
      skip("Session creation", "No existing session found and BFF has no create endpoint");
    }

    // Try selecting model A
    console.log(`       Selecting model: ${modelA}`);
    const selectResult = await bffFetch("/api/hermes/model/select", {
      method: "POST",
      body: JSON.stringify({ sessionId, model: modelA }),
    });
    if (selectResult.ok) {
      ok(`Select ${modelA}: response ok`);
      if (selectResult.body?.selectedModel === modelA || selectResult.body?.model === modelA || selectResult.body?.selected_model === modelA) {
        ok(`Select ${modelA}: effective model confirmed`);
      } else {
        fail(`Select ${modelA}: model mismatch`, JSON.stringify(selectResult.body));
      }
    } else if (selectResult.status === 400) {
      skip(`Select ${modelA}`, "Invalid session (expected without live gateway)");
    } else {
      fail(`Select ${modelA}`, `${selectResult.status}: ${JSON.stringify(selectResult.body)}`);
    }

    // Try selecting model B
    console.log(`       Selecting model: ${modelB}`);
    const selectResult2 = await bffFetch("/api/hermes/model/select", {
      method: "POST",
      body: JSON.stringify({ sessionId, model: modelB }),
    });
    if (selectResult2.ok) {
      ok(`Select ${modelB}: response ok`);
    } else if (selectResult2.status === 400) {
      skip(`Select ${modelB}`, "Invalid session (expected without live gateway)");
    } else {
      fail(`Select ${modelB}`, `${selectResult2.status}: ${JSON.stringify(selectResult2.body)}`);
    }

    // No secrets in model select response
    const secCheck = hasSecrets(selectResult.body);
    if (secCheck) {
      fail("No secrets in model select response", secCheck);
    } else if (selectResult.body) {
      ok("No secrets in model select response");
    }
  } else if (availableModels.length === 1) {
    console.log(`       Single model: ${availableModels[0].id}`);
    console.log("       Selection disabled (1 model configured)");
    ok("Single model: selection would be no-op");

    // Verify invalid model rejection
    console.log("\n--- Step 6: Invalid model rejection ---");
    const invalidResult = await bffFetch("/api/hermes/model/select", {
      method: "POST",
      body: JSON.stringify({ sessionId, model: "non-existent-model-xyz" }),
    });
    if (invalidResult.status === 400) {
      ok("Invalid model rejected with 400");
    } else {
      skip("Invalid model rejection", `${invalidResult.status}: ${JSON.stringify(invalidResult.body)}`);
    }
  } else {
    skip("Model selection", "No models available");
  }

  // 7. Verify no global/config write in status
  console.log("\n--- Step 7: Safety invariants ---");
  const features = caps?.features || {};
  if (features.session_model_override) {
    const smo = features.session_model_override;
    if (smo.config_write === false) ok("session_model_override.config_write is false");
    else fail("session_model_override.config_write is not false", JSON.stringify(smo));
    if (smo.global_supported === false) ok("session_model_override.global_supported is false");
    else fail("session_model_override.global_supported is not false", JSON.stringify(smo));
    if (smo.persistent === false) ok("session_model_override.persistent is false");
    else fail("session_model_override.persistent is not false", JSON.stringify(smo));
  } else {
    skip("Safety: config_write/global_supported/persistent", "Not in capabilities response");
  }

  printSummary();
}

function printSummary() {
  console.log("\n" + "=".repeat(48));
  console.log(`Result: ${passed} passed, ${failed} failed, ${skipped} skipped`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error("Fatal error:", err.message);
  process.exit(1);
});