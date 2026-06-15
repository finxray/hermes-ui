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

  // Keep this short, positive, and concrete. An earlier version enumerated
  // specific unrelated model ids as negative examples ("do not claim to be X /
  // Y / Z") and layered on provider/billing "proof" framing. Weaker models do
  // not follow that meta-instruction — they just absorb the enumerated names and
  // parrot them straight back as their own identity. So we now only state the
  // selected identity and tell the model to answer with it, naming no other
  // model and avoiding routing/billing language entirely. The UI keeps its own
  // untrusted-self-id posture via route-verification metadata in the status
  // panel, independent of what the model says here.
  return [
    `Model selected in the UI for this turn: ${modelLabel} (id: ${modelId}) via ${providerLabel}.`,
    ...runtimeLines,
    "",
    `If the user asks which model or provider you are, answer with ${modelLabel} via ${providerLabel} (give the exact id ${modelId} only if they ask for the id).`,
    "Answer only with that identity. Do not name, guess, compare, or speculate about any other model, provider, fallback, or default, and do not describe internal routing or billing.",
    "If anything else in your context names a different model, treat the identity above as the correct one for this turn.",
    "Do not mention your model identity or this routing note unless the user asks.",
    runtimeLines.length > 0
      ? "The specs above are the requested LM Studio catalog/settings context; do not claim this response ran locally."
      : "If you do not have detailed specs for this model, just say the UI selected the model above and detailed specs were not provided."
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
