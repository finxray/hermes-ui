import {
  getBrainMemoryStatus,
  inspectBrainMemory,
  searchBrainMemory,
  type BrainMemorySearchContext,
  type NormalizedBrainMemoryInspectResponse,
  type NormalizedBrainMemorySearchResponse
} from "@hermes-ui/brain-memory-client";
import {
  runHermesRunsProbe,
  type HermesChatContext,
  type HermesRunsProbeResult
} from "@hermes-ui/hermes-client";
import { NextResponse } from "next/server";
import { createActivityEventFromHermesRunsEvent } from "@/lib/agentActivityEvents";
import { buildMemoryScopeBridgeInstruction } from "@/lib/memoryScopeBridge";
import { redactTenantScopePosture } from "@/lib/tenantScopeDiagnostics";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ACK_TEXT = "BM_RUNS_MEMORY_STORED";
const DEFAULT_TIMEOUT_MS = 35_000;
const MAX_BODY_BYTES = 8_000;

export async function POST(request: Request) {
  const body = await readOptionalBody(request);
  const marker = sanitizeMarker(body.marker) ?? makeMarker();
  const context = makeProbeContext(body);
  const checkedAt = new Date().toISOString();
  const brainMemoryConfig = {
    baseUrl: process.env.BRAIN_MEMORY_GATEWAY_URL,
    enabled: process.env.BRAIN_MEMORY_UI_ENABLE_REAL_GATEWAY === "true",
    gatewayMemoryApiKey: process.env.BRAIN_MEMORY_GATEWAY_MEMORY_API_KEY,
    legacyApiKey: process.env.BRAIN_MEMORY_API_KEY,
    timeoutMs: 7_500,
    uiApiKey: process.env.BRAIN_MEMORY_UI_API_KEY
  };

  const brainMemoryStatus = await getBrainMemoryStatus(brainMemoryConfig);
  if (brainMemoryStatus.mode !== "real" || brainMemoryStatus.reachable !== true) {
    return json({
      ok: false,
      mode: "skipped",
      checkedAt,
      marker,
      context: publicContext(context),
      brainMemoryStatus,
      error: {
        kind: brainMemoryStatus.error?.kind ?? "unconfigured",
        message: "Brain Memory Gateway is not real/reachable for the Runs memory probe."
      },
      safety: safetySummary()
    });
  }

  const run = await runHermesRunsProbe(
    {
      apiKey: process.env.HERMES_API_KEY,
      baseUrl: process.env.HERMES_API_BASE_URL,
      enabled: process.env.HERMES_UI_ENABLE_REAL_HERMES !== "false",
      timeoutMs: DEFAULT_TIMEOUT_MS
    },
    {
      expectedText: ACK_TEXT,
      instructions: makeMemoryProbeInstructions(context),
      memoryMutationRequested: true,
      memoryScopeKey: context.project.stableKey,
      prompt: makeMemoryProbePrompt(marker),
      promptKind: "memory-probe",
      sessionId: context.session.hermesSessionId,
      timeoutMs: DEFAULT_TIMEOUT_MS
    }
  );

  const sameSessionSearch = run.ok
    ? await waitForMarkerSearch(brainMemoryConfig, marker, toBrainMemoryContext(context))
    : null;
  const firstResult = sameSessionSearch?.found ?? null;
  const inspect = firstResult
    ? await inspectBrainMemory(brainMemoryConfig, {
        context: toBrainMemoryContext(context),
        memoryId: firstResult.id
      })
    : null;
  const differentProjectSearch = await searchBrainMemory(brainMemoryConfig, {
    context: toBrainMemoryContext(makeDifferentProjectContext(context)),
    limit: 5,
    query: marker
  });
  const differentSessionSearch = await searchBrainMemory(brainMemoryConfig, {
    context: toBrainMemoryContext(makeDifferentSessionContext(context)),
    limit: 5,
    query: marker
  });
  const normalization = summarizeRunsNormalization(run);
  const scope = summarizeScope({
    context,
    differentProjectSearch,
    differentSessionSearch,
    inspect,
    sameSessionSearch: sameSessionSearch?.response ?? null
  });
  const parityPassed =
    run.ok &&
    sameSessionSearch?.found !== null &&
    Boolean(inspect?.detail) &&
    scope.sameSessionFound &&
    scope.inspectMatchesProject &&
    scope.inspectMatchesSession &&
    scope.differentProjectAbsent &&
    scope.differentSessionAbsent &&
    normalization.memoryActivityEvents > 0;

  return json({
    ok: parityPassed,
    mode: parityPassed ? "success" : "failed",
    checkedAt,
    marker,
    expectedText: ACK_TEXT,
    context: publicContext(context),
    brainMemoryStatus,
    tenantPosture: {
      redactedPosture: redactTenantScopePosture({
        allowedTenants: parseAllowedTenants(process.env.BRAIN_MEMORY_ALLOWED_TENANTS_SUMMARY),
        gatewayMemoryKey: process.env.BRAIN_MEMORY_GATEWAY_MEMORY_API_KEY,
        mcpApiKey: process.env.BRAIN_MEMORY_MCP_API_KEY_SET === "true" ? "set" : null,
        uiApiKey: process.env.BRAIN_MEMORY_UI_API_KEY
      })
    },
    run,
    normalization,
    search: {
      sameSession: summarizeSearch(sameSessionSearch?.response ?? null, marker),
      differentProject: summarizeSearch(differentProjectSearch, marker),
      differentSession: summarizeSearch(differentSessionSearch, marker)
    },
    inspect: summarizeInspect(inspect),
    scope,
    safety: safetySummary(),
    blocker: parityPassed ? null : blockerFor({ inspect, normalization, run, sameSessionSearch, scope })
  });
}

