export type HermesStreamCompatibilityContext = {
  model: string;
  provider: string;
};

const MODEL_LOCK_MISMATCH_PATTERN =
  /^confirmed model lock runtime mismatch: expected provider=(\S+) model=(\S+); actual provider=(\S+) model=(\S+)$/;

export function isLocalLmStudioProvider(provider: string | null | undefined): boolean {
  const normalized = provider?.trim().toLowerCase() ?? "";
  return (
    normalized === "lmstudio" ||
    normalized === "local-lmstudio" ||
    normalized.startsWith("local-lmstudio") ||
    normalized.startsWith("custom:local-lmstudio")
  );
}

/**
 * Hermes can report the canonical `custom` provider after confirming a model
 * selected through a configured local-LM-Studio alias. Suppress only that
 * exact, model-preserving alias mismatch and only after assistant output has
 * proved the requested route produced a response.
 */
export function shouldSuppressHermesStreamError(args: {
  compatibility?: HermesStreamCompatibilityContext;
  eventName: string;
  hasAssistantText: boolean;
  payload: Record<string, unknown> | null;
}): boolean {
  if (args.eventName !== "error" || !args.hasAssistantText || !args.compatibility) {
    return false;
  }

  if (!isLocalLmStudioProvider(args.compatibility.provider)) {
    return false;
  }

  const message =
    typeof args.payload?.message === "string" ? args.payload.message.trim() : "";
  const match = message.match(MODEL_LOCK_MISMATCH_PATTERN);
  if (!match) {
    return false;
  }

  const [, expectedProvider, expectedModel, actualProvider, actualModel] = match;
  return (
    expectedProvider === args.compatibility.provider &&
    expectedModel === args.compatibility.model &&
    actualProvider === "custom" &&
    actualModel === args.compatibility.model
  );
}
