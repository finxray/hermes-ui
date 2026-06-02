#!/usr/bin/env node
/**
 * check-hermes-model-capabilities.mjs
 *
 * Source-level check that verifies:
 * 1. The Hermes capability contract types exist and are correct
 * 2. normalizeHermesUiCapabilities enables client selection only from real Hermes model data
 * 3. Status polling interval exists in useHermesStatus
 * 4. Session-scoped model select BFF route exists
 * 5. Composer receives modelState and conditionally enables model selection
 * 6. Reactivity fix: useHermesStatus uses setInterval
 */

import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(process.cwd());

let passed = 0;
let failed = 0;

function check(label, condition, detail = "") {
  if (condition) {
    console.log(`  PASS  ${label}`);
    passed++;
  } else {
    console.error(`  FAIL  ${label}${detail ? ` — ${detail}` : ""}`);
    failed++;
  }
}

function readFile(relPath) {
  const abs = resolve(root, relPath);
  if (!existsSync(abs)) {
    return null;
  }
  return readFileSync(abs, "utf8");
}

console.log("\ncheck-hermes-model-capabilities");
console.log("=".repeat(48));

// --- 1. Type contract ---
const typesFile = readFile("packages/hermes-client/src/types.ts");
check(
  "types.ts exists",
  typesFile !== null
);
check(
  "HermesModelSelectionStatus includes server-configured",
  typesFile?.includes('"server-configured"') ?? false
);
check(
  "HermesUiCapabilities.models has clientSelectable field",
  typesFile?.includes("clientSelectable: boolean") ?? false
);
check(
  "HermesUiCapabilities.models has serverConfiguredOnly field",
  typesFile?.includes("serverConfiguredOnly: boolean") ?? false
);
check(
  "HermesUiCapabilities.models has selectionStatus field",
  typesFile?.includes("selectionStatus: HermesModelSelectionStatus") ?? false
);
check(
  "HermesUiCapabilities.models has availableModels field",
  typesFile?.includes("availableModels: HermesModelDescriptor[]") ?? false
);
check(
  "HermesModelSelectResult type exists",
  typesFile?.includes("export type HermesModelSelectResult") ?? false
);

// --- 2. normalizeHermesUiCapabilities enables verified client selection ---
const indexFile = readFile("packages/hermes-client/src/index.ts");
check(
  "index.ts exists",
  indexFile !== null
);
check(
  "selectHermesModel client function exists",
  indexFile?.includes("export async function selectHermesModel") ?? false
);
check(
  "selectHermesModel calls session model endpoint",
  indexFile?.includes("/api/sessions/${encodeURIComponent(sessionId)}/model") ?? false
);
check(
  "normalizeHermesUiCapabilities computes clientSelectable from real model catalog",
  Boolean(indexFile?.includes("availableModels.length > 0") && indexFile?.includes('status.mode === "real"'))
);
check(
  "normalizeHermesUiCapabilities can report client-selectable selectionStatus",
  indexFile?.includes('"client-selectable"') ?? false
);

// --- 3. Reactivity: useHermesStatus uses polling interval ---
const hookFile = readFile("apps/web/src/hooks/useHermesStatus.ts");
check(
  "useHermesStatus.ts exists",
  hookFile !== null
);
check(
  "useHermesStatus uses setInterval for polling",
  hookFile?.includes("setInterval") ?? false,
  "Status must poll periodically so UI updates when Hermes connects/disconnects"
);
check(
  "useHermesStatus clears interval on unmount",
  hookFile?.includes("clearInterval") ?? false,
  "Must clean up interval to avoid memory leaks"
);
check(
  "useHermesStatus uses mountedRef to prevent stale setState",
  hookFile?.includes("mountedRef") ?? false,
  "Must guard against setState after unmount"
);
check(
  "useHermesStatus poll interval is 5-15 seconds",
  /POLL_INTERVAL_MS\s*=\s*(?:[5-9]_?\d{3}|1[0-5]_?\d{3})/.test(hookFile ?? "") ||
  /setInterval.*\d{4,5}/.test(hookFile ?? ""),
  "Polling interval should be 5000-15000ms to avoid spam"
);

// --- 4. Session-scoped model switch route ---
const modelSwitchRoutePath = "apps/web/src/app/api/hermes/model/select/route.ts";
check(
  "Model select BFF route exists",
  existsSync(resolve(root, modelSwitchRoutePath)),
  "Runtime switching must go through the Web UI BFF"
);
const modelSwitchRouteFile = readFile(modelSwitchRoutePath);
check(
  "Model select BFF route uses selectHermesModel",
  modelSwitchRouteFile?.includes("selectHermesModel") ?? false
);
check(
  "Model select BFF route does not expose Hermes API key to browser",
  Boolean(modelSwitchRouteFile?.includes("process.env.HERMES_API_KEY") && !modelSwitchRouteFile?.includes("NEXT_PUBLIC"))
);
check(
  "Model select BFF route is force-dynamic",
  modelSwitchRouteFile?.includes('dynamic = "force-dynamic"') ?? false
);

