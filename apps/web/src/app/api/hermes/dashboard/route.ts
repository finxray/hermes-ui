import { NextResponse } from "next/server";
import type { HermesDashboardStartResult, HermesDashboardStatus } from "@/lib/hermesDashboardRecovery";
import {
  isAllowedDashboardStartRequest,
  launchHermesDashboard,
  probeHermesDashboard,
  resolveDashboardTarget,
  waitForHermesDashboard
} from "@/server/hermesDashboardLauncher";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

let dashboardStartPromise: Promise<boolean> | null = null;

export async function GET() {
  const checkedAt = new Date().toISOString();
  const target = resolveDashboardTarget();
  const reachable = target.baseUrl ? (await probeHermesDashboard(target.baseUrl)).reachable : false;
  const result: HermesDashboardStatus = {
    ok: true,
    reachable,
    canStart: !reachable && target.canStart,
    checkedAt,
    reason: reachable ? null : target.reason
  };
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const checkedAt = new Date().toISOString();
  const target = resolveDashboardTarget();
  if (!isAllowedDashboardStartRequest(request) || !target.baseUrl || !target.canStart) {
    const result: HermesDashboardStartResult = {
      ok: false,
      status: "blocked",
      checkedAt,
      error: {
        kind: "blocked",
        message: target.reason ?? "Dashboard startup is allowed only from this local Hermes UI."
      }
    };
    return NextResponse.json(result, { status: 403 });
  }

  if ((await probeHermesDashboard(target.baseUrl)).reachable) {
    const result: HermesDashboardStartResult = {
      ok: true,
      status: "already_running",
      checkedAt,
      error: null
    };
    return NextResponse.json(result);
  }

  try {
    dashboardStartPromise ??= (async () => {
      await launchHermesDashboard(target.baseUrl!);
      return waitForHermesDashboard(target.baseUrl!);
    })().finally(() => {
      dashboardStartPromise = null;
    });

    if (await dashboardStartPromise) {
      const result: HermesDashboardStartResult = {
        ok: true,
        status: "started",
        checkedAt: new Date().toISOString(),
        error: null
      };
      return NextResponse.json(result);
    }

    const result: HermesDashboardStartResult = {
      ok: false,
      status: "failed",
      checkedAt: new Date().toISOString(),
      error: {
        kind: "timeout",
        message: "Hermes Dashboard did not become ready. Run `hermes dashboard --no-open` in the Hermes environment."
      }
    };
    return NextResponse.json(result, { status: 504 });
  } catch (error) {
    console.error("Hermes Dashboard launch failed", error);
    const detail = error instanceof Error ? error.message : "Unknown launcher error";
    const result: HermesDashboardStartResult = {
      ok: false,
      status: "failed",
      checkedAt: new Date().toISOString(),
      error: {
        kind: "launch_failed",
        message: process.env.NODE_ENV === "development"
          ? `Hermes Dashboard could not be started: ${detail}`
          : "Hermes Dashboard could not be started. Run `hermes dashboard --no-open` in the Hermes environment."
      }
    };
    return NextResponse.json(result, { status: 502 });
  }
}
