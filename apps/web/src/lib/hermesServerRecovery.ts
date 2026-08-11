export type HermesServerStatus = {
  ok: true;
  reachable: boolean;
  canStart: boolean;
  checkedAt: string;
  reason: string | null;
};

export type HermesServerStartResult =
  | { ok: true; status: "already_running" | "started"; checkedAt: string; error: null }
  | {
      ok: false;
      status: "blocked" | "failed";
      checkedAt: string;
      error: { kind: "blocked" | "launch_failed" | "timeout"; message: string };
    };

export async function fetchHermesServerStatus(): Promise<HermesServerStatus> {
  try {
    const response = await fetch("/api/hermes/server", { cache: "no-store" });
    return (await response.json()) as HermesServerStatus;
  } catch {
    return {
      ok: true,
      reachable: false,
      canStart: false,
      checkedAt: new Date().toISOString(),
      reason: "Could not reach the local Hermes recovery route."
    };
  }
}

export async function startHermesServer(): Promise<HermesServerStartResult> {
  try {
    const response = await fetch("/api/hermes/server", {
      cache: "no-store",
      headers: { "X-Hermes-UI-Action": "start-server" },
      method: "POST"
    });
    return (await response.json()) as HermesServerStartResult;
  } catch {
    return {
      ok: false,
      status: "failed",
      checkedAt: new Date().toISOString(),
      error: { kind: "launch_failed", message: "Could not reach the local Hermes recovery route." }
    };
  }
}
