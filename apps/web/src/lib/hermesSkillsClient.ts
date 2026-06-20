import type { HermesSkillToggleResult, HermesSkillsListResult } from "@hermes-ui/hermes-client";

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
