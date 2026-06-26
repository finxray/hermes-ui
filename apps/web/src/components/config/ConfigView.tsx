"use client";

import type { NormalizedBrainMemoryStatus } from "@hermes-ui/brain-memory-client";
import type { HermesConfigField, HermesConfigSection, NormalizedHermesStatus } from "@hermes-ui/hermes-client";
import type { Project, Session } from "@/data/types";
import { CheckCircle2, Copy, Cpu, Database, KeyRound, RefreshCw, Search, Terminal } from "@/components/ui/AppIcons";
import type { AppIcon } from "@/components/ui/AppIcons";
import { EmptyState } from "@/components/ui/EmptyState";
import { useHermesConfig } from "@/hooks/useHermesConfig";
import { useSectionAnchors } from "@/hooks/useSectionAnchors";
import { useMemo, useState, type CSSProperties } from "react";
import {
  ArceeBrandIcon,
  AzureBrandIcon,
  BedrockBrandIcon,
  ClaudeBrandIcon,
  ClaudeCodeBrandIcon,
  FalBrandIcon,
  FirecrawlBrandIcon,
  KimiBrandIcon,
  NousResearchBrandIcon,
  OpenRouterBrandIcon,
  ZaiBrandIcon
} from "@/components/plugins/BrandSkillIcons";
import { BRAND_ICONS } from "@/components/plugins/skillGlyphs";
import styles from "./ConfigView.module.css";

type ConfigViewProps = {
  activeProject: Project;
  activeSession: Session | null;
  brainMemoryStatus: NormalizedBrainMemoryStatus | null;
  hermesStatus: NormalizedHermesStatus | null;
  isBrainMemoryStatusLoading: boolean;
  isHermesStatusLoading: boolean;
  onRefreshBrainMemory: () => void;
  onRefreshHermes: () => void;
};

export function ConfigView({
  hermesStatus,
  isHermesStatusLoading,
  onRefreshHermes
}: ConfigViewProps) {
  const canLoadConfig = hermesStatus?.mode === "real" && hermesStatus.reachable;
  const { isLoading, refresh, result, sections } = useHermesConfig(canLoadConfig);
  const [query, setQuery] = useState("");
  const [selectedField, setSelectedField] = useState<HermesConfigField | null>(null);

  const normalizedQuery = query.trim().toLowerCase();
  const filteredSections = useMemo(() => filterSections(sections, normalizedQuery), [sections, normalizedQuery]);
  const railCategories = useMemo(
    () => filteredSections.map((section) => ({ id: section.id, label: section.label, count: section.fields.length })),
    [filteredSections]
  );
  const register = useSectionAnchors("config", railCategories);
  const totalFields = sections.reduce((count, section) => count + section.fields.length, 0);

  return (
    <section className={styles.view} aria-labelledby="config-heading">
      <div className={styles.header}>
        <div>
          <h1 id="config-heading">Config</h1>
          <p>
            {canLoadConfig
              ? `Hermes runtime configuration${totalFields ? ` - ${totalFields} settings` : ""}`
              : "Runtime, memory, and active scope"}
          </p>
        </div>
        <div className={styles.headerActions}>
          {canLoadConfig ? (
            <label className={styles.searchBox}>
              <Search size={14} />
              <input
                aria-label="Filter settings"
                onChange={(event) => setQuery(event.currentTarget.value)}
                placeholder="Filter settings"
                value={query}
              />
            </label>
          ) : null}
          <button
            aria-label="Refresh Hermes config"
            className={styles.iconButton}
            disabled={isHermesStatusLoading || isLoading}
            onClick={() => {
              onRefreshHermes();
              void refresh();
            }}
            title="Refresh Hermes config"
            type="button"
          >
            <RefreshCw size={15} />
          </button>
        </div>
      </div>

      <div className={styles.stack}>
        {selectedField ? (
          <ConfigFieldDetailView field={selectedField} onBack={() => setSelectedField(null)} />
        ) : !canLoadConfig ? null : result?.ok === false ? (
          <EmptyState compact title="Could not load Hermes config" body={result.error.message} />
        ) : isLoading && sections.length === 0 ? (
          <LoadingRows />
        ) : filteredSections.length === 0 ? (
          <EmptyState
            compact
            title={normalizedQuery ? "No settings match" : "No config settings"}
            body={normalizedQuery ? "Try a different search." : "Hermes returned an empty config schema."}
          />
        ) : (
          filteredSections.map((section) => (
            <section
              className={styles.group}
              data-category-id={section.id}
              id={`config-${section.id}`}
              key={section.id}
              ref={register(section.id)}
            >
              <div className={styles.groupHeader}>
                <h2>{section.label}</h2>
                <span>{section.fields.length}</span>
              </div>
              <dl className={styles.fieldList}>
                {section.fields.map((field) => (
                  <ConfigFieldRow field={field} key={field.key} onSelect={() => setSelectedField(field)} />
                ))}
              </dl>
            </section>
          ))
        )}
      </div>
    </section>
  );
}