function makeMemoryProbePrompt(marker: string) {
  return `Store this harmless Hermes Runs memory probe marker in Brain Memory exactly: ${marker}. Then reply ${ACK_TEXT}.`;
}

function makeMemoryProbeInstructions(context: HermesChatContext) {
  return [
    buildMemoryScopeBridgeInstruction(context),
    "",
    "This is an opt-in diagnostic Brain Memory parity probe.",
    "Use Brain Memory MCP tools only if needed to store the marker requested by the user.",
    "Do not run commands, read or write files, browse the web, call external network resources, or request approvals.",
    `After the Brain Memory storage attempt, reply exactly ${ACK_TEXT} if the marker was stored.`
  ].join("\n");
}

async function waitForMarkerSearch(
  config: Parameters<typeof searchBrainMemory>[0],
  marker: string,
  context: BrainMemorySearchContext
) {
  let latest: NormalizedBrainMemorySearchResponse | null = null;
  for (let attempt = 0; attempt < 10; attempt += 1) {
    latest = await searchBrainMemory(config, { context, limit: 5, query: marker });
    const found = findMarkerResult(latest, marker);
    if (found || latest.mode !== "real") {
      return { found, response: latest };
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  return { found: null, response: latest };
}

function summarizeRunsNormalization(run: HermesRunsProbeResult) {
  const activityEvents = run.events
    .map((event) =>
      createActivityEventFromHermesRunsEvent(
        {
          event: event.event,
          error: event.errorPreview,
          output: event.outputPreview,
          preview: event.outputPreview || event.errorPreview || event.deltaPreview,
          run_id: event.runId ?? run.runId ?? undefined,
          timestamp: event.timestamp,
          tool: event.toolName
        },
        { now: run.checkedAt }
      )
    )
    .filter((event): event is NonNullable<typeof event> => Boolean(event));
  const ids = new Set(activityEvents.map((event) => event.id));

  return {
    activityEvents: activityEvents.length,
    memoryActivityEvents: activityEvents.filter((event) => event.type === "memory").length,
    toolActivityEvents: activityEvents.filter((event) => event.type === "tool").length,
    commandActivityEvents: activityEvents.filter((event) => event.type === "command").length,
    reasoningActivityEvents: activityEvents.filter((event) => event.type === "reasoning").length,
    statusActivityEvents: activityEvents.filter((event) => event.type === "status").length,
    uniqueEventIds: ids.size === activityEvents.length,
    rawReasoningTextRendered: activityEvents.some(
      (event) => event.metadata?.rawReasoningTextRendered === true
    ),
    redactionPolicy: "reasoning text omitted; secret-like fields redacted by AgentActivityEvent helper"
  };
}

function summarizeScope(args: {
  context: HermesChatContext;
  differentProjectSearch: NormalizedBrainMemorySearchResponse;
  differentSessionSearch: NormalizedBrainMemorySearchResponse;
  inspect: NormalizedBrainMemoryInspectResponse | null;
  sameSessionSearch: NormalizedBrainMemorySearchResponse | null;
}) {
  const detail = args.inspect?.detail;
  return {
    sameSessionFound: Boolean(args.sameSessionSearch && findMarkerResult(args.sameSessionSearch, "")),
    sameSessionMode: args.sameSessionSearch?.mode ?? null,
    inspectMatchesProject: detail?.projectKey === args.context.project.stableKey,
    inspectMatchesSession: detail?.sessionKey === args.context.session.stableKey,
    inspectScopeStatus: detail?.scopeStatus ?? null,
    inspectTenant: detail?.scope?.tenantId ?? null,
    differentProjectAbsent: args.differentProjectSearch.mode === "real" &&
      args.differentProjectSearch.results.length === 0,
    differentSessionAbsent: args.differentSessionSearch.mode === "real" &&
      args.differentSessionSearch.results.length === 0,
    expectedProjectKey: args.context.project.stableKey,
    expectedSessionKey: args.context.session.stableKey,
    expectedTenantId: args.context.project.tenantId
  };
}

function summarizeSearch(response: NormalizedBrainMemorySearchResponse | null, marker: string) {
  const found = response ? findMarkerResult(response, marker) : null;
  return {
    mode: response?.mode ?? null,
    resultCount: response?.results.length ?? 0,
    found: Boolean(found),
    firstResultId: found?.id ?? null,
    firstProjectKey: found?.projectKey ?? null,
    firstSessionKey: found?.sessionKey ?? null,
    firstScopeStatus: found?.scopeStatus ?? null,
    scope: response?.scope ?? null,
    error: response?.error ?? null
  };
}

function summarizeInspect(response: NormalizedBrainMemoryInspectResponse | null) {
  return {
    mode: response?.mode ?? null,
    memoryId: response?.memoryId ?? null,
    hasDetail: Boolean(response?.detail),
    projectKey: response?.detail?.projectKey ?? null,
    sessionKey: response?.detail?.sessionKey ?? null,
    scopeStatus: response?.detail?.scopeStatus ?? null,
    tenantId: response?.detail?.scope?.tenantId ?? null,
    layer: response?.detail?.layer ?? null,
    source: response?.detail?.source ?? null,
    error: response?.error ?? null
  };
}

function blockerFor(args: {
  inspect: NormalizedBrainMemoryInspectResponse | null;
  normalization: ReturnType<typeof summarizeRunsNormalization>;
  run: HermesRunsProbeResult;
  sameSessionSearch: Awaited<ReturnType<typeof waitForMarkerSearch>> | null;
  scope: ReturnType<typeof summarizeScope>;
}) {
  if (!args.run.ok) {
    return "Hermes Runs memory probe did not complete with the expected acknowledgement.";
  }
  if (!args.sameSessionSearch?.found) {
    return "Hermes replied, but Brain Memory BFF search did not find the marker in the same project/session scope.";
  }
  if (!args.inspect?.detail) {
    return "Brain Memory BFF inspect did not return detail for the stored marker.";
  }
  if (!args.scope.inspectMatchesProject || !args.scope.inspectMatchesSession) {
    return "Brain Memory inspect detail did not match the expected project/session scope.";
  }
  if (!args.scope.differentProjectAbsent || !args.scope.differentSessionAbsent) {
    return "Brain Memory scope isolation failed for different project or different session search.";
  }
  if (args.normalization.memoryActivityEvents === 0) {
    return "Runs completed and BFF search found the marker, but no Brain Memory tool event was exposed in the Runs event stream.";
  }
  return "Runs Brain Memory parity did not satisfy all required checks.";
}

function findMarkerResult(response: NormalizedBrainMemorySearchResponse, marker: string) {
  const query = marker || response.query;
  return response.results.find((result) =>
    [result.content, result.snippet, result.title].some((value) => value?.includes(query))
  ) ?? null;
}

function makeProbeContext(body: Record<string, unknown>): HermesChatContext {
  const projectId = sanitizeId(body.projectId, "project-runs-memory-16d");
  const sessionId = sanitizeId(body.sessionId, "session-runs-memory-16d");
  const tenantId = sanitizeId(body.tenantId, "local-dev");
  const projectStableKey = `studio:${tenantId}:project:${projectId}`;
  const sessionStableKey = `${projectStableKey}:session:${sessionId}`;

  return {
    project: {
      contextPolicy: "project-and-session",
      id: projectId,
      pinnedMemoryIds: [],
      retrievalProfile: "balanced",
      stableKey: projectStableKey,
      tenantId,
      title: "Runs Memory Parity"
    },
    session: {
      hermesSessionId: `hermes-session-${sessionId}`,
      id: sessionId,
      includeProjectContext: true,
      includeSessionContext: true,
      stableKey: sessionStableKey,
      title: "Runs Memory Parity"
    },
    ui: {
      source: "hermes-ui",
      workspaceVersion: 1
    }
  };
}

function makeDifferentProjectContext(context: HermesChatContext): HermesChatContext {
  const projectId = `${context.project.id}-other`;
  const projectStableKey = `studio:${context.project.tenantId}:project:${projectId}`;
  const sessionId = `${context.session.id}-other-project`;
  return {
    ...context,
    project: {
      ...context.project,
      id: projectId,
      stableKey: projectStableKey,
      title: "Runs Memory Parity Other Project"
    },
    session: {
      ...context.session,
      hermesSessionId: `hermes-session-${sessionId}`,
      id: sessionId,
      stableKey: `${projectStableKey}:session:${sessionId}`,
      title: "Runs Memory Parity Other Project"
    }
  };
}

function makeDifferentSessionContext(context: HermesChatContext): HermesChatContext {
  const sessionId = `${context.session.id}-other`;
  return {
    ...context,
    session: {
      ...context.session,
      hermesSessionId: `hermes-session-${sessionId}`,
      id: sessionId,
      stableKey: `${context.project.stableKey}:session:${sessionId}`,
      title: "Runs Memory Parity Other Session"
    }
  };
}

function toBrainMemoryContext(context: HermesChatContext): BrainMemorySearchContext {
  return {
    project: {
      contextPolicy: context.project.contextPolicy,
      id: context.project.id,
      retrievalProfile: context.project.retrievalProfile,
      stableKey: context.project.stableKey,
      tenantId: context.project.tenantId,
      title: context.project.title
    },
    session: {
      id: context.session.id,
      includeProjectContext: context.session.includeProjectContext,
      includeSessionContext: context.session.includeSessionContext,
      stableKey: context.session.stableKey,
      title: context.session.title
    },
    ui: context.ui
  };
}

function publicContext(context: HermesChatContext) {
  return {
    project: {
      id: context.project.id,
      stableKey: context.project.stableKey,
      tenantId: context.project.tenantId
    },
    session: {
      id: context.session.id,
      hermesSessionId: context.session.hermesSessionId,
      stableKey: context.session.stableKey
    }
  };
}

async function readOptionalBody(request: Request): Promise<Record<string, unknown>> {
  const raw = await request.text();
  if (!raw.trim()) {
    return {};
  }
  if (raw.length > MAX_BODY_BYTES) {
    return {};
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function json(value: unknown) {
  return NextResponse.json(value, {
    headers: {
      "Cache-Control": "no-store"
    }
  });
}

function makeMarker() {
  const stamp = new Date().toISOString().replace(/\D/g, "").slice(0, 14);
  const random = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `BM_RUNS_MEMORY_16D_${stamp}_${random}`;
}

function sanitizeMarker(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }
  const clean = value.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 96);
  return clean.startsWith("BM_RUNS_MEMORY_16D_") ? clean : null;
}

function sanitizeId(value: unknown, fallback: string) {
  return typeof value === "string"
    ? value.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 96) || fallback
    : fallback;
}

function parseAllowedTenants(value?: string | null): string[] {
  return value
    ? value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
    : [];
}

function safetySummary() {
  return {
    approvalCalled: false,
    browserDirectBrainMemory: false,
    browserDirectHermes: false,
    directStorageAccess: false,
    memoryMutationPath: "Hermes MCP only",
    route: "bff-only",
    stopCalled: false
  };
}
