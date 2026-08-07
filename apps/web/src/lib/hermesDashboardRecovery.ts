export type HermesDashboardStatus = {
  ok: true;
  reachable: boolean;
  canStart: boolean;
  checkedAt: string;
  reason: string | null;
};

export type HermesDashboardStartResult =
  | {
      ok: true;
      status: "already_running" | "started";
      checkedAt: string;
      error: null;
    }
  | {
      ok: false;
      status: "blocked" | "failed";
      checkedAt: string;
      error: { kind: "blocked" | "launch_failed" | "timeout"; message: string };
    };

export async function fetchHermesDashboardStatus(): Promise<HermesDashboardStatus> {
  try {
    const response = await fetch("/api/hermes/dashboard", { cache: "no-store" });
    return (await response.json()) as HermesDashboardStatus;
  } catch {
    return {
      ok: true,
      reachable: false,
      canStart: false,
      checkedAt: new Date().toISOString(),
      reason: "Could not reach the local Dashboard recovery route."
    };
  }
}
export async function startHermesDashboard(): Promise<HermesDashboardStartResult> {
  try {
    const response = await fetch("/api/hermes/dashboard", {
      cache: "no-store",
      headers: { "X-Hermes-UI-Action": "start-dashboard" },
      method: "POST"
    });
    return (await response.json()) as HermesDashboardStartResult;
  } catch {
    return {
      ok: false,
      status: "failed",
      checkedAt: new Date().toISOString(),
      error: { kind: "launch_failed", message: "Could not reach the local Dashboard recovery route." }
    };
  }
}
