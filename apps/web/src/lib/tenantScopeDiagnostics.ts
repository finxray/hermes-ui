import type { NormalizedBrainMemoryStatus } from "@hermes-ui/brain-memory-client";
import type { NormalizedHermesStatus } from "@hermes-ui/hermes-client";
import type { Project, Session } from "@/data/types";

export type TenantScopeDiagnostics = {
  ui: {
    tenantId: string;
    projectStableKey: string;
    sessionStableKey: string;
    hermesSessionId?: string;
  };
  brainMemoryBff: {
    mode: string;
    configured: boolean;
    reachable: boolean;
    baseUrl?: string;
  };
  hermes: {
    configured: boolean;
    reachable: boolean;
    sessionKeyHeader?: string;
    memoryScopeBridgeActive?: boolean;
  };
  checks: {
    uiTenantIsLocalDev: boolean;
    projectKeyContainsTenant: boolean;
    sessionKeyContainsTenant: boolean;
    bffRealWhenExpected: boolean;
    warnings: string[];
    errors: string[];
  };
  redactedPosture: {
    gatewayMemoryKeySet?: boolean;
    uiApiKeySet?: boolean;
    mcpApiKeySet?: boolean;
    allowedTenantsSummary?: string;
  };
};

export type TenantScopeDiagnosticsInput = {
  activeProject: Project;
  activeSession: Session | null;
  brainMemoryStatus: NormalizedBrainMemoryStatus | null;
  hermesStatus: NormalizedHermesStatus | null;
  redactedPosture?: TenantScopeDiagnostics["redactedPosture"] | null;
};

const LOCAL_MVP_TENANT = "local-dev";

export function buildTenantScopeDiagnostics({
  activeProject,
  activeSession,
  brainMemoryStatus,
  hermesStatus,
  redactedPosture
}: TenantScopeDiagnosticsInput): TenantScopeDiagnostics {
  const tenantId = activeProject.memoryScope.tenantId;
  const projectStableKey = activeProject.memoryScope.stableProjectKey;
  const sessionStableKey = activeSession?.memoryScope.stableSessionKey ?? "";
  const warnings: string[] = [];
  const errors: string[] = [];

  const uiTenantIsLocalDev = tenantId === LOCAL_MVP_TENANT;
  const projectKeyContainsTenant = stableKeyContainsTenant(projectStableKey, tenantId);
  const sessionKeyContainsTenant = activeSession
    ? stableKeyContainsTenant(sessionStableKey, tenantId)
    : true;
  const bffRealWhenExpected = brainMemoryStatus
    ? brainMemoryStatus.mode !== "real" || brainMemoryStatus.reachable === true
    : true;

  if (!uiTenantIsLocalDev) {
    errors.push(`UI tenant is ${tenantId}; local MVP expects ${LOCAL_MVP_TENANT}.`);
  }
  if (!projectKeyContainsTenant) {
    errors.push("Project stable key does not contain the active tenant id.");
  }
  if (!sessionKeyContainsTenant) {
    errors.push("Session stable key does not contain the active tenant id.");
  }
  if (brainMemoryStatus?.mode === "real" && brainMemoryStatus.reachable !== true) {
    errors.push("Brain Memory BFF reports real mode but is not reachable.");
  }
  if (!activeSession) {
    warnings.push("No active session is selected; session scope is unavailable.");
  }
  if (!hermesStatus) {
    warnings.push("Hermes status has not loaded yet.");
  }
  if (!brainMemoryStatus) {
    warnings.push("Brain Memory BFF status has not loaded yet.");
  }
  if (hermesStatus && hermesStatus.uiCapabilities.memory.instructionBridgeActive !== true) {
    warnings.push("Hermes memory scope bridge is not active.");
  }

  return {
    ui: {
      tenantId,
      projectStableKey,
      sessionStableKey: sessionStableKey || "No active session",
      hermesSessionId: activeSession?.hermesSessionId
    },
    brainMemoryBff: {
      mode: brainMemoryStatus?.mode ?? "checking",
      configured: brainMemoryStatus?.configured === true,
      reachable: brainMemoryStatus?.reachable === true,
      baseUrl: brainMemoryStatus?.baseUrl ?? undefined
    },
    hermes: {
      configured: hermesStatus?.configured === true,
      reachable: hermesStatus?.reachable === true,
      sessionKeyHeader: hermesStatus?.uiCapabilities.memory.sessionKeyHeader ?? undefined,
      memoryScopeBridgeActive: hermesStatus?.uiCapabilities.memory.instructionBridgeActive
    },
    checks: {
      uiTenantIsLocalDev,
      projectKeyContainsTenant,
      sessionKeyContainsTenant,
      bffRealWhenExpected,
      warnings,
      errors
    },
    redactedPosture: redactedPosture ?? {}
  };
}

export function redactTenantScopePosture(input: {
  gatewayMemoryKey?: string | null;
  uiApiKey?: string | null;
  mcpApiKey?: string | null;
  allowedTenants?: string[] | null;
}): TenantScopeDiagnostics["redactedPosture"] {
  return {
    allowedTenantsSummary: summarizeAllowedTenants(input.allowedTenants),
    gatewayMemoryKeySet: Boolean(input.gatewayMemoryKey?.trim()),
    mcpApiKeySet: Boolean(input.mcpApiKey?.trim()),
    uiApiKeySet: Boolean(input.uiApiKey?.trim())
  };
}

function stableKeyContainsTenant(stableKey: string, tenantId: string): boolean {
  return Boolean(stableKey && tenantId && stableKey.includes(`:${tenantId}:`));
}

function summarizeAllowedTenants(values?: string[] | null): string | undefined {
  if (!values || values.length === 0) {
    return undefined;
  }
  const unique = Array.from(new Set(values.filter(Boolean))).sort();
  if (unique.includes("*")) {
    return "wildcard";
  }
  if (unique.length > 3) {
    return `${unique.slice(0, 3).join(", ")} +${unique.length - 3}`;
  }
  return unique.join(", ");
}