function ConfigFieldRow({ field, onSelect }: { field: HermesConfigField; onSelect: () => void }) {
  const visual = visualForConfigField(field);
  const Icon = visual.icon;
  return (
    <div className={styles.fieldRow}>
      <button className={styles.fieldMain} onClick={onSelect} type="button">
        <span className={styles.fieldIcon} aria-hidden="true" style={iconStyle(visual)}>
          <Icon size={25} />
        </span>
        <span className={styles.fieldInfo}>
          <span className={styles.fieldLabel}>{field.label}</span>
          {field.description && field.description !== field.label ? (
            <span className={styles.fieldDescription}>{field.description}</span>
          ) : null}
          <span className={styles.fieldKey}>{field.key}</span>
        </span>
      </button>
      <div className={styles.fieldValue}>
        <ConfigFieldValue field={field} />
      </div>
    </div>
  );
}

function ConfigFieldValue({ field }: { field: HermesConfigField }) {
  if (field.type === "boolean") {
    const on = field.value === true;
    return <span className={`${styles.boolPill} ${on ? styles.boolOn : styles.boolOff}`}>{on ? "On" : "Off"}</span>;
  }

  if (Array.isArray(field.value)) {
    if (field.value.length === 0) {
      return <span className={styles.notSet}>None</span>;
    }
    return (
      <span className={styles.scalarValue} title={field.value.join(", ")}>
        {field.value.join(", ")}
      </span>
    );
  }

  if (field.value === null || field.value === "") {
    return <span className={styles.notSet}>Not set</span>;
  }

  return (
    <span className={styles.scalarValue} title={String(field.value)}>
      {String(field.value)}
    </span>
  );
}

function ConfigFieldDetailView({ field, onBack }: { field: HermesConfigField; onBack: () => void }) {
  const visual = visualForConfigField(field);
  const Icon = visual.icon;
  const value = formatConfigValue(field);
  return (
    <section className={styles.detailView} aria-labelledby="config-detail-heading">
      <div className={styles.breadcrumb}>
        <button type="button" onClick={onBack}>
          Config
        </button>
        <span aria-hidden="true">&gt;</span>
        <strong>{field.label}</strong>
      </div>
      <header className={styles.detailHeader}>
        <span className={styles.detailIcon} aria-hidden="true" style={iconStyle(visual)}>
          <Icon size={32} />
        </span>
        <div>
          <h1 id="config-detail-heading">{field.label}</h1>
          <p>{field.description ?? field.key}</p>
        </div>
        <span className={`${styles.boolPill} ${field.isSet ? styles.boolOn : styles.boolOff}`}>{field.isSet ? "Set" : "Not set"}</span>
      </header>
      <div className={styles.detailHero}>
        <div className={styles.detailPrompt}>
          <span className={styles.fieldIcon} aria-hidden="true" style={iconStyle(visual)}>
            <Icon size={22} />
          </span>
          <span>{field.key}</span>
          <b>{value}</b>
        </div>
      </div>
      <section className={styles.detailInfo} aria-label="Config information">
        <h2>Information</h2>
        <DetailRow label="Key" value={<CopyValue text={field.key} value={field.key} />} />
        <DetailRow label="Value" value={<CopyValue disabled={!field.isSet} text={value} value={value} />} />
        <DetailRow label="Type" value={field.type} />
        <DetailRow label="State" value={field.isSet ? "Set" : "Not set"} />
        {field.options.length ? <DetailRow label="Options" value={field.options.join(", ")} /> : null}
      </section>
    </section>
  );
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className={styles.detailInfoRow}>
      <span>{label}</span>
      <b>{value}</b>
    </div>
  );
}

