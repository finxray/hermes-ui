import type { HermesTokenUsage } from "@hermes-ui/hermes-client";

// A single Hermes run can fan out into several upstream model requests (tool
// loops, planner + responder turns, retries). Each upstream request reports its
// own usage in a `message_done` / `metadata` / `usage` stream event. The chat UI
// used to keep only the *latest* sample, so a multi-request run showed a single
// request's `in`/`out` counts instead of the run total - output came from one
// request and the prompt size collapsed to whatever the final (often small)
// follow-up request reported.
//
// This accumulator restores a correct run total by adding usage up per request:
//
//   - Samples are bucketed by their request identity (`requestId`, else
//     `generationId`). Distinct ids are summed; repeated ids (the same request
//     echoed by both a `message_done` and a trailing `metadata`/run event) are
//     merged with a field-wise max so a request is never counted twice.
//   - Samples that carry no id at all (cumulative run-level usage, or providers
//     that omit ids) are merged into one shared bucket, also with a field-wise
//     max.
//   - The reported total is, per additive field, `max(sum of id buckets,
//     id-less bucket)`. That sums genuine per-request usage while staying
//     double-count safe: if Hermes also emits a cumulative run total with no id,
//     the `max` collapses to it instead of stacking on top of the per-request
//     sum.
//
// Non-additive metadata (model, provider, route evidence, latency, throughput)
// is carried latest-wins so route verification and the response-stats footer
// keep reflecting the most recent request.

const ADDITIVE_FIELDS = [
  "promptTokens",
  "completionTokens",
  "totalTokens",
  "cachedTokens",
  "reasoningTokens",
  "costUsd"
] as const;

const META_FIELDS = [
  "provider",
  "model",
  "upstreamModel",
  "generationId",
  "requestId",
  "finishReason",
  "requestedModel",
  "requestedProvider",
  "routeMismatch",
  "routeVerified",
  "source",
  "latencyMs",
  "tokensPerSecond",
  "timeToFirstTokenMs"
] as const;

type AdditiveField = (typeof ADDITIVE_FIELDS)[number];
type MetaField = (typeof META_FIELDS)[number];

export type TokenUsageAccumulator = {
  /** Merge one stream usage sample and return the current run aggregate. */
  add: (usage: HermesTokenUsage | undefined) => HermesTokenUsage | undefined;
  /** The current run aggregate without merging a new sample. */
  snapshot: () => HermesTokenUsage | undefined;
};

export function createTokenUsageAccumulator(): TokenUsageAccumulator {
  const byRequest = new Map<string, HermesTokenUsage>();
  let idLess: HermesTokenUsage | null = null;
  const meta: HermesTokenUsage = {};

  const add = (usage: HermesTokenUsage | undefined): HermesTokenUsage | undefined => {
    if (!usage) {
      return snapshot();
    }

    for (const field of META_FIELDS) {
      const value = usage[field];
      if (value !== undefined && value !== "") {
        meta[field] = value as never;
      }
    }

    const requestKey = usageRequestKey(usage);
    if (requestKey) {
      byRequest.set(requestKey, mergeMaxAdditive(byRequest.get(requestKey), usage));
    } else {
      idLess = mergeMaxAdditive(idLess, usage);
    }

    return snapshot();
  };

  const snapshot = (): HermesTokenUsage | undefined => {
    if (byRequest.size === 0 && !idLess) {
      return Object.keys(meta).length > 0 ? { ...meta } : undefined;
    }

    const summed: Partial<Record<AdditiveField, number>> = {};
    for (const bucket of byRequest.values()) {
      for (const field of ADDITIVE_FIELDS) {
        const value = bucket[field];
        if (typeof value === "number") {
          summed[field] = (summed[field] ?? 0) + value;
        }
      }
    }

    const result: HermesTokenUsage = {};
    for (const field of ADDITIVE_FIELDS) {
      const idLessValue = idLess ? idLess[field] : undefined;
      const value = maxDefined(summed[field], typeof idLessValue === "number" ? idLessValue : undefined);
      if (value !== undefined) {
        result[field] = value;
      }
    }

    if (typeof result.promptTokens === "number" || typeof result.completionTokens === "number") {
      result.totalTokens = (result.promptTokens ?? 0) + (result.completionTokens ?? 0);
    }

    for (const field of META_FIELDS) {
      const value = meta[field];
      if (value !== undefined) {
        result[field] = value as never;
      }
    }

    return Object.keys(result).length > 0 ? result : undefined;
  };

  return { add, snapshot };
}

function usageRequestKey(usage: HermesTokenUsage): string | null {
  const requestId = typeof usage.requestId === "string" ? usage.requestId.trim() : "";
  if (requestId) {
    return `request:${requestId}`;
  }
  const generationId = typeof usage.generationId === "string" ? usage.generationId.trim() : "";
  if (generationId) {
    return `generation:${generationId}`;
  }
  return null;
}

function mergeMaxAdditive(
  target: HermesTokenUsage | null | undefined,
  incoming: HermesTokenUsage
): HermesTokenUsage {
  const merged: HermesTokenUsage = { ...(target ?? {}) };
  for (const field of ADDITIVE_FIELDS) {
    const value = incoming[field];
    if (typeof value === "number") {
      const existing = merged[field];
      merged[field] = typeof existing === "number" ? Math.max(existing, value) : value;
    }
  }
  return merged;
}

function maxDefined(a: number | undefined, b: number | undefined): number | undefined {
  if (a === undefined) {
    return b;
  }
  if (b === undefined) {
    return a;
  }
  return Math.max(a, b);
}
