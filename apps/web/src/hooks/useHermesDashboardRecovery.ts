"use client";

import { useCallback, useEffect, useState } from "react";
import type { HermesDashboardStartResult, HermesDashboardStatus } from "@/lib/hermesDashboardRecovery";
import { fetchHermesDashboardStatus, startHermesDashboard } from "@/lib/hermesDashboardRecovery";

export function useHermesDashboardRecovery(enabled: boolean) {
  const [status, setStatus] = useState<HermesDashboardStatus | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [isStarting, setIsStarting] = useState(false);

  const refreshStatus = useCallback(async () => {
    if (!enabled) {
      setStatus(null);
      setIsChecking(false);
      return null;
    }
    setIsChecking(true);
    const result = await fetchHermesDashboardStatus();
    setStatus(result);
    setIsChecking(false);
    return result;
  }, [enabled]);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  const start = useCallback(async (): Promise<HermesDashboardStartResult> => {
    setIsStarting(true);
    const result = await startHermesDashboard();
    if (result.ok) {
      await refreshStatus();
    }
    setIsStarting(false);
    return result;
  }, [refreshStatus]);

  return { isChecking, isStarting, refreshStatus, start, status };
}
