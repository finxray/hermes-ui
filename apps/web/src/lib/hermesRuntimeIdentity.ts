import { formatHermesModelLabel, formatHermesProviderLabel } from "@hermes-ui/hermes-client";

type RuntimeIdentityInput = {
  model: string | null;
  provider: string | null;
};

export function buildHermesRuntimeIdentityInstruction({
  model,
  provider
}: RuntimeIdentityInput): string | null {
  const modelId = cleanInstructionValue(model);
  if (!modelId) {
    return null;
  }

  const providerKey = cleanInstructionValue(provider);
  const modelLabel = formatHermesModelLabel(modelId);
  const providerLabel = formatHermesProviderLabel(providerKey) || "Hermes configured provider";

  return [
    "Runtime model identity for this turn:",
    `- modelId: ${modelId}`,
    `- model: ${modelLabel}`,
    `- provider: ${providerLabel}`,
    "",
    "If the user asks what model, provider, or model specs are being used, answer from this runtime identity.",
    "Use the provider display name above in user-facing answers; do not mention raw routing keys unless the user explicitly asks for internal routing/debug details.",
    "Do not claim to be a fallback/default model such as DeepSeek unless the runtime model identity above is DeepSeek.",
    "If detailed model specs are not available in this context, say that Hermes selected the model above but did not expose detailed specs."
  ].join("\n");
}

function cleanInstructionValue(value: string | null): string {
  return value?.replace(/[\r\n\x00]/g, " ").trim().slice(0, 160) ?? "";
}
