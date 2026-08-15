import { NextResponse } from "next/server";
import type { HermesServerStartResult, HermesServerStatus } from "@/lib/hermesServerRecovery";
import {
  isAllowedHermesServerStartRequest,
  hermesServerTimeoutMessage,
  launchHermesServer,
  probeHermesServer,
  resolveHermesServerTarget,
  waitForHermesServer
} from "@/server/hermesServerLauncher";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const recoveryState = globalThis as typeof globalThis & {
  __stoixHermesServerStartPromise?: Promise<boolean> | null;
};

export async function GET() {
  const target = resolveHermesServerTarget();
  const reachable = target.baseUrl ? await probeHermesServer(target.baseUrl) : false;
  const result: HermesServerStatus = {
    ok: true,
    reachable,
    canStart: !reachable && target.canStart,
    checkedAt: new Date().toISOString(),
    reason: reachable ? null : target.reason
  };
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const target = resolveHermesServerTarget();
  if (!isAllowedHermesServerStartRequest(request) || !target.baseUrl || !target.canStart) {
    const result: HermesServerStartResult = {
      ok: false,
      status: "blocked",
      checkedAt: new Date().toISOString(),
      error: {
        kind: "blocked",
        message: target.reason ?? "Hermes startup is allowed only from this local Stoix UI."
      }
    };
    return NextResponse.json(result, { status: 403 });
  }

  if (await probeHermesServer(target.baseUrl)) {
    const result: HermesServerStartResult = {
      ok: true,
      status: "already_running",
      checkedAt: new Date().toISOString(),
      error: null
    };
    return NextResponse.json(result);
  }

  try {
    recoveryState.__stoixHermesServerStartPromise ??= (async () => {
      await launchHermesServer(target.baseUrl!);
      return waitForHermesServer(target.baseUrl!);
    })().finally(() => {
      recoveryState.__stoixHermesServerStartPromise = null;
    });

    if (await recoveryState.__stoixHermesServerStartPromise) {
      const result: HermesServerStartResult = {
        ok: true,
        status: "started",
        checkedAt: new Date().toISOString(),
        error: null
      };
      return NextResponse.json(result);
    }

    const result: HermesServerStartResult = {
      ok: false,
      status: "failed",
      checkedAt: new Date().toISOString(),
      error: {
        kind: "timeout",
        message: hermesServerTimeoutMessage()
      }
    };
    return NextResponse.json(result, { status: 504 });
  } catch (error) {
    console.error("Hermes server launch failed", error);
    const detail = error instanceof Error ? error.message : "Unknown launcher error";
    const result: HermesServerStartResult = {
      ok: false,
      status: "failed",
      checkedAt: new Date().toISOString(),
      error: {
        kind: "launch_failed",
        message: process.env.NODE_ENV === "development"
          ? `Hermes could not be launched: ${detail}`
          : "Hermes could not be launched. Start the local Hermes server and try again."
      }
    };
    return NextResponse.json(result, { status: 502 });
  }
}
