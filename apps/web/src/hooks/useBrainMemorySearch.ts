"use client";

import { useCallback, useState } from "react";
import type {
  BrainMemorySearchContext,
  NormalizedBrainMemorySearchResponse
} from "@hermes-ui/brain-memory-client";
import { searchBrainMemoryViaBff } from "@/lib/brainMemoryClient";

type BrainMemorySearchState = {
  isSearching: boolean;
  lastResponse: NormalizedBrainMemorySearchResponse | null;
};

export function useBrainMemorySearch() {
  const [state, setState] = useState<BrainMemorySearchState>({
    isSearching: false,
    lastResponse: null
  });

  const search = useCallback(async (args: {
    context: BrainMemorySearchContext;
    limit?: number;
    query: string;
  }) => {
    setState((current) => ({ ...current, isSearching: true }));
    const response = await searchBrainMemoryViaBff(args);
    setState({ isSearching: false, lastResponse: response });
    return response;
  }, []);

  return {
    isSearching: state.isSearching,
    lastResponse: state.lastResponse,
    search
  };
}
