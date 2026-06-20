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

function countOccurrences(value, token) {
  return value.split(token).length - 1;
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
check(
  "HermesSessionDetailResult type exists",
  typesFile?.includes("export type HermesSessionDetailResult") ?? false
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
  "getHermesSession client function exists",
  indexFile?.includes("export async function getHermesSession") ?? false
);
check(
  "getHermesSession reads Hermes session detail endpoint",
  Boolean(
    indexFile?.includes("export async function getHermesSession") &&
      indexFile?.includes("/api/sessions/${encodeURIComponent(safeId)}")
  ),
  "Session model truth must be read back from Hermes, not inferred only from the last UI selection"
);
check(
  "selectHermesModel calls session model endpoint",
  Boolean(indexFile?.includes("/api/sessions/${encodeURIComponent(safeSessionId)}/model"))
);
check(
  "selectHermesModel ensures Hermes session exists before switching model",
  Boolean(indexFile?.includes("ensureHermesSession") && indexFile?.includes("selectHermesModel"))
);
check(
  "streamHermesSessionChat applies session model before chat stream",
  Boolean(
    indexFile?.includes("export async function streamHermesSessionChat") &&
      indexFile?.includes("resolveRuntimeModelId(request.model)") &&
      indexFile?.includes("await selectHermesModel(config, hermesSessionId, runtimeModelId")
  ),
  "Chat turns must honor the UI-selected model via POST /api/sessions/{id}/model, not only session create"
);
check(
  "streamHermesSessionChat forwards selected model in chat stream body",
  Boolean(
    indexFile?.includes("/api/sessions/${encodeURIComponent(hermesSessionId)}/chat/stream") &&
      indexFile?.includes("Current Hermes API-server routing is verified through the session") &&
      indexFile?.includes("model: runtimeModelId || undefined") &&
      indexFile?.includes("provider: request.provider || undefined") &&
      indexFile?.includes("requested_model: runtimeModelId ?? null") &&
      indexFile?.includes("model_selection_scope: request.modelSelectionScope ?? null")
  ),
  "The chat body may carry selected-model metadata, but routing must have been verified through the session model endpoint first."
);
check(
  "streamHermesSessionChat does not silently fall back to unverified OpenRouter routing",
  Boolean(
    !indexFile?.includes("canUseTurnScopedOpenRouterModel") &&
      indexFile?.includes("Failed to apply the selected Hermes model for this session.") &&
      indexFile?.includes("return chatFailure(")
  ),
  "If Hermes rejects a model selection, the UI must fail loudly instead of continuing on the server default model."
);
check(
  "streamHermesSessionChat does not skip session override for turn-scope requests",
  Boolean(
    typesFile?.includes('modelSelectionScope?: "session" | "turn" | null') &&
      !indexFile?.includes('request.modelSelectionScope !== "turn"') &&
      indexFile?.includes("if (runtimeModelId)") &&
      indexFile?.includes("model: runtimeModelId || undefined") &&
      indexFile?.includes("provider: request.provider || undefined")
  ),
  "Even legacy turn-scoped requests must fail honestly if Hermes cannot verify the selected model for the session."
);
check(
  "streamHermesSessionChat emits verified-model fallback for empty assistant completions",
  Boolean(
    indexFile?.includes("emptyAssistantModelFallback") &&
      indexFile?.includes("writeEmptyAssistantFallback") &&
      indexFile?.includes("provider completed this turn without returning assistant text")
  ),
  "Some providers can complete with empty content; the UI should surface the verified selected model instead of blank or stale identity."
);
check(
  "Hermes SSE normalizer forwards assistant delta and completed events",
  Boolean(
    indexFile?.includes('eventName === "assistant.delta"') &&
      indexFile?.includes('eventName === "assistant.completed"') &&
      indexFile?.includes('type: "message_delta"') &&
      indexFile?.includes('type: "message_done"')
  ),
  "Claude/OpenRouter streams use assistant.delta and assistant.completed; the BFF must forward them instead of emitting the empty-response fallback."
);
check(
  "placeholder model ids are filtered from runtime switching",
  Boolean(
    indexFile?.includes("export function isPlaceholderHermesModelId") &&
      indexFile?.includes("hermes-agent") &&
      indexFile?.includes("resolveRuntimeModelId")
  ),
  "Legacy placeholder ids such as hermes-agent must never be sent to session model override"
);
check(
  "model select keeps Hermes catalog ids unchanged",
  Boolean(
    indexFile?.includes("export function resolveModelSelectRequest") &&
      indexFile?.includes("selectModelId: resolveModelSelectId(id, providerKey)") &&
      indexFile?.includes("return id;")
  ),
  "Hermes session selection should send the GET /v1/models id and never rewrite it into a provider-native alias."
);
check(
  "OpenRouter DeepSeek V4 Flash is not translated to a direct-provider alias",
  Boolean(
    !indexFile?.includes('return "deepseek-v4-flash"') &&
      indexFile?.includes("Do not translate aggregator ids into provider-native aliases")
  ),
  "The bare deepseek-v4-flash alias routes to the direct DeepSeek provider in current Hermes, so the UI must not use it for OpenRouter."
);
check(
  "dedicated provider misroutes are surfaced after model select",
  Boolean(
    indexFile?.includes("validateDedicatedProviderSelect") &&
    indexFile?.includes("expectedProviderKey")
  )
);
check(
  "OpenRouter catalog provider mismatches fail loudly instead of misrouting",
  Boolean(
    indexFile?.includes("Hermes resolved this OpenRouter catalog model through") &&
      indexFile?.includes("did not verify the requested OpenRouter provider")
  ),
  "Kimi can be advertised as OpenRouter but verified by Hermes through NVIDIA; the UI must fail loudly instead of continuing on the wrong provider."
);
check(
  "session model select requests session-scoped overrides and verifies readback",
  Boolean(
    indexFile?.includes('scope: "session"') &&
      indexFile?.includes("effective_provider") &&
      indexFile?.includes("options.provider ? { provider: options.provider }")
  )
);
check(
  "configured default model must come from Hermes status, not a hardcoded fallback",
  Boolean(
      indexFile?.includes("extractConfiguredDefaultModelIds") &&
      indexFile?.includes("gateway_model_defaults") &&
      !indexFile?.includes("function defaultModelDescriptor") &&
      !indexFile?.includes("function ensureConfiguredDefaultModelDescriptors") &&
      !indexFile?.includes("flaggedDefaultModelId(status.models),\n    PROJECT_DEFAULT_MODEL_ID") &&
      !indexFile?.includes("ensureConfiguredDefaultModelDescriptors(\n    modelDescriptors(status.models)")
  ),
  "The UI must not invent DeepSeek V4 Flash as an available/selectable model when Hermes did not advertise that model."
);
check(
  "Hermes configured model order is stable with project default first",
  Boolean(
    indexFile?.includes("STABLE_HERMES_MODEL_ORDER") &&
      indexFile?.includes("orderModelsWithDefaultFirst") &&
      indexFile?.includes('"moonshotai/kimi-k2.7-code"') &&
      indexFile?.includes('"gpt-oss-120b"') &&
      indexFile?.includes('"zai-glm-4.7"')
  ),
  "Hermes Configured order should keep DeepSeek and Kimi K2.7 Code ahead of GPT OSS 120B and Zai GLM 4.7 when Hermes advertises them."
);
check(
  "Hermes model labels preserve market acronyms",
  Boolean(
    indexFile?.includes('glm: "GLM"') &&
      indexFile?.includes('gpt: "GPT"') &&
      indexFile?.includes('oss: "OSS"') &&
      indexFile?.includes("MODEL_LABEL_UNITS")
  ),
  "Model labels should render Zai GLM 4.7 and GPT OSS 120B, not Zai Glm 4.7 or Gpt Oss 120b"
);
check(
  "Hermes provider labels render Cerebras as provider family",
  Boolean(
    indexFile?.includes("export function formatHermesProviderLabel") &&
      indexFile?.includes('return "Cerebras"') &&
      indexFile?.includes('return "NVIDIA"') &&
      indexFile?.includes("formatHermesProviderLabel(provider)")
  ),
  "Catalog/routing provider keys such as cerebras-gpt-oss-120b and nvidia should display as provider families"
);
check(
  "OpenRouter catalog client fetches and normalizes upstream model list",
  Boolean(
    indexFile?.includes("export async function getOpenRouterModelCatalog") &&
      indexFile?.includes("https://openrouter.ai/api/v1/models") &&
      indexFile?.includes("normalizeOpenRouterModels") &&
      indexFile?.includes('catalogSource: "ui-openrouter"')
  ),
  "UI-added models should come from a typed server-side OpenRouter catalog client."
);
check(
  "Loaded LM Studio models are session-selectable while unsafe local runtimes stay filtered",
  Boolean(
    indexFile?.includes('LOCAL_LMSTUDIO_PROVIDER_KEY = "local-lmstudio"') &&
      indexFile?.includes('providerKey.includes("lmstudio")') &&
      indexFile?.includes('providerKey.startsWith("local-") && !isLmStudioProvider') &&
      indexFile?.includes('"ollama-local"') &&
      indexFile?.includes('return "LM Studio"')
  ),
  "LM Studio models should be selectable through the provider-aware Hermes API; unverified local/Ollama providers should stay hidden."
);
check(
  "ambiguous NVIDIA/Nous routes are excluded from session-selectable catalog",
  Boolean(
    indexFile?.includes("UNSAFE_HTTP_SESSION_PROVIDER_KEYS") &&
      indexFile?.includes('"nvidia"') &&
      indexFile?.includes('"nous"') &&
      !indexFile?.includes("UNSAFE_HTTP_SESSION_MODEL_IDS")
  ),
  "Hermes' HTTP model switch path resolves ambiguous ids without explicit provider, so NVIDIA/Nous must stay out while OpenRouter Kimi is allowed and verified."
);
check(
  "direct Cerebras entries are excluded from session-selectable catalog",
  Boolean(
    indexFile?.includes('providerKey.startsWith("cerebras")') &&
      indexFile?.includes("Cerebras has been removed from the local Hermes config")
  ),
  "Cerebras should not be offered after being removed from the local Hermes config."
);
check(
  "Embeddings, Ollama tags, and non-LM Studio local models remain filtered",
  Boolean(
    indexFile?.includes('id.includes("embed")') &&
      indexFile?.includes('id.includes(":")') &&
      indexFile?.includes('providerKey.startsWith("local-") && !isLmStudioProvider')
  ),
  "Embeddings, Ollama-style tags, and unverified local providers should not appear as selectable chat models."
);
check(
  "LM Studio UI catalog tags unloaded chat models as not-loaded",
  Boolean(
    indexFile?.includes("const loadedInstances = Array.isArray(record.loaded_instances)") &&
      indexFile?.includes('loadedInstances.length === 0 ? "not-loaded" : "ready"') &&
      indexFile?.includes('type === "embedding"')
  ),
  "Installed-but-unloaded LM Studio models must be surfaced with availability so the Composer can disable them."
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
const sessionDetailRoutePath = "apps/web/src/app/api/hermes/sessions/[id]/route.ts";
const sessionDetailRouteFile = readFile(sessionDetailRoutePath);
check(
  "Session detail BFF route exists",
  existsSync(resolve(root, sessionDetailRoutePath)),
  "The UI needs a BFF read path to verify the active Hermes session model"
);
check(
  "Session detail BFF route uses getHermesSession",
  sessionDetailRouteFile?.includes("getHermesSession") ?? false
);
check(
  "Session detail BFF route is force-dynamic",
  sessionDetailRouteFile?.includes('dynamic = "force-dynamic"') ?? false
);
const openRouterCatalogRoutePath = "apps/web/src/app/api/model-catalog/openrouter/route.ts";
const openRouterCatalogRouteFile = readFile(openRouterCatalogRoutePath);
check(
  "OpenRouter model catalog BFF route exists",
  existsSync(resolve(root, openRouterCatalogRoutePath)),
  "Browser code should call the Web UI BFF for OpenRouter model catalog lookup."
);
check(
  "OpenRouter model catalog route keeps API key server-side",
  Boolean(
    openRouterCatalogRouteFile?.includes("getOpenRouterModelCatalog") &&
      openRouterCatalogRouteFile?.includes("process.env.OPENROUTER_API_KEY") &&
      !openRouterCatalogRouteFile?.includes("NEXT_PUBLIC")
  )
);
const chatStreamRouteFile = readFile("apps/web/src/app/api/hermes/chat/stream/route.ts");
const runtimeIdentityFile = readFile("apps/web/src/lib/hermesRuntimeIdentity.ts");
check(
  "Runtime identity instruction builder exists",
  Boolean(
    runtimeIdentityFile?.includes("buildHermesRuntimeIdentityInstruction") &&
      runtimeIdentityFile?.includes("Model selected in the UI for this turn") &&
      runtimeIdentityFile?.includes("answer with ${modelLabel} via ${providerLabel}") &&
      runtimeIdentityFile?.includes("treat the identity above as the correct one for this turn") &&
      // Foot-guns that primed weaker models to parrot a wrong identity must stay gone:
      !runtimeIdentityFile?.includes("gpt-oss-120b") &&
      !runtimeIdentityFile?.includes("DeepSeek, Gemma, or Qwen") &&
      !runtimeIdentityFile?.includes("billed backend route")
  ),
  "Runtime identity instruction states the selected model plainly and must not enumerate wrong model names or billing-proof framing that weaker models parrot back."
);
check(
  "Chat stream route includes selected runtime identity in instructions",
  Boolean(
    chatStreamRouteFile?.includes("buildHermesRuntimeIdentityInstruction") &&
      chatStreamRouteFile?.includes("joinInstructions") &&
      chatStreamRouteFile?.includes("modelRuntime") &&
      chatStreamRouteFile?.includes("model, modelRuntime, provider")
  )
);
check(
  "LM Studio catalog metadata stays behind BFF and enriches model runtime",
  Boolean(
    readFile("apps/web/src/app/api/model-catalog/lmstudio/route.ts")?.includes("getLmStudioModelCatalog") &&
      readFile("apps/web/src/hooks/useLmStudioModels.ts")?.includes("fetchLmStudioModels") &&
      readFile("apps/web/src/hooks/useHermesSessionModel.ts")?.includes("mergeLmStudioModels") &&
      readFile("apps/web/src/hooks/useHermesSessionModel.ts")?.includes("modelRuntime")
  ),
  "The browser should read local-model specs through the Web UI BFF and pass only typed runtime metadata through the session model pipeline."
);
check(
  "LM Studio catalog defaults to native metadata-rich model endpoint",
  Boolean(
    indexFile?.includes('LMSTUDIO_MODELS_URL = "http://127.0.0.1:1234/api/v1/models"') &&
      indexFile?.includes('url.pathname = "/api/v1/models"')
  ),
  "Local model discovery should use LM Studio's native /api/v1/models endpoint so the UI sees loaded context, quantization, and runtime settings."
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
  "Composer renders searchable grouped model browser",
  Boolean(
    composerFile?.includes("Search models") &&
    composerFile?.includes("ModelSection") &&
      composerFile?.includes('title="OpenRouter"') &&
      composerFile?.includes("groupModelOptions")
  )
);
check(
  "Composer shows modelLabel in button text",
  composerFile?.includes("{modelLabel}") ?? false
);
check(
  "Composer surfaces model select errors",
  Boolean(composerFile?.includes("modelSelectError") && composerFile?.includes('role="alert"'))
);
check(
  "Composer disables only unloaded LM Studio models",
  Boolean(
    composerFile?.includes('model.catalogSource === "ui-lmstudio"') &&
      composerFile?.includes("const disabled = notLoaded") &&
      composerFile?.includes("disabled={disabled}") &&
      composerFile?.includes('"LM Studio"')
  ),
  "Loaded LM Studio models should be selectable; installed-but-unloaded rows should remain disabled."
);

// --- 6. Session model pipeline feeds Composer and rail ---
const chatViewFile = readFile("apps/web/src/components/chat/ChatView.tsx");
check(
  "ChatView.tsx exists",
  chatViewFile !== null
);
check(
  "useHermesSessionModel hook exists",
  existsSync(resolve(root, "apps/web/src/hooks/useHermesSessionModel.ts"))
);
const sessionModelHookFile = readFile("apps/web/src/hooks/useHermesSessionModel.ts");
check(
  "useHermesSessionModel verifies selection by reading Hermes session detail",
  Boolean(
    sessionModelHookFile?.includes("fetchHermesSession") &&
      sessionModelHookFile?.includes("loadSessionModel") &&
      sessionModelHookFile?.includes("expectedMismatchMessage")
  ),
  "Composer selection must POST then read Hermes session truth before updating shared state"
);
check(
  "useHermesSessionModel keeps provider display override scoped to verified aliases",
  Boolean(
    sessionModelHookFile?.includes("Provider mismatches are rejected by the select pipeline") &&
      sessionModelHookFile?.includes("selected.selectModelId !== selected.id") &&
      sessionModelHookFile?.includes("return verifiedProvider;") &&
      sessionModelHookFile?.includes("return selected?.provider || verifiedProvider || fallbackProviderLabel;")
  ),
  "Provider mismatches such as OpenRouter -> NVIDIA must be rejected; readback labels only override alias-backed selections."
);
check(
  "useHermesSessionModel posts selected model through BFF route",
  Boolean(
    sessionModelHookFile?.includes("/api/hermes/model/select") &&
      sessionModelHookFile?.includes("expectedProviderKey") &&
      sessionModelHookFile?.includes("sessionTitle")
  )
);
check(
  "useHermesSessionModel keeps public OpenRouter-only models out of runtime selection",
  Boolean(
    sessionModelHookFile?.includes("openRouterModels") &&
      sessionModelHookFile?.includes("mergeOpenRouterModels") &&
      sessionModelHookFile?.includes("public OpenRouter-only models stay hidden") &&
      !sessionModelHookFile?.includes("availableModels: [...state.availableModels, ...extras]")
  ),
  "Only models advertised by Hermes /v1/models may be selectable; the public OpenRouter catalog is metadata only."
);
check(
  "UI-provided catalogs do not become unverified per-turn routes",
  Boolean(
    indexFile?.includes('catalogSource: "ui-openrouter"') &&
      indexFile?.includes('catalogSource: "ui-lmstudio"') &&
      countOccurrences(indexFile ?? "", 'selectionScope: "session"') >= 3 &&
      /catalogSource:\s*"ui-openrouter",\s*selectionScope:\s*"session"/s.test(indexFile ?? "") &&
      /catalogSource:\s*"ui-lmstudio",\s*selectionScope:\s*"session"/s.test(indexFile ?? "") &&
      !indexFile?.includes('catalogSource: "ui-openrouter",\n      selectionScope: "turn"') &&
      !indexFile?.includes('catalogSource: "ui-lmstudio",\n      selectionScope: "turn"')
  ),
  "UI-discovered models must not become active through an unverified per-turn hint."
);
check(
  "useHermesSessionModel persists and reapplies the last session model preference",
  Boolean(
    sessionModelHookFile?.includes("persistSessionModelPreference") &&
      sessionModelHookFile?.includes("activeSession?.modelPreference") &&
      sessionModelHookFile?.includes("preferenceFromSelectRequest") &&
      sessionModelHookFile?.includes("appliedPreferenceKeyRef") &&
      sessionModelHookFile?.includes('verified?.syncStatus === "synced"')
  ),
  "Refreshing the page must restore the last verified model selected in Composer, while failed selections must not poison session preference."
);
check(
  "useHermesSessionModel reapplies saved preference after Hermes reconnects",
  Boolean(
    sessionModelHookFile?.includes("needsReconnectRefresh") &&
      sessionModelHookFile?.includes('currentSnapshot.syncStatus === "unavailable"') &&
      sessionModelHookFile?.includes('currentSnapshot.syncStatus === "fallback"') &&
      sessionModelHookFile?.includes('currentSnapshot.syncStatus === "error"') &&
      sessionModelHookFile?.includes("hermesStatus?.reachable") &&
      sessionModelHookFile?.includes("appliedPreferenceKeyRef.current === preferenceKey && !needsReconnectRefresh")
  ),
  "Composer should not stay on Hermes unavailable after the status hook observes a reconnect."
);
check(
  "useHermesSessionModel refresh reapplies persisted Composer selection through verification",
  Boolean(
    sessionModelHookFile?.includes("const refreshModel = useCallback") &&
      sessionModelHookFile?.includes("await applySessionModelSelection(selectRequest, false)") &&
      sessionModelHookFile?.includes("refresh: refreshModel")
  ),
  "The post-send refresh must not replace a Composer choice without first reapplying the current verified selection."
);
check(
  "useHermesSessionModel ignores stale model-select responses and scopes errors to the selected model",
  Boolean(
    sessionModelHookFile?.includes("selectionSeqRef") &&
      sessionModelHookFile?.includes("isCurrentSelectionRequest") &&
      sessionModelHookFile?.includes("errorModelId") &&
      sessionModelHookFile?.includes("const scopedError") &&
      sessionModelHookFile?.includes("error: scopedError")
  ),
  "A slow failed selection must not leave a stale model error under a newer Composer model label."
);
check(
  "workspace state stores session model preference in persisted local workspace",
  Boolean(
    readFile("apps/web/src/data/types.ts")?.includes("SessionModelPreference") &&
      readFile("apps/web/src/lib/workspaceStore.ts")?.includes("setSessionModelPreference") &&
      readFile("apps/web/src/lib/workspaceStore.ts")?.includes("normalizeSessionModelPreference") &&
      readFile("apps/web/src/hooks/useWorkspaceState.ts")?.includes("setSessionModelPreference")
  )
);
check(
  "AppShell creates one shared Hermes session model pipeline",
  Boolean(
    readFile("apps/web/src/components/shell/AppShell.tsx")?.includes("useHermesSessionModel") &&
      readFile("apps/web/src/components/shell/AppShell.tsx")?.includes("sessionModel={hermesSessionModel}") &&
      readFile("apps/web/src/components/shell/AppShell.tsx")?.includes("hermesSessionModel={hermesSessionModel}") &&
      readFile("apps/web/src/components/shell/AppShell.tsx")?.includes("persistSessionModelPreference: actions.setSessionModelPreference")
  )
);
check(
  "AppShell loads UI-provided OpenRouter model catalog",
  Boolean(
    readFile("apps/web/src/components/shell/AppShell.tsx")?.includes("useOpenRouterModels") &&
      readFile("apps/web/src/components/shell/AppShell.tsx")?.includes("openRouterModels.models")
  )
);
check(
  "ChatView uses shared sessionModel for sends",
  Boolean(
    chatViewFile?.includes("const sendModelState = sessionModel.modelState") &&
      chatViewFile?.includes("const modelRequest = sessionModel.modelRequest")
  )
);
check(
  "successful Hermes streams clear stale session model pipeline errors",
  Boolean(
    sessionModelHookFile?.includes("markStreamSucceeded") &&
      sessionModelHookFile?.includes("streamSucceededSessionIdsRef") &&
      sessionModelHookFile?.includes("error: null") &&
      chatViewFile?.includes("streamCompletedSuccessfully") &&
      chatViewFile?.includes("sessionModel.markStreamSucceeded()")
  ),
  "A completed assistant stream proves Hermes is reachable and must not leave an old timeout/attention message in the right rail."
);
check(
  "ChatView does not immediately refresh session model after a successful stream",
  Boolean(
    chatViewFile?.includes("if (streamCompletedSuccessfully)") &&
      chatViewFile?.includes("sessionModel.markStreamSucceeded();") &&
      /}\s*else\s*{\s*void sessionModel\.refresh\(\);/.test(chatViewFile)
  ),
  "A flaky post-run session readback must not overwrite a successful chat stream with false unavailable/attention UI."
);
check(
  "useHermesSessionModel suppresses automatic post-stream readback but keeps forced verification",
  Boolean(
    sessionModelHookFile?.includes("!expected && !options.force && streamSucceededSessionIdsRef.current.has(hermesSessionId)") &&
      sessionModelHookFile?.includes("streamSucceededSessionIdsRef.current.add(hermesSessionId)") &&
      sessionModelHookFile?.includes("streamSucceededSessionIdsRef.current.delete(hermesSessionId)") &&
      sessionModelHookFile?.includes('await loadSessionModel("loading", undefined, { force: true })')
  ),
  "Workspace state updates after a successful stream must not re-fetch session detail and repaint stale timeout errors, while manual refresh still verifies."
);
check(
  "useHermesStatus preserves known model during transient refresh failures",
  Boolean(readFile("apps/web/src/hooks/useHermesStatus.ts")?.includes("preserveKnownModelOnTransientFailure")),
  "Polling must not reset composer model to unknown when Hermes was previously connected"
);
check(
  "useHermesStatus does not preserve stale model when reachable status says unavailable",
  Boolean(
    hookFile?.includes('next.mode === "error" || !next.reachable') &&
      !hookFile?.includes('next.uiCapabilities.models.selectionStatus === "unavailable"') &&
      !hookFile?.includes('next.uiCapabilities.models.selectionStatus === "unknown"')
  ),
  "A valid reachable status must be allowed to clear a model that Hermes no longer advertises."
);
check(
  "useHermesSessionModel does not display saved model preference while Hermes model state is unverified",
  (() => {
    const guard = sessionModelHookFile?.match(/function canApplySessionSelectedModel[\s\S]*?\n}/)?.[0] ?? "";
    return Boolean(
      sessionModelHookFile?.includes("!canApplySessionSelectedModel(state)") &&
        guard.includes("state.clientSelectable ||") &&
        guard.includes('state.selectionStatus === "server-configured"') &&
        guard.includes("state.availableModels.length > 0") &&
        !guard.includes('state.selectionStatus === "unknown"') &&
        !guard.includes('state.selectionStatus === "unavailable"')
    );
  })(),
  "A persisted OpenRouter/DeepSeek preference must not override the Composer label while Hermes is unavailable or model status is unknown."
);
check(
  "useHermesSessionModel keeps provider display override scoped to alias-backed selections",
  Boolean(
    sessionModelHookFile?.includes("function selectedProviderLabel") &&
      sessionModelHookFile?.includes("selected.selectModelId !== selected.id") &&
      sessionModelHookFile?.includes("return verifiedProvider;")
  ),
  "When a public catalog id is selected through a Hermes alias, the UI must display the provider Hermes actually verified."
);

// --- 7a. New: Explicit session model override capability ---
check(
  "HermesUiCapabilities.models has sessionModelOverrideCapable field",
  typesFile?.includes("sessionModelOverrideCapable: boolean") ?? false
);
check(
  "HermesUiCapabilities.models has explicitOverrideSupported field",
  typesFile?.includes("explicitOverrideSupported: boolean") ?? false
);
check(
  "normalizeHermesUiCapabilities reads session_model_override from capabilities",
  indexFile?.includes("session_model_override") ?? false
);
check(
  "normalizeHermesUiCapabilities checks explicitOverrideSupported for clientSelectable",
  indexFile?.includes("explicitOverrideSupported") ?? false
);
check(
  "catalog models are filtered to session-switchable entries for composer selection",
  Boolean(
    indexFile?.includes("isSessionSelectableCatalogModel") &&
      indexFile?.includes("catalogModels.filter(isSessionSelectableCatalogModel)")
  ),
  "GET /v1/models can include Copilot/local/embedding ids that Hermes cannot switch via POST /api/sessions/{id}/model"
);
check(
  "duplicate direct provider aliases defer to routed public catalog entries",
  Boolean(
    indexFile?.includes("preferPublicProviderCatalogModels") &&
      indexFile?.includes("providerKey === \"anthropic\"") &&
      indexFile?.includes("publicProviderAliases.has(catalogAliasKey(id))")
  ),
  "Claude direct Anthropic aliases can be selectable but return empty text locally; prefer the matching OpenRouter catalog id."
);
check(
  "session readback maps direct runtime aliases back to public catalog ids",
  Boolean(
    indexFile?.includes("export function resolveCatalogModelIdFromRuntimeModel") &&
      sessionModelHookFile?.includes("resolveCatalogModelIdFromRuntimeModel")
  ),
  "A session already on claude-sonnet-4-6 should recover to anthropic/claude-sonnet-4.6 for future sends."
);
check(
  "Smoke script for model switch exists",
  existsSync(resolve(root, "scripts/hermes-model-switch-smoke.mjs"))
);
check(
  "Smoke script calls BFF not Hermes directly",
  Boolean(
    readFile("scripts/hermes-model-switch-smoke.mjs")?.includes("/api/hermes/model/select") &&
    !readFile("scripts/hermes-model-switch-smoke.mjs")?.includes("process.env.HERMES_API_KEY")
  )
);
check(
  "Smoke script verifies selected model through session detail BFF route",
  Boolean(
    readFile("scripts/hermes-model-switch-smoke.mjs")?.includes("/api/hermes/sessions/${encodeURIComponent(sessionId)}") &&
      readFile("scripts/hermes-model-switch-smoke.mjs")?.includes("effectiveModel")
  )
);
check(
  "ChatView passes modelState to Composer",
  chatViewFile?.includes("modelState={providerModelState}") ?? false
);
check(
  "ChatView delegates model select to shared session pipeline",
  Boolean(
    chatViewFile?.includes("onModelSelect={sessionModel.selectModel}") &&
      !chatViewFile?.includes("/api/hermes/model/select")
  )
);
check(
  "HermesStatusPanel accepts sessionModel prop",
  Boolean(readFile("apps/web/src/components/shell/HermesStatusPanel.tsx")?.includes("sessionModel"))
);
check(
  "Composer blocks send while session model selection is verifying",
  Boolean(
    composerFile?.includes("!modelSelectInProgress") &&
      chatViewFile?.includes("if (!activeSession || isGenerating || modelSelectInProgress)")
  )
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
  Boolean(
    hookFile?.includes("...current") &&
      /isRefreshing:\s*(?:true|[^,\n]*true)/.test(hookFile ?? "")
  ),
  "Refresh must spread current state so status is preserved while isRefreshing=true"
);
check(
  "useHermesStatus has meaningful equality gate to skip redundant setState",
  Boolean(hookFile?.includes("isMeaningfullyChanged")),
  "Equality check prevents unnecessary re-renders when Hermes state hasn't changed"
);
check(
  "useHermesStatus repaints when Hermes model catalog changes",
  Boolean(hookFile?.includes("modelListSignature") && hookFile?.includes("availableModels")),
  "Newly configured Hermes models must update the Composer even when the current model label stays unchanged."
);
check(
  "Manual Hermes refresh can force a model catalog refresh",
  Boolean(
    readFile("apps/web/src/lib/server/hermesStatusProbe.ts")?.includes("forceModels") &&
      readFile("apps/web/src/app/api/hermes/status/route.ts")?.includes("refreshModels") &&
      readFile("apps/web/src/lib/hermesStatusClient.ts")?.includes("refreshModels=true") &&
      readFile("apps/web/src/components/shell/AppShell.tsx")?.includes("refreshModels: true")
  ),
  "The refresh button should pull newly configured Hermes models instead of waiting for the background model-cache TTL."
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
