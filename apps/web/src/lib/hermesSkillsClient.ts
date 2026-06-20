import type {
  HermesPluginToggleResult,
  HermesPluginsListResult,
  HermesSkillToggleResult,
  HermesSkillsListResult
} from "@hermes-ui/hermes-client";

export async function fetchHermesSkills(): Promise<HermesSkillsListResult> {
  try {
    const response = await fetch("/api/hermes/skills", {
      cache: "no-store"
    });
    const data = (await response.json()) as HermesSkillsListResult;
    return data;
  } catch {
    return {
      ok: false,
      skills: [],
      checkedAt: new Date().toISOString(),
      raw: null,
      error: {
        kind: "network",
        message: "Could not reach the local Hermes skills route."
      }
    };
  }
}

export async function fetchHermesPlugins(): Promise<HermesPluginsListResult> {
  try {
    const response = await fetch("/api/hermes/plugins", {
      cache: "no-store"
    });
    const data = (await response.json()) as HermesPluginsListResult;
    return data;
  } catch {
    return {
      ok: false,
      plugins: [],
      checkedAt: new Date().toISOString(),
      raw: null,
      error: {
        kind: "network",
        message: "Could not reach the local Hermes plugins route."
      }
    };
  }
}

export async function setHermesPluginEnabled(
  pluginId: string,
  enabled: boolean
): Promise<HermesPluginToggleResult> {
  try {
    const response = await fetch(`/api/hermes/plugins/${encodeURIComponent(pluginId)}`, {
      body: JSON.stringify({ enabled }),
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      method: "PATCH"
    });
    const data = (await response.json()) as HermesPluginToggleResult;
    return data;
  } catch {
    return {
      ok: false,
      pluginId,
      enabled,
      plugin: null,
      checkedAt: new Date().toISOString(),
      raw: null,
      error: {
        kind: "network",
        message: "Could not reach the local Hermes plugin control route."
      }
    };
  }
}

export async function setHermesSkillEnabled(
  skillId: string,
  enabled: boolean
): Promise<HermesSkillToggleResult> {
  try {
    const response = await fetch(`/api/hermes/skills/${encodeURIComponent(skillId)}`, {
      body: JSON.stringify({ enabled }),
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      method: "PATCH"
    });
    const data = (await response.json()) as HermesSkillToggleResult;
    return data;
  } catch {
    return {
      ok: false,
      skillId,
      enabled,
      skill: null,
      checkedAt: new Date().toISOString(),
      raw: null,
      error: {
        kind: "network",
        message: "Could not reach the local Hermes skill control route."
      }
    };
  }
}
