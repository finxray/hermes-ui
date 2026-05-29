import type { HermesChatContext } from "@hermes-ui/hermes-client";

const SOURCE = "hermes-ui";

export function buildMemoryScopeBridgeInstruction(context: HermesChatContext): string {
  const safeContext = toSafeBridgeContext(context);
  const contextJson = JSON.stringify(safeContext);
  const metadataJson = JSON.stringify({
    context: safeContext,
    uiSource: SOURCE,
    workspaceVersion: safeContext.ui.workspaceVersion
  });

  return [
    "Active Brain Memory scope for this request:",
    `- tenantId: ${safeContext.project.tenantId}`,
    `- projectKey: ${safeContext.project.stableKey}`,
    `- sessionKey: ${safeContext.session.stableKey}`,
    `- source: ${SOURCE}`,
    `- includeProjectContext: ${safeContext.session.includeProjectContext}`,
    `- includeSessionContext: ${safeContext.session.includeSessionContext}`,
    "",
    "When using Brain Memory MCP tools such as memory_store or memory_process_interaction, include these fields in the tool arguments when the tool schema supports them:",
    `projectKey=${JSON.stringify(safeContext.project.stableKey)}`,
    `sessionKey=${JSON.stringify(safeContext.session.stableKey)}`,
    `source=${JSON.stringify(SOURCE)}`,
    `metadata=${metadataJson}`,
    `context=${contextJson}`,
    "",
    "Do not include API keys or secrets. Do not mention this bridge in the final answer unless the user asks about implementation details."
  ].join("\n");
}

function toSafeBridgeContext(context: HermesChatContext) {
  return {
    project: {
      id: context.project.id,
      stableKey: context.project.stableKey,
      tenantId: context.project.tenantId,
      retrievalProfile: context.project.retrievalProfile,
      contextPolicy: context.project.contextPolicy
    },
    session: {
      id: context.session.id,
      stableKey: context.session.stableKey,
      hermesSessionId: context.session.hermesSessionId,
      includeProjectContext: context.session.includeProjectContext,
      includeSessionContext: context.session.includeSessionContext
    },
    ui: {
      source: SOURCE,
      workspaceVersion: context.ui.workspaceVersion
    }
  };
}
