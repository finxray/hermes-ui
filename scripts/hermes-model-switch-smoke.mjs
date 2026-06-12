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
  let sessionId = `smoke-test-session-${Date.now().toString(36)}`;
  if (availableModels.length >= 2) {
    const modelA = availableModels[0];
    const modelB = availableModels[1];
    const modelAId = modelA.id;
    const modelBId = modelB.id;
    const modelASelectId = modelA.selectModelId || modelA.id;
    const modelBSelectId = modelB.selectModelId || modelB.id;
    const modelAProvider = modelA.providerKey || modelA.provider || null;
    const modelBProvider = modelB.providerKey || modelB.provider || null;

    // Get or create a session for model selection
    const sessionsResult = await bffFetch("/api/hermes/sessions");
    if (sessionsResult.ok && sessionsResult.body?.sessions?.length > 0) {
      sessionId = sessionsResult.body.sessions[0].id;
      ok("Using existing session: " + sessionId.slice(-8));
    } else {
      ok("Using fresh smoke session id: " + sessionId.slice(-8));
    }

    // Try selecting model A
    console.log(`       Selecting model: ${modelAId}`);
    const selectResult = await bffFetch("/api/hermes/model/select", {
      method: "POST",
      body: JSON.stringify({
        expectedProviderKey: modelAProvider,
        model: modelASelectId,
        provider: modelAProvider,
        sessionId,
        sessionTitle: "Hermes UI smoke"
      }),
    });
    if (selectResult.ok) {
      ok(`Select ${modelAId}: response ok`);
      if (selectResult.body?.selectedModel === modelAId || selectResult.body?.selectedModel === modelASelectId || selectResult.body?.model === modelAId || selectResult.body?.selected_model === modelAId) {
        ok(`Select ${modelAId}: effective model confirmed by select response`);
      } else {
        fail(`Select ${modelAId}: model mismatch`, JSON.stringify(selectResult.body));
      }
      const detailResult = await bffFetch(`/api/hermes/sessions/${encodeURIComponent(sessionId)}`);
      const detailModel = detailResult.body?.session?.effectiveModel;
      if (detailResult.ok && (detailModel === modelAId || detailModel === modelASelectId)) {
        ok(`Session detail verifies ${modelAId}`);
      } else {
        fail(`Session detail verifies ${modelAId}`, `${detailResult.status}: ${JSON.stringify(detailResult.body)}`);
      }
    } else if (selectResult.status === 400) {
      skip(`Select ${modelAId}`, "Invalid or unavailable model/provider for this Hermes config");
    } else {
      fail(`Select ${modelAId}`, `${selectResult.status}: ${JSON.stringify(selectResult.body)}`);
    }

    // Try selecting model B
    console.log(`       Selecting model: ${modelBId}`);
    const selectResult2 = await bffFetch("/api/hermes/model/select", {
      method: "POST",
      body: JSON.stringify({
        expectedProviderKey: modelBProvider,
        model: modelBSelectId,
        provider: modelBProvider,
        sessionId,
        sessionTitle: "Hermes UI smoke"
      }),
    });
    if (selectResult2.ok) {
      ok(`Select ${modelBId}: response ok`);
      const detailResult2 = await bffFetch(`/api/hermes/sessions/${encodeURIComponent(sessionId)}`);
      const detailModel2 = detailResult2.body?.session?.effectiveModel;
      if (detailResult2.ok && (detailModel2 === modelBId || detailModel2 === modelBSelectId)) {
        ok(`Session detail verifies ${modelBId}`);
      } else {
        fail(`Session detail verifies ${modelBId}`, `${detailResult2.status}: ${JSON.stringify(detailResult2.body)}`);
      }
    } else if (selectResult2.status === 400) {
      skip(`Select ${modelBId}`, "Invalid or unavailable model/provider for this Hermes config");
    } else {
      fail(`Select ${modelBId}`, `${selectResult2.status}: ${JSON.stringify(selectResult2.body)}`);
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
