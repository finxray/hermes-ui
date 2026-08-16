import { getHermesStatus, type HermesClientConfig, type NormalizedHermesStatus } from "@hermes-ui/hermes-client";

// Reachability is resolved from the cheap `/health` probe and cached briefly.
const STATUS_TTL_OK_MS = 4_000;
const STATUS_TTL_ERROR_MS = 6_000;

// `/v1/models` is expensive on Hermes (it can take ~20s and blocks the single
// request worker while it runs, starving `/health`). Fetch it rarely, in the
// background, and serve the last-known catalog in between.
const MODELS_TTL_MS = 5 * 60_000;
const MODELS_RETRY_MS = 45_000;
const MODELS_TIMEOUT_MS = 30_000;

// A single timed-out `/health` (typically because a model refresh is wedging
// Hermes, or a brief server stall) should not flip the UI to "unreachable".
const HEALTH_TIMEOUT_MS = 4_000;
const REACHABLE_GRACE_MS = 45_000;

type StatusCacheState = {
  expiresAt: number;
  inFlight: Promise<NormalizedHermesStatus> | null;
  value: NormalizedHermesStatus | null;
};

type ModelsCacheState = {
  value: Record<string, unknown> | null;
  fetchedAt: number;
  lastAttemptAt: number;
  inFlight: Promise<void> | null;
};

const statusCache: StatusCacheState = {
  expiresAt: 0,
  inFlight: null,
  value: null
};

const modelsCache: ModelsCacheState = {
  value: null,
  fetchedAt: 0,
  lastAttemptAt: 0,
  inFlight: null
};

const lastReachable: { status: NormalizedHermesStatus | null; at: number } = {
  status: null,
  at: 0
};

let activeConnectionIdentity = "";

export async function getCoalescedHermesStatus(
  config: HermesClientConfig,
  options: { forceModels?: boolean } = {}
): Promise<NormalizedHermesStatus> {
  resetCachesForConnectionChange(config);
  const now = Date.now();
  if (options.forceModels) {
    if (statusCache.inFlight) {
      await statusCache.inFlight;
    }
    statusCache.expiresAt = 0;
    const baseline = await computeStatus(config);
    storeStatus(baseline);
    if (!baseline.reachable) {
      return baseline;
    }
    await refreshModelsIfStale(config, true);
    statusCache.expiresAt = 0;
  }

  if (statusCache.value && statusCache.expiresAt > now) {
    if (statusCache.value.reachable) {
      triggerModelsRefreshIfStale(config);
    }
    return statusCache.value;
  }

  if (statusCache.inFlight) {
    return statusCache.inFlight;
  }

  statusCache.inFlight = computeStatus(config)
    .then((status) => {
      storeStatus(status);
      statusCache.inFlight = null;
      if (status.reachable) {
        triggerModelsRefreshIfStale(config);
      }
      return status;
    })
    .catch((error) => {
      statusCache.inFlight = null;
      throw error;
    });

  return statusCache.inFlight;
}

function storeStatus(status: NormalizedHermesStatus): void {
  statusCache.value = status;
  statusCache.expiresAt = Date.now() + (status.reachable ? STATUS_TTL_OK_MS : STATUS_TTL_ERROR_MS);
}

function resetCachesForConnectionChange(config: HermesClientConfig): void {
  const identity = JSON.stringify([
    config.enabled !== false,
    config.baseUrl?.trim() || "",
    config.apiKey || ""
  ]);
  if (identity === activeConnectionIdentity) {
    return;
  }
  activeConnectionIdentity = identity;
  statusCache.expiresAt = 0;
  statusCache.inFlight = null;
  statusCache.value = null;
  modelsCache.value = null;
  modelsCache.fetchedAt = 0;
  modelsCache.lastAttemptAt = 0;
  modelsCache.inFlight = null;
  lastReachable.status = null;
  lastReachable.at = 0;
}

async function computeStatus(config: HermesClientConfig): Promise<NormalizedHermesStatus> {
  // While the slow `/v1/models` refresh is in flight it blocks Hermes, so a
  // concurrent `/health` probe would time out. Serve the last good status within
  // the grace window instead of piling another doomed request onto Hermes.
  if (
    modelsCache.inFlight &&
    lastReachable.status &&
    Date.now() - lastReachable.at < REACHABLE_GRACE_MS
  ) {
    return refreshedReachableStatus();
  }

  const status = await getHermesStatus({
    ...config,
    includeModels: false,
    injectedModels: modelsCache.value,
    timeoutMs: HEALTH_TIMEOUT_MS
  });

  return applyReachableGrace(status);
}

function applyReachableGrace(status: NormalizedHermesStatus): NormalizedHermesStatus {
  if (status.reachable) {
    lastReachable.status = status;
    lastReachable.at = Date.now();
    return status;
  }

  // Only ride over transient connectivity errors (timeout/network). Genuine
  // "unconfigured"/"disabled"/"mock" states are reported as-is.
  if (
    status.mode === "error" &&
    lastReachable.status &&
    Date.now() - lastReachable.at < REACHABLE_GRACE_MS
  ) {
    return refreshedReachableStatus();
  }

  return status;
}

function refreshedReachableStatus(): NormalizedHermesStatus {
  return {
    ...(lastReachable.status as NormalizedHermesStatus),
    checkedAt: new Date().toISOString()
  };
}

function triggerModelsRefreshIfStale(config: HermesClientConfig): void {
  void refreshModelsIfStale(config, false);
}

function refreshModelsIfStale(config: HermesClientConfig, force: boolean): Promise<void> | null {
  if (config.enabled === false || !config.baseUrl?.trim()) {
    return null;
  }

  const now = Date.now();
  const stale = !modelsCache.value || now - modelsCache.fetchedAt >= MODELS_TTL_MS;
  const recentlyAttempted = !force && now - modelsCache.lastAttemptAt < MODELS_RETRY_MS;
  if (modelsCache.inFlight) {
    return modelsCache.inFlight;
  }
  if (!force && (!stale || recentlyAttempted)) {
    return null;
  }

  modelsCache.lastAttemptAt = now;
  modelsCache.inFlight = getHermesStatus({
    ...config,
    includeModels: true,
    injectedModels: modelsCache.value,
    modelsTimeoutMs: MODELS_TIMEOUT_MS,
    timeoutMs: HEALTH_TIMEOUT_MS
  })
    .then((status) => {
      if (
        status.reachable &&
        status.models &&
        status.models !== config.injectedModels &&
        hasUsableModelPayload(status.models)
      ) {
        modelsCache.value = status.models;
        modelsCache.fetchedAt = Date.now();
      }
    })
    .catch(() => {
      // Keep the last-known catalog; the next poll retries after MODELS_RETRY_MS.
    })
    .finally(() => {
      modelsCache.inFlight = null;
    });
  return modelsCache.inFlight;
}

function hasUsableModelPayload(models: Record<string, unknown>): boolean {
  for (const candidate of [models.model, models.default_model]) {
    if (typeof candidate === "string" && candidate.trim() && candidate.trim() !== "hermes-agent") {
      return true;
    }
  }
  if (models.providers && typeof models.providers === "object") {
    return true;
  }
  return Array.isArray(models.data) && models.data.some((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return false;
    const id = (item as Record<string, unknown>).id;
    return typeof id === "string" && id.trim() !== "" && id.trim() !== "hermes-agent";
  });
}