function CopyValue({ disabled = false, text, value }: { disabled?: boolean; text: string; value: string }) {
  return (
    <span className={styles.copyValue}>
      <code>{value}</code>
      <button
        aria-label={`Copy ${text}`}
        disabled={disabled}
        onClick={() => {
          if (!disabled) {
            void navigator.clipboard?.writeText(text);
          }
        }}
        type="button"
      >
        <Copy size={13} />
      </button>
    </span>
  );
}

function LoadingRows() {
  return (
    <div className={styles.loadingRows} aria-label="Loading Hermes config">
      {Array.from({ length: 8 }).map((_, index) => (
        <span className={styles.loadingRow} key={index} />
      ))}
    </div>
  );
}

function filterSections(sections: HermesConfigSection[], query: string): HermesConfigSection[] {
  if (!query) {
    return sections;
  }
  return sections
    .map((section) => ({
      ...section,
      fields: section.fields.filter((field) =>
        [field.label, field.key, field.description].filter(Boolean).some((value) => String(value).toLowerCase().includes(query))
      )
    }))
    .filter((section) => section.fields.length > 0);
}

function formatConfigValue(field: HermesConfigField) {
  if (Array.isArray(field.value)) {
    return field.value.length ? field.value.join(", ") : "None";
  }
  if (field.value === null || field.value === "") {
    return "Not set";
  }
  if (typeof field.value === "boolean") {
    return field.value ? "On" : "Off";
  }
  return String(field.value);
}

type ConfigVisual = {
  background?: string;
  color: string;
  icon: AppIcon;
  scale?: number;
};

const CONFIG_BRAND_COLORS = {
  anthropic: "#d97757",
  alibaba: "#ff6a00",
  arcee: "#c66f46",
  azure: "#5f6fff",
  bedrock: "#31c371",
  deepseek: "#4d6bfe",
  fal: "#ff1b72",
  firecrawl: "#ff5a1f",
  kimi: "#6d7cff",
  minimax: "#e8443b",
  nous: "#111111",
  ollama: "#111111",
  openai: "#111111",
  openrouter: "#f5f5f5",
  perplexity: "#20b8cd",
  qwen: "#615ced",
  xiaomi: "#ff6900",
  zai: "#111111"
};

function iconStyle(visual: ConfigVisual): CSSProperties {
  return {
    "--config-icon-background": visual.background ?? "#ffffff",
    "--config-icon-color": visual.color,
    "--config-icon-scale": visual.scale ?? 1
  } as CSSProperties;
}

function visualForConfigField(field: HermesConfigField): ConfigVisual {
  const valueText = normalizeConfigIconText([configValueText(field)]);
  const metadataText = normalizeConfigIconText([field.key, field.label, field.description]);
  const providerVisual = visualForProviderText(valueText) ?? visualForProviderText(metadataText);
  if (providerVisual) {
    return providerVisual;
  }

  const text = metadataText;
  if (text.includes("terminal") || text.includes("shell") || text.includes("command")) {
    return { icon: Terminal, color: "#111111", scale: 1.22 };
  }
  if (text.includes("memory") || text.includes("database") || text.includes("store")) {
    return { icon: Database, color: "#111111", scale: 1.22 };
  }
  if (text.includes("key") || text.includes("auth") || text.includes("token")) {
    return { icon: KeyRound, color: "#111111", scale: 1.22 };
  }
  if (field.type === "boolean") {
    return { icon: CheckCircle2, color: "#111111", scale: 1.22 };
  }
  return { icon: Cpu, color: "#111111", scale: 1.22 };
}

