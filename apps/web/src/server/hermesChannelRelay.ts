import { spawn } from "node:child_process";
import { getHermesSession, type HermesClientConfig } from "@hermes-ui/hermes-client";
import {
  resolveHermesExecutable,
  type DashboardExecutable
} from "@/server/hermesDashboardLauncher";

const RELAY_TIMEOUT_MS = 20_000;
const MAX_RELAY_CHARS = 12_000;
const EXTERNAL_CHANNELS = new Set([
  "telegram", "discord", "whatsapp", "whatsapp_cloud", "slack", "signal",
  "mattermost", "matrix", "email", "gmail", "sms", "dingtalk", "feishu",
  "lark", "wecom", "wecom_callback", "weixin", "bluebubbles", "photon",
  "qqbot", "qq", "yuanbao", "google_chat", "googlechat", "teams",
  "msgraph_webhook", "line", "ntfy", "simplex", "irc", "webhook", "relay"
]);

export type ChannelRelayResult =
  | { delivered: true; channel: string }
  | { delivered: false; channel: string | null; reason: string };

export async function relayHermesSessionReply(
  config: HermesClientConfig,
  sessionId: string,
  assistantText: string,
  environment: NodeJS.ProcessEnv = process.env,
  platform: NodeJS.Platform = process.platform
): Promise<ChannelRelayResult> {
  const text = assistantText.trim().slice(0, MAX_RELAY_CHARS);
  if (!text) {
    return { delivered: false, channel: null, reason: "Hermes returned no assistant text to relay." };
  }

  const sessionResult = await getHermesSession(config, sessionId);
  if (!sessionResult.ok) {
    return { delivered: false, channel: null, reason: sessionResult.error.message };
  }

  const channel = normalizeChannel(sessionResult.session.source);
  if (!EXTERNAL_CHANNELS.has(channel)) {
    return { delivered: false, channel: channel || null, reason: "The session is not owned by an external channel." };
  }

  const executable = await resolveHermesExecutable(platform, environment);
  const spec = buildChannelSendLaunchSpec(platform, executable, channel);
  const output = await runHermesSend(spec, text);
  const parsed = safeJson(output);
  if (parsed?.success !== true) {
    const message = typeof parsed?.error === "string" ? parsed.error : "Hermes did not confirm channel delivery.";
    return { delivered: false, channel, reason: message };
  }
  return { delivered: true, channel };
}

export function buildChannelSendLaunchSpec(
  platform: NodeJS.Platform,
  executable: DashboardExecutable,
  channel: string
) {
  const sendArgs = ["send", "--to", channel, "--file", "-", "--json"];
  return executable.kind === "wsl"
    ? { command: "wsl.exe", args: ["-d", executable.distro, "--", executable.path, ...sendArgs], platform }
    : { command: executable.path, args: sendArgs, platform };
}

function runHermesSend(
  spec: { command: string; args: string[]; platform: NodeJS.Platform },
  text: string
): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(spec.command, spec.args, {
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: spec.platform === "win32"
    });
    let stdout = "";
    let stderr = "";
    let settled = false;
    const timeout = setTimeout(() => {
      child.kill();
      finish(new Error("Hermes channel delivery timed out."));
    }, RELAY_TIMEOUT_MS);

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => { stdout += chunk.slice(0, 64_000); });
    child.stderr.on("data", (chunk: string) => { stderr += chunk.slice(0, 16_000); });
    child.once("error", finish);
    child.once("close", (code) => {
      if (code === 0) finish(null, stdout);
      else finish(new Error(stderr.trim() || `Hermes channel delivery exited with code ${code ?? "unknown"}.`));
    });
    child.stdin.end(text, "utf8");

    function finish(error: Error | null, result = "") {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (error) reject(error);
      else resolve(result);
    }
  });
}

function normalizeChannel(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function safeJson(value: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
}
