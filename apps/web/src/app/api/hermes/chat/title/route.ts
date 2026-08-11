import {
  generateHermesSessionTitle,
  type HermesChatContext,
  type HermesTitleRequest
} from "@hermes-ui/hermes-client";
import { NextResponse } from "next/server";
import { isTrustedMutationRequest } from "@/lib/server/requestTrust";
import { resolveHermesClientConfig } from "@/server/hermesClientConfig";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_BODY_BYTES = 16_000;
const MAX_MESSAGE_CHARS = 8_000;

export async function POST(request: Request) {
  if (!isTrustedMutationRequest(request)) {
    return NextResponse.json(
      { error: { kind: "forbidden", message: "Cross-origin requests are not allowed." } },
      { status: 403 }
    );
  }

  const parsed = await readTitleRequest(request);
  if (!parsed) {
    return NextResponse.json(
      { error: { kind: "bad_response", message: "A valid first message and chat context are required." } },
      { status: 400 }
    );
  }

  const config = await resolveHermesClientConfig({ signal: request.signal, timeoutMs: 30_000 });
  const result = await generateHermesSessionTitle(config, parsed);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ title: result.title });
}

async function readTitleRequest(request: Request): Promise<HermesTitleRequest | null> {
  const raw = await request.text();
  if (!raw || raw.length > MAX_BODY_BYTES) {
    return null;
  }
  let body: unknown;
  try {
    body = JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
  const record = readObject(body);
  const context = readContext(record?.context);
  const message = cleanText(record?.message, MAX_MESSAGE_CHARS);
  if (!context || !message) {
    return null;
  }
  return {
    context,
    message,
    model: cleanOptionalText(record?.model, 160),
    provider: cleanOptionalText(record?.provider, 120)
  };
}

function readContext(value: unknown): HermesChatContext | null {
  const source = readObject(value);
  const project = readObject(source?.project);
  const session = readObject(source?.session);
  const ui = readObject(source?.ui);
  const workspaceVersion = Number(ui?.workspaceVersion);
  const result: HermesChatContext = {
    project: {
      id: cleanText(project?.id, 256),
      title: cleanText(project?.title, 256),
      stableKey: cleanText(project?.stableKey, 256),
      userVisibleSummary: cleanOptionalText(project?.userVisibleSummary, 512) ?? undefined
    },
    session: {
      id: cleanText(session?.id, 256),
      title: cleanText(session?.title, 256),
      stableKey: cleanText(session?.stableKey, 256),
      hermesSessionId: cleanText(session?.hermesSessionId, 256),
      includeProjectContext: false,
      includeSessionContext: false
    },
    ui: { source: "hermes-ui", workspaceVersion }
  };
  if (
    !result.project.id ||
    !result.project.title ||
    !result.project.stableKey ||
    !result.session.id ||
    !result.session.title ||
    !result.session.stableKey ||
    !result.session.hermesSessionId ||
    !Number.isInteger(workspaceVersion)
  ) {
    return null;
  }
  return result;
}

function readObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function cleanText(value: unknown, maxLength: number): string {
  return typeof value === "string"
    ? value.replace(/[\x00]/g, "").trim().slice(0, maxLength)
    : "";
}

function cleanOptionalText(value: unknown, maxLength: number): string | null {
  const clean = cleanText(value, maxLength).replace(/[\r\n]/g, " ");
  return clean || null;
}