function visualForProviderText(text: string): ConfigVisual | null {
  if (text.includes("anthropic") || text.includes("claude")) {
    return {
      icon: text.includes("claude code") || text.includes("claude code oauth") ? ClaudeCodeBrandIcon : ClaudeBrandIcon,
      color: CONFIG_BRAND_COLORS.anthropic
    };
  }
  if (text.includes("bedrock") || text.includes("aws")) {
    return { icon: BedrockBrandIcon, color: CONFIG_BRAND_COLORS.bedrock };
  }
  if (text.includes("azure")) {
    return { icon: AzureBrandIcon, color: CONFIG_BRAND_COLORS.azure };
  }
  if (text.includes("openrouter")) {
    return { icon: OpenRouterBrandIcon, color: CONFIG_BRAND_COLORS.openrouter, background: "#171717" };
  }
  if (text.includes("deepseek")) {
    return { icon: BRAND_ICONS.deepseek, color: CONFIG_BRAND_COLORS.deepseek, scale: 1.32 };
  }
  if (text.includes("qwen")) {
    return { icon: BRAND_ICONS.qwen, color: CONFIG_BRAND_COLORS.qwen };
  }
  if (text.includes("alibaba") || text.includes("dashscope") || text.includes("tongyi") || text.includes("qwq")) {
    return { icon: BRAND_ICONS.alibaba, color: CONFIG_BRAND_COLORS.alibaba };
  }
  if (text.includes("xiaomi") || text.includes("mimo")) {
    return { icon: BRAND_ICONS.xiaomi, color: CONFIG_BRAND_COLORS.xiaomi };
  }
  if (text.includes("z ai") || text.includes("zai")) {
    return { icon: ZaiBrandIcon, color: CONFIG_BRAND_COLORS.zai };
  }
  if (text.includes("ollama")) {
    return { icon: BRAND_ICONS.ollama, color: CONFIG_BRAND_COLORS.ollama };
  }
  if (text.includes("moonshot") || text.includes("kimi")) {
    return { icon: KimiBrandIcon, color: CONFIG_BRAND_COLORS.kimi };
  }
  if (text.includes("fal")) {
    return { icon: FalBrandIcon, color: CONFIG_BRAND_COLORS.fal };
  }
  if (text.includes("firecrawl")) {
    return { icon: FirecrawlBrandIcon, color: CONFIG_BRAND_COLORS.firecrawl };
  }
  if (text.includes("arcee")) {
    return { icon: ArceeBrandIcon, color: CONFIG_BRAND_COLORS.arcee };
  }
  if (text.includes("nous")) {
    return { icon: NousResearchBrandIcon, color: CONFIG_BRAND_COLORS.nous };
  }
  if (text.includes("minimax")) {
    return { icon: BRAND_ICONS.minimax, color: CONFIG_BRAND_COLORS.minimax };
  }
  if (text.includes("perplexity")) {
    return { icon: BRAND_ICONS.perplexity, color: CONFIG_BRAND_COLORS.perplexity };
  }
  if (text.includes("openai") || text.includes("gpt")) {
    return { icon: BRAND_ICONS.openai, color: CONFIG_BRAND_COLORS.openai };
  }
  return null;
}

function configValueText(field: HermesConfigField) {
  if (Array.isArray(field.value)) {
    return field.value.join(" ");
  }
  if (field.value === null || field.value === undefined) {
    return "";
  }
  return String(field.value);
}

function normalizeConfigIconText(values: Array<string | null | undefined>) {
  return values
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .replace(/[_.\\/-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
