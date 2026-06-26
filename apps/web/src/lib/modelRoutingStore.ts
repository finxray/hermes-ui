"use client";

import { useCallback, useEffect, useState } from "react";

// Local-only persistence for the Smart Model Routing skill. This intentionally
// lives outside the versioned workspace store (IndexedDB) so adding routing
// preferences never requires a workspace schema migration; it mirrors the
// best-effort localStorage pattern used for composer drafts.
const MODEL_ROUTING_STORAGE_KEY = "hermes-ui.model-routing.v1";

export type ModelRoutingCategory = {
  id: string;
  label: string;
  description: string;
};

export type ModelRoutingSelection = {
  catalogModelId: string;
  label: string;
  provider: string | null;
};

export type ModelRoutingConfig = Record<string, ModelRoutingSelection | undefined>;

// General task categories an orchestration agent routes work to — not specific
// skills/plugins, but the kinds of reasoning the agent's model does as it plans,
// delegates, and coordinates. Ordered roughly simple -> hard, so a cheap/local
// model can be assigned to the top categories and a powerful, large-context
// model to the heavier ones. Editable here without touching any UI wiring.
export const MODEL_ROUTING_CATEGORIES: ModelRoutingCategory[] = [
  {
    id: "conversation",
    label: "Conversation & quick replies",
    description: "Casual chat, clarifying questions, and quick answers where speed matters most."
  },
  {
    id: "extraction",
    label: "Data extraction & structuring",
    description: "Parsing, classifying, and turning text into clean JSON, tables, or labels."
  },
  {
    id: "writing",
    label: "Writing & summarization",
    description: "Drafting, rewriting, and formatting prose, and condensing long material into summaries."
  },
  {
    id: "tool-calling",
    label: "Tool & function calling",
    description: "Choosing the right skill or tool and producing correct, structured call arguments."
  },
  {
    id: "research-web",
    label: "Research & web",
    description: "Searching, browsing, and synthesizing multiple sources into grounded findings."
  },
  {
    id: "coding",
    label: "Coding & technical execution",
    description: "Writing, reviewing, and debugging code, or delegating to coding tools like Claude Code or Codex."
  },
  {
    id: "orchestration",
    label: "Orchestration & planning",
    description: "Breaking goals into steps and deciding which skills, tools, or sub-agents to run."
  },
  {
    id: "reasoning",
    label: "Deep reasoning & analysis",
    description: "Hard multi-step problems, trade-offs, evaluation, and careful decision-making."
  },
  {
    id: "long-context",
    label: "Long context & documents",
    description: "Large files, long transcripts, and synthesis across a big working context."
  },
  {
    id: "vision",
    label: "Vision & multimodal",
    description: "Understanding screenshots, photos, charts, and diagrams."
  }
];

function readModelRouting(): ModelRoutingConfig {
  try {
    const raw = window.localStorage.getItem(MODEL_ROUTING_STORAGE_KEY);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }
    return normalizeConfig(parsed as Record<string, unknown>);
  } catch {
    return {};
  }
}

function writeModelRouting(config: ModelRoutingConfig) {
  try {
    const entries = Object.entries(config).filter(([, value]) => Boolean(value));
    if (entries.length === 0) {
      window.localStorage.removeItem(MODEL_ROUTING_STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(MODEL_ROUTING_STORAGE_KEY, JSON.stringify(Object.fromEntries(entries)));
  } catch {
    // Routing preferences are best-effort UI state only.
  }
}

function normalizeConfig(source: Record<string, unknown>): ModelRoutingConfig {
  const config: ModelRoutingConfig = {};
  for (const category of MODEL_ROUTING_CATEGORIES) {
    const value = source[category.id];
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      continue;
    }
    const candidate = value as Record<string, unknown>;
    const catalogModelId = typeof candidate.catalogModelId === "string" ? candidate.catalogModelId.trim() : "";
    if (!catalogModelId) {
      continue;
    }
    config[category.id] = {
      catalogModelId,
      label: typeof candidate.label === "string" && candidate.label.trim() ? candidate.label.trim() : catalogModelId,
      provider: typeof candidate.provider === "string" && candidate.provider.trim() ? candidate.provider.trim() : null
    };
  }
  return config;
}

export function useModelRouting() {
  const [config, setConfig] = useState<ModelRoutingConfig>({});

  useEffect(() => {
    setConfig(readModelRouting());
  }, []);

  const setCategoryModel = useCallback(
    (categoryId: string, selection: ModelRoutingSelection | null) => {
      setConfig((current) => {
        const next: ModelRoutingConfig = { ...current };
        if (selection) {
          next[categoryId] = selection;
        } else {
          delete next[categoryId];
        }
        writeModelRouting(next);
        return next;
      });
    },
    []
  );

  return { config, setCategoryModel };
}
