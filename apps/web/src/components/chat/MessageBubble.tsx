"use client";

import { Pencil } from "lucide-react";
import { memo, useMemo } from "react";
import type { ChatMessage } from "@/data/types";
import { CollapsibleUserMessage } from "@/components/chat/CollapsibleUserMessage";
import { StreamingAssistantBody } from "@/components/chat/StreamingAssistantBody";
import type { StreamStatusLabel } from "@/lib/streamStatus";
import { formatHermesModelLabel, formatHermesProviderLabel } from "@hermes-ui/hermes-client";
import { CopyTextButton } from "./MessageMarkdown";
import styles from "./MessageBubble.module.css";
import markdownStyles from "./MessageMarkdown.module.css";

type MessageBubbleProps = {
  message: ChatMessage;
  onRevealComplete?: () => void;
  showFooterAlways?: boolean;
  streamStatusLabel?: StreamStatusLabel | null;
};

export const MessageBubble = memo(function MessageBubble({
  message,
  onRevealComplete,
  showFooterAlways = false,
  streamStatusLabel = null
}: MessageBubbleProps) {
  const isAssistant = message.role === "assistant";
  const isStreaming = message.status === "streaming";
  const userParagraphs = useMemo(
    () => message.content.split("\n"),
    [message.content]
  );
  const showMessageFooter = Boolean(message.content) && !isStreaming;
  const usageParts = isAssistant ? formatUsageParts(message.usage) : [];

  if (!isAssistant) {
    return (
      <article
        className={styles.message}
        data-role="user"
        data-status={message.status ?? "complete"}
      >
        <div className={styles.userStack}>
          <div className={styles.userBubble}>
            {message.content ? (
              <CollapsibleUserMessage messageId={message.id} paragraphs={userParagraphs} />
            ) : null}
          </div>
          {showMessageFooter ? (
            <div className={styles.messageFooter} aria-label="Message actions">
              <span className={styles.messageMeta}>{message.createdAt}</span>
              <div className={styles.messageActions}>
                <CopyTextButton
                  className={`${markdownStyles.iconActionButton} ${styles.messageActionButton}`}
                  label="Copy message"
                  text={message.content}
                  variant="icon"
                />
                <button
                  aria-label="Edit message coming soon"
                  className={`${markdownStyles.iconActionButton} ${styles.messageActionButton}`}
                  disabled
                  title="Edit message is coming soon."
                  type="button"
                >
                  <Pencil aria-hidden="true" />
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </article>
    );
  }

  return (
    <article
      className={styles.message}
      data-footer-always={showFooterAlways ? "true" : "false"}
      data-role="assistant"
      data-status={message.status ?? "complete"}
    >
      <div className={styles.assistantStack}>
        <div className={styles.content}>
          {isStreaming || message.content ? (
            // Route completed assistant text through the same body so the reveal
            // that began while streaming can finish smoothly instead of snapping
            // to the full text the instant the status flips to "complete".
            <StreamingAssistantBody
              content={message.content}
              isStreaming={isStreaming}
              onRevealComplete={onRevealComplete}
              statusLabel={streamStatusLabel}
            />
          ) : message.status === "complete" ? (
            <p className={styles.emptyAssistantText}>Hermes completed without returning assistant text.</p>
          ) : null}
        </div>
        {showMessageFooter ? (
          <div className={`${styles.messageFooter} ${styles.assistantFooter}`} aria-label="Message actions">
            <div className={styles.messageActions}>
              <CopyTextButton
                className={`${markdownStyles.iconActionButton} ${styles.messageActionButton}`}
                label="Copy message"
                text={message.content}
                variant="icon"
              />
            </div>
            <span className={styles.messageMeta}>{message.createdAt}</span>
            {usageParts.map((part) => (
              <span
                className={styles.usageMeta}
                data-tone={part.tone ?? "muted"}
                key={part.key}
                title={part.title ?? "Provider or Hermes reported usage."}
              >
                {part.label}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </article>
  );
});

type UsagePart = {
  key: string;
  label: string;
  title?: string;
  tone?: "muted" | "warning";
};

function formatUsageParts(usage: ChatMessage["usage"]) {
  if (!usage) {
    return [] as UsagePart[];
  }

  const parts: UsagePart[] = [];
  if (typeof usage.promptTokens === "number") {
    parts.push({ key: "in", label: `${formatInteger(usage.promptTokens)} in` });
  }
  if (typeof usage.completionTokens === "number") {
    parts.push({ key: "out", label: `${formatInteger(usage.completionTokens)} out` });
  }
  if (typeof usage.tokensPerSecond === "number") {
    parts.push({ key: "speed", label: `${formatSpeed(usage.tokensPerSecond)} tok/s` });
  }
  const routePart = formatRouteUsagePart(usage);
  if (routePart) {
    parts.push(routePart);
  }
  if (typeof usage.costUsd === "number") {
    parts.push({ key: "cost", label: formatCost(usage.costUsd) });
  }
  return parts;
}

function formatRouteUsagePart(usage: NonNullable<ChatMessage["usage"]>): UsagePart | null {
  const actualModel = cleanRouteText(usage.upstreamModel) || cleanRouteText(usage.model);
  const actualProvider = cleanRouteText(usage.provider);
  const requestedModel = cleanRouteText(usage.requestedModel);
  const requestedProvider = cleanRouteText(usage.requestedProvider);

  if (usage.routeMismatch) {
    return {
      key: "route",
      label: `routed ${formatRouteLabel(actualModel, actualProvider)}`,
      title: `Requested ${formatRouteLabel(requestedModel, requestedProvider)}, but Hermes/provider usage reported ${formatRouteLabel(actualModel, actualProvider)}.`,
      tone: "warning"
    };
  }

  if (usage.routeVerified && (actualModel || actualProvider)) {
    return {
      key: "route",
      label: `actual ${formatRouteLabel(actualModel, actualProvider)}`,
      title: "Actual model/provider reported by Hermes or provider usage."
    };
  }

  if (requestedModel || requestedProvider) {
    return {
      key: "route",
      label: `requested ${formatRouteLabel(requestedModel, requestedProvider)}`,
      title: "Requested model route. Hermes/provider usage did not report the actual billed model for this response.",
      tone: "warning"
    };
  }

  return null;
}

function formatRouteLabel(model?: string, provider?: string) {
  if (model) {
    return formatHermesModelLabel(model);
  }
  if (provider) {
    return formatHermesProviderLabel(provider) || provider;
  }
  return "unknown";
}

function cleanRouteText(value?: string | null) {
  return typeof value === "string" ? value.trim() || undefined : undefined;
}

function formatInteger(value: number) {
  return new Intl.NumberFormat().format(Math.max(0, Math.round(value)));
}

function formatCost(value: number) {
  return `$${value.toFixed(value < 0.01 ? 4 : 2)}`;
}

function formatSpeed(value: number) {
  const safe = Math.max(0, value);
  return safe >= 100 ? new Intl.NumberFormat().format(Math.round(safe)) : safe.toFixed(1);
}
