import type { HermesSessionMessage, HermesSessionSummary } from "@hermes-ui/hermes-client";
import type { ChatMessage, SessionChannel } from "@/data/types";

type ChannelDefinition = {
  icon: string;
  label: string;
  external: boolean;
};

const CHANNELS: Record<string, ChannelDefinition> = {
  local: { icon: "terminal", label: "Hermes CLI", external: true },
  telegram: { icon: "telegram", label: "Telegram", external: true },
  discord: { icon: "discord", label: "Discord", external: true },
  whatsapp: { icon: "whatsapp", label: "WhatsApp", external: true },
  whatsapp_cloud: { icon: "whatsapp", label: "WhatsApp", external: true },
  slack: { icon: "slack", label: "Slack", external: true },
  signal: { icon: "signal", label: "Signal", external: true },
  mattermost: { icon: "mattermost", label: "Mattermost", external: true },
  matrix: { icon: "matrix", label: "Matrix", external: true },
  homeassistant: { icon: "homeassistant", label: "Home Assistant", external: true },
  email: { icon: "email", label: "Email", external: true },
  gmail: { icon: "email", label: "Gmail", external: true },
  sms: { icon: "sms", label: "SMS", external: true },
  dingtalk: { icon: "dingtalk", label: "DingTalk", external: true },
  feishu: { icon: "lark", label: "Feishu", external: true },
  lark: { icon: "lark", label: "Lark", external: true },
  wecom: { icon: "wechat", label: "WeCom", external: true },
  wecom_callback: { icon: "wechat", label: "WeCom", external: true },
  weixin: { icon: "wechat", label: "Weixin", external: true },
  bluebubbles: { icon: "apple", label: "iMessage", external: true },
  photon: { icon: "apple", label: "iMessage", external: true },
  qqbot: { icon: "qq", label: "QQ", external: true },
  qq: { icon: "qq", label: "QQ", external: true },
  yuanbao: { icon: "message", label: "Yuanbao", external: true },
  google_chat: { icon: "googlechat", label: "Google Chat", external: true },
  googlechat: { icon: "googlechat", label: "Google Chat", external: true },
  teams: { icon: "teams", label: "Microsoft Teams", external: true },
  msgraph_webhook: { icon: "teams", label: "Microsoft Teams", external: true },
  line: { icon: "line", label: "LINE", external: true },
  ntfy: { icon: "ntfy", label: "ntfy", external: true },
  simplex: { icon: "simplex", label: "SimpleX", external: true },
  irc: { icon: "hash", label: "IRC", external: true },
  open_webui: { icon: "browser", label: "Open WebUI", external: true },
  webhook: { icon: "webhook", label: "Webhook", external: true },
  relay: { icon: "relay", label: "Relay", external: true },
  a2a: { icon: "relay", label: "A2A", external: true },
  browser: { icon: "browser", label: "Browser", external: false },
  web: { icon: "browser", label: "Stoix", external: false },
  web_ui: { icon: "browser", label: "Stoix", external: false },
  stoix: { icon: "browser", label: "Stoix", external: false },
  api: { icon: "api", label: "API", external: false },
  api_server: { icon: "api", label: "API", external: false }
};

export function normalizeChannelSource(source: string | null | undefined): string {
  return (source ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
}

export function getChannelDescriptor(source: string | null | undefined): ChannelDefinition & { source: string } {
  const normalized = normalizeChannelSource(source);
  const known = CHANNELS[normalized];
  if (known) {
    return { ...known, source: normalized };
  }
  return {
    source: normalized,
    icon: "message",
    label: formatUnknownChannel(normalized),
    external: Boolean(normalized)
  };
}

export function isExternalChannelSource(source: string | null | undefined): boolean {
  return getChannelDescriptor(source).external;
}

export function makeSessionChannel(summary: HermesSessionSummary): SessionChannel | undefined {
  const descriptor = getChannelDescriptor(summary.source);
  if (!descriptor.source) {
    return undefined;
  }
  return {
    source: descriptor.source,
    label: descriptor.label,
    external: descriptor.external,
    lastActiveAt: summary.lastActiveAt ?? undefined,
    parentSessionId: summary.parentSessionId ?? undefined
  };
}

export function normalizeHermesMessages(messages: HermesSessionMessage[]): ChatMessage[] {
  const normalized = messages
    .filter((message) => message.role === "user" || message.role === "assistant")
    .map((message) => ({
      id: message.id,
      role: message.role as "user" | "assistant",
      author: message.role === "user" ? "You" : "Hermes",
      content: message.content,
      createdAt: formatImportedMessageTime(message.createdAt),
      status: "complete" as const
    }));

  return normalized.filter((message, index) => {
    if (index === 0) return true;
    const previous = normalized[index - 1];
    return previous.role !== message.role || previous.content.trim() !== message.content.trim();
  });
}

export function formatImportedMessageTime(value: string | null | undefined): string {
  const timestamp = Date.parse(value ?? "");
  if (!Number.isFinite(timestamp)) {
    return new Intl.DateTimeFormat(undefined, {
      hour: "2-digit",
      minute: "2-digit"
    }).format(Date.now());
  }
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit"
  }).format(timestamp);
}

function formatUnknownChannel(source: string): string {
  if (!source) {
    return "Channel";
  }
  return source
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