// --- 5. Composer has conditional model selector ---
const composerFile = readFile("apps/web/src/components/chat/Composer.tsx");
check(
  "Composer.tsx exists",
  composerFile !== null
);
check(
  "Composer model button is disabled unless canSelectModel",
  composerFile?.includes("disabled={!canSelectModel}") ?? false,
  "Model button should only enable when Hermes reports selectable models"
);
check(
  "Composer receives modelState prop",
  composerFile?.includes("modelState") ?? false
);
check(
  "Composer receives onModelSelect prop",
  composerFile?.includes("onModelSelect") ?? false
);
check(
  "Composer renders model dropdown options",
  Boolean(composerFile?.includes("modelMenu") && composerFile?.includes("modelOptions.map"))
);
check(
  "Composer shows modelLabel in button text",
  composerFile?.includes("{modelLabel}") ?? false
);

// --- 6. ChatView computes model label from hermesStatus ---
const chatViewFile = readFile("apps/web/src/components/chat/ChatView.tsx");
check(
  "ChatView.tsx exists",
  chatViewFile !== null
);
check(
  "ChatView passes hermesStatus to modelLabelForState",
  chatViewFile?.includes("modelLabelForState") ?? false
);
check(
  "ChatView handles unavailable model state",
  chatViewFile?.includes("unavailable") ?? false
);
check(
  "useHermesStatus preserves known model during transient refresh failures",
  Boolean(readFile("apps/web/src/hooks/useHermesStatus.ts")?.includes("preserveKnownModelOnTransientFailure")),
  "Polling must not reset composer model to unknown when Hermes was previously connected"
);
check(
  "ChatView prefers currentModelLabel when Hermes reports a server model",
  Boolean(
    chatViewFile?.includes('state.currentModelLabel !== "Hermes server model"') ||
    chatViewFile?.includes("state.currentModelLabel &&")
  )
);
check(
  "ChatView passes modelState to Composer",
  chatViewFile?.includes("modelState={providerModelState}") ?? false
);
check(
  "ChatView posts selected model to BFF route",
  Boolean(chatViewFile?.includes('/api/hermes/model/select') && chatViewFile?.includes("session.hermesSessionId"))
);
check(
  "ChatView refreshes Hermes status after model selection",
  chatViewFile?.includes("refreshHermesStatus") ?? false
);

// --- 7. BFF status route is force-dynamic (no caching) ---
const statusRouteFile = readFile("apps/web/src/app/api/hermes/status/route.ts");
check(
  "BFF status route is force-dynamic",
  statusRouteFile?.includes('dynamic = "force-dynamic"') ?? false,
  "Route must not be cached so polling picks up fresh Hermes state"
);
check(
  "BFF status route sets Cache-Control: no-store",
  Boolean(statusRouteFile?.includes('"Cache-Control"') && statusRouteFile?.includes("no-store"))
);

// --- 8. hermesStatusClient uses cache: no-store ---
const statusClientFile = readFile("apps/web/src/lib/hermesStatusClient.ts");
check(
  "hermesStatusClient.ts exists",
  statusClientFile !== null
);
check(
  "hermesStatusClient fetch uses cache: no-store",
  statusClientFile?.includes('"no-store"') ?? false
);

// --- 9. Status polling stability: separate initial load from background refresh ---
check(
  "useHermesStatus separates isInitialLoading from isRefreshing",
  Boolean(hookFile?.includes("isInitialLoading") && hookFile?.includes("isRefreshing")),
  "Background refresh must not reset the displayed status to null/checking; use separate flags"
);
check(
  "useHermesStatus preserves previous status during background refresh",
  Boolean(hookFile?.includes("...current") && hookFile?.includes("isRefreshing: true")),
  "Refresh must spread current state so status is preserved while isRefreshing=true"
);
check(
  "useHermesStatus has meaningful equality gate to skip redundant setState",
  Boolean(hookFile?.includes("isMeaningfullyChanged")),
  "Equality check prevents unnecessary re-renders when Hermes state hasn't changed"
);
check(
  "useHermesStatus returns isRefreshing for subtle indicator",
  Boolean(hookFile?.includes("isRefreshing: state.isRefreshing")),
  "isRefreshing must be exposed so consumers can show a subtle spinner without layout change"
);
check(
  "Composer modelButton has min-width to prevent label-change layout shift",
  Boolean(readFile("apps/web/src/components/chat/Composer.module.css")?.includes("min-width: 90px")),
  "min-width prevents layout shift when label changes from 'Hermes default' to 'hermes-agent'"
);
check(
  "HermesStatusPanel accepts isRefreshing prop",
  Boolean(readFile("apps/web/src/components/shell/HermesStatusPanel.tsx")?.includes("isRefreshing")),
  "Panel must accept isRefreshing to animate the refresh icon without resizing the card"
);

// --- Summary ---
console.log("=".repeat(48));
console.log(`Result: ${passed} passed, ${failed} failed`);

if (failed > 0) {
  process.exit(1);
}
