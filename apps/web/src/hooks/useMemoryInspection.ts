"use client";

import { useCallback, useState } from "react";
import { inspectBrainMemoryViaBff } from "@/lib/brainMemoryClient";
import type {
  BrainMemoryInspectRequest,
  NormalizedBrainMemoryInspectResponse
} from "@hermes-ui/brain-memory-client";

type MemoryInspectionState = {
  isInspecting: boolean;
  response: NormalizedBrainMemoryInspectResponse | null;
};

export function useMemoryInspection() {
  const [state, setState] = useState<MemoryInspectionState>({
    isInspecting: false,
    response: null
  });

  const inspect = useCallback(async (args: BrainMemoryInspectRequest) => {
    setState((current) => ({ ...current, isInspecting: true }));
    const response = await inspectBrainMemoryViaBff(args);
    setState({ isInspecting: false, response });
    return response;
  }, []);

  const clearInspection = useCallback(() => {
    setState({ isInspecting: false, response: null });
  }, []);

  return {
    clearInspection,
    inspect,
    isInspecting: state.isInspecting,
    response: state.response
  };
}
