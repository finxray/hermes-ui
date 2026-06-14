import { formatHermesModelLabel, formatHermesProviderLabel } from "@hermes-ui/hermes-client";
import type { HermesModelRuntimeMetadata } from "@hermes-ui/hermes-client";

type RuntimeIdentityInput = {
  model: string | null;
  modelRuntime?: HermesModelRuntimeMetadata | null;
  provider: string | null;
};

export function buildHermesRuntimeIdentityInstruction({
  model,
  modelRuntime = null,
  provider
}: RuntimeIdentityInput): string | null {
  const modelId = cleanInstructionValue(model);
  if (!modelId) {
    return null;
  }

  const providerKey = cleanInstructionValue(provider);
  const modelLabel = formatHermesModelLabel(modelId);
  const providerLabel = formatHermesProviderLabel(providerKey) || "Hermes configured provider";
  const runtimeLines = formatRuntimeLines(modelRuntime);

  return [
    "Runtime model identity for this turn:",
    `- modelId: ${modelId}`,
    `- model: ${modelLabel}`,
    `- provider: ${providerLabel}`,
    ...runtimeLines,
    "",
    "If the user asks what model, provider, or model specs are being used, answer from this runtime identity.",
    "Use the provider display name above in user-facing answers; do not mention raw routing keys unless the user explicitly asks for internal routing/debug details.",
    "Do not claim to be a fallback/default model such as DeepSeek unless the runtime model identity above is DeepSeek.",
    runtimeLines.length > 0
      ? "The runtime specs above describe the active local serving configuration when supplied by LM Studio; do not infer missing specs."
      : "If detailed model specs are not available in this context, say that Hermes selected the model above but did not expose detailed specs."
  ].join("\n");
}

function cleanInstructionValue(value: string | null): string {
  return value?.replace(/[\r\n\x00]/g, " ").trim().slice(0, 160) ?? "";
}

function formatRuntimeLines(runtime: HermesModelRuntimeMetadata | null): string[] {
  if (!runtime) {
    return [];
  }

  const lines: string[] = [];
  const loadedContext = runtime.loadedContextLength;
  const maxContext = runtime.maxContextLength;
  if (typeof loadedContext === "number" && typeof maxContext === "number" && loadedContext !== maxContext) {
    lines.push(`- activeContextWindow: ${formatNumber(loadedContext)} tokens (${formatNumber(maxContext)} max)`);
  } else if (typeof loadedContext === "number" || typeof maxContext === "number") {
    lines.push(`- contextWindow: ${formatNumber(loadedContext ?? maxContext ?? 0)} tokens`);
  }
  if (runtime.quantization) {
    lines.push(
      `- quantization: ${runtime.quantization}${typeof runtime.quantizationBits === "number" ? ` (${runtime.quantizationBits}-bit)` : ""}`
    );
  }
  if (runtime.architecture) {
    lines.push(`- architecture: ${runtime.architecture}`);
  }
  if (runtime.format) {
    lines.push(`- format: ${runtime.format}`);
  }
  const config = runtime.runtimeConfig;
  const runtimeFlags = [
    config?.offloadKvCacheToGpu ? "KV cache offloaded to GPU" : null,
    config?.flashAttention ? "flash attention enabled" : null,
    typeof config?.evalBatchSize === "number" ? `eval batch ${config.evalBatchSize}` : null,
    typeof config?.numExperts === "number" ? `${config.numExperts} experts` : null
  ].filter(Boolean);
  if (runtimeFlags.length > 0) {
    lines.push(`- localRuntime: ${runtimeFlags.join(", ")}`);
  }
  return lines;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}
