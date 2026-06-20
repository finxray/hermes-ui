import type { HermesSkillsListResult } from "@hermes-ui/hermes-client";

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
