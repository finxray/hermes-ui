import type {
  HermesConfigResult,
  HermesEnvResult,
  HermesLogsResult,
  HermesPluginToggleResult,
  HermesPluginsListResult,
  HermesSkillToggleResult,
  HermesSkillsListResult
} from "@hermes-ui/hermes-client";

export async function fetchHermesEnvKeys(): Promise<HermesEnvResult> {
  try {
    const response = await fetch("/api/hermes/env", { cache: "no-store" });
    return (await response.json()) as HermesEnvResult;
  } catch {
    return {
      ok: false,
      categories: [],
      checkedAt: new Date().toISOString(),
      raw: null,
      error: { kind: "network", message: "Could not reach the local Hermes keys route." }
    };
  }
}

export async function fetchHermesLogs(file: string): Promise<HermesLogsResult> {
  try {
    const response = await fetch(`/api/hermes/logs?file=${encodeURIComponent(file)}`, { cache: "no-store" });
    return (await response.json()) as HermesLogsResult;
  } catch {
    return {
      ok: false,
      file,
      lines: [],
      checkedAt: new Date().toISOString(),
      error: { kind: "network", message: "Could not reach the local Hermes logs route." }
    };
  }
}

export async function fetchHermesConfig(): Promise<HermesConfigResult> {
  try {
    const response = await fetch("/api/hermes/config", {
      cache: "no-store"
    });
    const data = (await response.json()) as HermesConfigResult;
    return data;
  } catch {
    return {
      ok: false,
      model: null,
      sections: [],
      checkedAt: new Date().toISOString(),
      raw: null,
      error: {
        kind: "network",
        message: "Could not reach the local Hermes config route."
      }
    };
  }
}

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
