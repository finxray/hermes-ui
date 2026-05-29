import type {
  BrainMemoryInspectRequest,
  BrainMemorySearchContext,
  NormalizedBrainMemoryInspectResponse,
  NormalizedBrainMemorySearchResponse,
  NormalizedBrainMemoryStatus
} from "@hermes-ui/brain-memory-client";

export async function fetchBrainMemoryStatus(): Promise<NormalizedBrainMemoryStatus> {
  try {
    const response = await fetch("/api/brain-memory/status", {
      cache: "no-store"
    });

    if (!response.ok) {
      return brainMemoryStatusError(`Brain Memory status route returned HTTP ${response.status}.`);
    }

    return (await response.json()) as NormalizedBrainMemoryStatus;
  } catch {
    return brainMemoryStatusError("Could not reach the local Brain Memory status route.");
  }
}

export async function searchBrainMemoryViaBff(args: {
  context: BrainMemorySearchContext;
  limit?: number;
  query: string;
}): Promise<NormalizedBrainMemorySearchResponse> {
  try {
    const response = await fetch("/api/brain-memory/search", {
      body: JSON.stringify({
        context: args.context,
        limit: args.limit ?? 8,
        query: args.query
      }),
      cache: "no-store",
      headers: {
        "Content-Type": "application/json"
      },
      method: "POST"
    });

    if (!response.ok) {
      return brainMemorySearchError(
        args.query,
        `Brain Memory search route returned HTTP ${response.status}.`
      );
    }

    return (await response.json()) as NormalizedBrainMemorySearchResponse;
  } catch {
    return brainMemorySearchError(args.query, "Could not reach the local Brain Memory search route.");
  }
}

export async function inspectBrainMemoryViaBff(
  args: BrainMemoryInspectRequest
): Promise<NormalizedBrainMemoryInspectResponse> {
  try {
    const response = await fetch("/api/brain-memory/memory/inspect", {
      body: JSON.stringify(args),
      cache: "no-store",
      headers: {
        "Content-Type": "application/json"
      },
      method: "POST"
    });

    if (!response.ok) {
      return brainMemoryInspectError(
        args.memoryId,
        `Brain Memory inspect route returned HTTP ${response.status}.`
      );
    }

    return (await response.json()) as NormalizedBrainMemoryInspectResponse;
  } catch {
    return brainMemoryInspectError(
      args.memoryId,
      "Could not reach the local Brain Memory inspect route."
    );
  }
}

function brainMemoryStatusError(message: string): NormalizedBrainMemoryStatus {
  return {
    mode: "error",
    configured: false,
    reachable: false,
    baseUrl: null,
    health: null,
    capabilities: null,
    error: {
      kind: "network",
      message
    },
    checkedAt: new Date().toISOString()
  };
}

function brainMemorySearchError(
  query: string,
  message: string
): NormalizedBrainMemorySearchResponse {
  return {
    mode: "error",
    query,
    results: [],
    error: {
      kind: "network",
      message
    },
    searchedAt: new Date().toISOString()
  };
}

function brainMemoryInspectError(
  memoryId: string,
  message: string
): NormalizedBrainMemoryInspectResponse {
  return {
    mode: "error",
    memoryId,
    detail: null,
    evidence: null,
    supersession: null,
    error: {
      kind: "network",
      message
    },
    checkedAt: new Date().toISOString()
  };
}
