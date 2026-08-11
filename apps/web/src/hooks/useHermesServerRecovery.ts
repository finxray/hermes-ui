"use client";

import { useCallback, useEffect, useState } from "react";
import {
  fetchHermesServerStatus,
  startHermesServer,
  type HermesServerStartResult,
  type HermesServerStatus
} from "@/lib/hermesServerRecovery";

export function useHermesServerRecovery(enabled: boolean) {
  const [status, setStatus] = useState<HermesServerStatus | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [isStarting, setIsStarting] = useState(false);

  const refreshStatus = useCallback(async () => {
    if (!enabled) {
      setStatus(null);
      setIsChecking(false);
      return null;
    }
    setIsChecking(true);
    const result = await fetchHermesServerStatus();
    setStatus(result);
    setIsChecking(false);
    return result;
  }, [enabled]);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  const start = useCallback(async (): Promise<HermesServerStartResult> => {
    setIsStarting(true);
    const result = await startHermesServer();
    if (result.ok) {
      await refreshStatus();
    }
    setIsStarting(false);
    return result;
  }, [refreshStatus]);

  return { isChecking, isStarting, refreshStatus, start, status };
}
