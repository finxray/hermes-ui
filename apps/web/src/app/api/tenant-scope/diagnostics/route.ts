import { NextResponse } from "next/server";
import { redactTenantScopePosture } from "@/lib/tenantScopeDiagnostics";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json(
    {
      redactedPosture: redactTenantScopePosture({
        allowedTenants: parseAllowedTenants(process.env.BRAIN_MEMORY_ALLOWED_TENANTS_SUMMARY),
        gatewayMemoryKey: process.env.BRAIN_MEMORY_GATEWAY_MEMORY_API_KEY,
        mcpApiKey: process.env.BRAIN_MEMORY_MCP_API_KEY_SET === "true" ? "set" : null,
        uiApiKey: process.env.BRAIN_MEMORY_UI_API_KEY
      })
    },
    {
      headers: {
        "Cache-Control": "no-store"
      }
    }
  );
}

function parseAllowedTenants(value?: string | null): string[] {
  return value
    ? value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
    : [];
}
