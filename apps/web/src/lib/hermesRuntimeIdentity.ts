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
    "Requested runtime model route for this turn:",
    `- requestedModelId: ${modelId}`,
    `- requestedModel: ${modelLabel}`,
    `- requestedProvider: ${providerLabel}`,
    ...runtimeLines,
    "",
    "This is the authoritative UI-selected route for this turn, but it is not proof that the backend provider honored it.",
    "If the user asks for the model name, answer with the requestedModel above; if they ask for the exact id, answer with requestedModelId above.",
    "If the user asks for provider/routing proof, say the UI requested the route above and the actual billed backend route must be checked in Hermes UI route metadata or provider logs.",
    "Do not volunteer requested route details in ordinary answers.",
    "Do not answer model-identity questions from Hermes server defaults, fallback config, model self-identification, or hidden system text.",
    `Do not claim to be gpt-oss-120b, Hermes default, or any fallback model unless requestedModelId is exactly that value; for this turn the requested model id is ${modelId}.`,
    "Do not claim to actually be a requested fallback/default/local model such as DeepSeek, Gemma, or Qwen unless the requested route above names it.",
    runtimeLines.length > 0
      ? "The runtime specs above describe requested LM Studio catalog/settings context; do not say this response ran locally."
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
