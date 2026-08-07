"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import appPackage from "../../package.json";
import {
  UPDATE_CHECK_INTERVAL_MS,
  isUpdateCheckDue,
  type AppUpdateResponse,
  type UpdateChannel
} from "@/lib/appUpdate";

const UPDATE_CACHE_KEY_PREFIX = "stoix.app-update";

type CachedUpdateState = {
  checkedAt: number;
  result: AppUpdateResponse;
};

export function useAppUpdate(initialChannel: UpdateChannel = "stable") {
  const [channel, setChannel] = useState<UpdateChannel>(initialChannel);
  const [isChecking, setIsChecking] = useState(false);
  const [result, setResult] = useState<AppUpdateResponse | null>(null);
  const [lastCheckedAt, setLastCheckedAt] = useState<number | null>(null);
  const [lastSeenVersion, setLastSeenVersion] = useState<string | null>(null);
  const [hydratedChannel, setHydratedChannel] = useState<UpdateChannel | null>(null);
  const inFlightCheckRef = useRef<Promise<AppUpdateResponse> | null>(null);

  const check = useCallback(async (nextChannel: UpdateChannel = channel) => {
    if (inFlightCheckRef.current) return inFlightCheckRef.current;

    const pendingCheck = (async () => {
      setIsChecking(true);
      try {
        const response = await fetch(`/api/app-update?channel=${encodeURIComponent(nextChannel)}`, {
          cache: "no-store"
        });
        const payload = (await response.json()) as AppUpdateResponse;
        persistUpdateState(nextChannel, payload);
        setResult(payload);
        setLastCheckedAt(Date.now());
        return payload;
      } catch (error) {
        const failure: AppUpdateResponse = {
          artifact: null,
          channel: nextChannel,
          currentVersion: appPackage.version,
          error: error instanceof Error ? error.message : "Could not check for updates.",
          latestVersion: null,
          manifest: null,
          status: "error"
        };
        persistUpdateState(nextChannel, failure);
        setResult(failure);
        setLastCheckedAt(Date.now());
        return failure;
      } finally {
        setIsChecking(false);
        inFlightCheckRef.current = null;
      }
    })();

    inFlightCheckRef.current = pendingCheck;
    return pendingCheck;
  }, [channel]);

  const changeChannel = useCallback((nextChannel: UpdateChannel) => {
    setChannel(nextChannel);
    setResult(null);
    setLastCheckedAt(null);
    setHydratedChannel(null);
  }, []);

  const markUpdateSeen = useCallback(() => {
    if (result?.status !== "update-available" || !result.latestVersion) return;
    safeStorageSet(seenVersionKey(channel), result.latestVersion);
    setLastSeenVersion(result.latestVersion);
  }, [channel, result]);

  useEffect(() => {
    const cached = readCachedUpdateState(channel);
    setResult(cached?.result ?? null);
    setLastCheckedAt(cached?.checkedAt ?? null);
    setLastSeenVersion(safeStorageGet(seenVersionKey(channel)));
    setHydratedChannel(channel);
  }, [channel]);

  useEffect(() => {
    if (hydratedChannel !== channel) return;

    const now = Date.now();
    const delay = isUpdateCheckDue(lastCheckedAt, now)
      ? 0
      : Math.max(1_000, UPDATE_CHECK_INTERVAL_MS - (now - (lastCheckedAt ?? now)));
    const timer = window.setTimeout(() => {
      void check(channel);
    }, delay);
    return () => window.clearTimeout(timer);
  }, [channel, check, hydratedChannel, lastCheckedAt]);

  const hasUnseenUpdate =
    result?.status === "update-available" &&
    Boolean(result.latestVersion) &&
    result.latestVersion !== lastSeenVersion;

  return {
    channel,
    changeChannel,
    check,
    hasUnseenUpdate,
    isChecking,
    lastCheckedAt,
    markUpdateSeen,
    result
  };
}

export type AppUpdateController = ReturnType<typeof useAppUpdate>;

function cacheKey(channel: UpdateChannel) {
  return `${UPDATE_CACHE_KEY_PREFIX}.${channel}`;
}

function seenVersionKey(channel: UpdateChannel) {
  return `${UPDATE_CACHE_KEY_PREFIX}.${channel}.seen-version`;
}

function persistUpdateState(channel: UpdateChannel, result: AppUpdateResponse) {
  const state: CachedUpdateState = { checkedAt: Date.now(), result };
  safeStorageSet(cacheKey(channel), JSON.stringify(state));
}

function readCachedUpdateState(channel: UpdateChannel): CachedUpdateState | null {
  try {
    const value = safeStorageGet(cacheKey(channel));
    if (!value) return null;
    const parsed = JSON.parse(value) as Partial<CachedUpdateState>;
    if (!Number.isFinite(parsed.checkedAt) || !parsed.result || parsed.result.channel !== channel) return null;
    return parsed as CachedUpdateState;
  } catch {
    return null;
  }
}

function safeStorageGet(key: string) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeStorageSet(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Update checks remain usable when browser persistence is unavailable.
  }
}
