"use client";

import { useCallback, useEffect, useState } from "react";
import type { TenantScopeDiagnostics } from "@/lib/tenantScopeDiagnostics";

type State = {
  posture: TenantScopeDiagnostics["redactedPosture"] | null;
  isLoading: boolean;
};

export function useTenantScopeDiagnosticsPosture() {
  const [state, setState] = useState<State>({
    isLoading: true,
    posture: null
  });

  const refresh = useCallback(async () => {
    setState((current) => ({ ...current, isLoading: true }));
    try {
      const response = await fetch("/api/tenant-scope/diagnostics", {
        cache: "no-store"
      });
      if (!response.ok) {
        setState({ isLoading: false, posture: null });
        return;
      }
      const data = (await response.json()) as {
        redactedPosture?: TenantScopeDiagnostics["redactedPosture"];
      };
      setState({ isLoading: false, posture: data.redactedPosture ?? null });
    } catch {
      setState({ isLoading: false, posture: null });
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    isLoading: state.isLoading,
    posture: state.posture,
    refresh
  };
}
