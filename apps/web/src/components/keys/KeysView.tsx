"use client";

import type { HermesEnvCategory, HermesEnvKey, NormalizedHermesStatus } from "@hermes-ui/hermes-client";
import type { AppIcon } from "@/components/ui/AppIcons";
import { Copy, ExternalLink, KeyRound, RefreshCw, Search } from "@/components/ui/AppIcons";
import { EmptyState } from "@/components/ui/EmptyState";
import { useHermesEnvKeys } from "@/hooks/useHermesEnvKeys";
import { useSectionAnchors } from "@/hooks/useSectionAnchors";
import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
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
import styles from "./KeysView.module.css";

type KeysViewProps = {
  hermesStatus: NormalizedHermesStatus | null;
};

export function KeysView({ hermesStatus }: KeysViewProps) {
  const canLoad = hermesStatus?.mode === "real" && hermesStatus.reachable;
  const { categories, isLoading, refresh, result } = useHermesEnvKeys(canLoad);
  const [query, setQuery] = useState("");
  const [selectedKey, setSelectedKey] = useState<HermesEnvKey | null>(null);

  const normalizedQuery = query.trim().toLowerCase();
  const filtered = useMemo(() => filterCategories(categories, normalizedQuery), [categories, normalizedQuery]);
  const railCategories = useMemo(
    () => filtered.map((category) => ({ id: category.id, label: category.label, count: category.keys.length })),
    [filtered]
  );
  const register = useSectionAnchors("keys", railCategories);
  const setCount = categories.reduce((count, category) => count + category.keys.filter((key) => key.isSet).length, 0);
  const totalCount = categories.reduce((count, category) => count + category.keys.length, 0);
  const configuredKeys = useMemo(
    () => categories.flatMap((category) => category.keys).filter((key) => key.isSet).slice(0, 12),
    [categories]
  );

  return (
    <section className={styles.view} aria-labelledby="keys-heading">
      <div className={styles.header}>
        <div>
          <h1 id="keys-heading">Keys</h1>
          <p>
            {canLoad
              ? `API keys and credentials - ${setCount}/${totalCount} configured`
              : "Provider, tool, and messaging credentials"}
          </p>
        </div>
        <div className={styles.headerActions}>
          <label className={styles.searchBox}>
            <Search size={14} />
            <input
              aria-label="Filter keys"
              onChange={(event) => setQuery(event.currentTarget.value)}
              placeholder="Filter keys"
              value={query}
            />
          </label>
          <button
            aria-label="Refresh keys"
            className={styles.iconButton}
            disabled={!canLoad || isLoading}
            onClick={() => void refresh()}
            title="Refresh keys"
            type="button"
          >
            <RefreshCw size={15} />
          </button>
        </div>
      </div>

      {selectedKey ? (
        <KeyDetailView envKey={selectedKey} onBack={() => setSelectedKey(null)} />
      ) : !canLoad ? (
        <EmptyState compact title="Keys are unavailable" body="Connect a reachable Hermes runtime to read its credentials." />
      ) : result?.ok === false ? (
        <EmptyState compact title="Could not load keys" body={result.error.message} />
      ) : isLoading && categories.length === 0 ? (
        <LoadingRows />
      ) : filtered.length === 0 ? (
        <EmptyState
          compact
          title={normalizedQuery ? "No keys match" : "No keys returned"}
          body={normalizedQuery ? "Try a different search." : "Hermes returned an empty key catalog."}
        />
      ) : (
        <div className={styles.stack}>
          {configuredKeys.length > 0 && !normalizedQuery ? (
            <ConfiguredKeysSection keys={configuredKeys} onSelect={setSelectedKey} />
          ) : null}
          {filtered.map((category) => (
            <section
              className={styles.group}
              data-category-id={category.id}
              id={`keys-${category.id}`}
              key={category.id}
              ref={register(category.id)}
            >
              <div className={styles.groupHeader}>
                <h2>{category.label}</h2>
                <span>{category.keys.length}</span>
              </div>
              <div className={styles.keyGrid}>
                {category.keys.map((key) => (
                  <KeyCard envKey={key} key={key.name} onSelect={() => setSelectedKey(key)} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </section>
  );
}

function KeyCard({ envKey, onSelect }: { envKey: HermesEnvKey; onSelect: () => void }) {
  const visual = visualForKey(envKey);
  return (
    <article className={styles.keyCard}>
      <button className={styles.cardMain} onClick={onSelect} type="button">
        <KeyThumbnail className={styles.keyIcon} visual={visual} />
        <span className={styles.keyInfo}>
          <span className={styles.keyName}>
            <code>{formatKeyTitle(envKey.name)}</code>
          </span>
          {envKey.description ? <span className={styles.keyDescription}>{envKey.description}</span> : null}
        </span>
      </button>
      <div className={styles.keyActions}>
        <span className={`${styles.statusPill} ${envKey.isSet ? styles.statusSet : styles.statusUnset}`}>
          {envKey.isSet ? "Configured" : "Not set"}
        </span>
      </div>
    </article>
  );
}

function ConfiguredKeysSection({ keys, onSelect }: { keys: HermesEnvKey[]; onSelect: (key: HermesEnvKey) => void }) {
  return (
    <section className={styles.configuredSection} aria-label="Configured keys">
      <div className={styles.groupHeader}>
        <h2>Configured</h2>
      </div>
      <div className={styles.configuredIcons}>
        {keys.map((key) => (
          <button
            aria-label={`Open ${formatKeyTitle(key.name)}`}
            className={styles.configuredIconButton}
            key={key.name}
            onClick={() => onSelect(key)}
            type="button"
          >
            <KeyThumbnail className={styles.configuredIcon} visual={visualForKey(key)} />
            <span className={styles.configuredIconLabel}>{formatKeyTitle(key.name)}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

function KeyDetailView({ envKey, onBack }: { envKey: HermesEnvKey; onBack: () => void }) {
  const visual = visualForKey(envKey);
  const visibleValue = envKey.redactedValue ?? (envKey.isSet ? "••••" : "Not set");
  return (
    <section className={styles.detailView} aria-labelledby="key-detail-heading">
      <div className={styles.breadcrumb}>
        <button type="button" onClick={onBack}>
          Keys
        </button>
        <span aria-hidden="true">&gt;</span>
        <strong>{formatKeyTitle(envKey.name)}</strong>
      </div>
      <header className={styles.detailHeader}>
        <KeyThumbnail className={styles.detailIcon} visual={visual} />
        <div>
          <h1 id="key-detail-heading">{formatKeyTitle(envKey.name)}</h1>
          <p>{envKey.description ?? envKey.name}</p>
        </div>
        <span className={`${styles.detailStatus} ${envKey.isSet ? styles.statusSet : styles.statusUnset}`}>
          {envKey.isSet ? "Configured" : "Not set"}
        </span>
      </header>
      <div className={styles.detailHero}>
        <div className={styles.detailPrompt}>
          <KeyThumbnail className={styles.promptIcon} visual={visual} />
          <span>{envKey.name}</span>
          <b>{visibleValue}</b>
        </div>
      </div>
      <section className={styles.detailInfo} aria-label="Key information">
        <h2>Information</h2>
        <DetailRow label="Environment key" value={<CopyValue text={envKey.name} value={envKey.name} />} />
        <DetailRow label="Value" value={<CopyValue disabled={!envKey.isSet} text={visibleValue} value={visibleValue} />} />
        <DetailRow label="Category" value={envKey.category} />
        <DetailRow label="State" value={envKey.isSet ? "Configured" : "Not set"} />
        <DetailRow label="Secret type" value={envKey.isPassword ? "Secret" : "Plain value"} />
        <DetailRow label="Advanced" value={envKey.advanced ? "Yes" : "No"} />
        {envKey.url ? (
          <DetailRow
            label="Provider docs"
            value={
              <a className={styles.detailLink} href={envKey.url} rel="noreferrer noopener" target="_blank">
                Open docs <ExternalLink size={13} />
              </a>
            }
          />
        ) : null}
      </section>
    </section>
  );
}

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className={styles.detailInfoRow}>
      <span>{label}</span>
      <b>{value}</b>
    </div>
  );
}

type KeyVisual = {
  background?: string;
  color?: string;
  icon: AppIcon;
  scale?: number;
};

function KeyThumbnail({ className, visual }: { className: string; visual: KeyVisual }) {
  const Icon = visual.icon;
  return (
    <span
      aria-hidden="true"
      className={className}
      style={
        {
          "--key-icon-background": visual.background ?? "#ffffff",
          "--key-icon-color": visual.color ?? "#111111",
          "--key-icon-scale": visual.scale ?? 1
        } as CSSProperties
      }
    >
      <Icon size={30} />
    </span>
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
    <div className={styles.loadingRows} aria-label="Loading keys">
      {Array.from({ length: 8 }).map((_, index) => (
        <span className={styles.loadingRow} key={index} />
      ))}
    </div>
  );
}

function filterCategories(categories: HermesEnvCategory[], query: string): HermesEnvCategory[] {
  if (!query) {
    return categories;
  }
  return categories
    .map((category) => ({
      ...category,
      keys: category.keys.filter((key) =>
        [key.name, key.description].filter(Boolean).some((value) => String(value).toLowerCase().includes(query))
      )
    }))
    .filter((category) => category.keys.length > 0);
}

function formatKeyTitle(name: string) {
  return name
    .replace(/_?(API_KEY|TOKEN|BASE_URL|REGION|PROFILE|OAUTH_TOKEN)$/i, "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

const KEY_BRAND_COLORS = {
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

function visualForKey(envKey: HermesEnvKey): KeyVisual {
  const text = normalizeKeyText([envKey.name, envKey.description, envKey.category]);
  if (text.includes("anthropic") || text.includes("claude")) {
    return {
      icon: text.includes("claude code") || text.includes("claude code oauth") ? ClaudeCodeBrandIcon : ClaudeBrandIcon,
      color: KEY_BRAND_COLORS.anthropic
    };
  }
  if (text.includes("bedrock") || text.includes("aws")) {
    return { icon: BedrockBrandIcon, color: KEY_BRAND_COLORS.bedrock };
  }
  if (text.includes("azure")) {
    return { icon: AzureBrandIcon, color: KEY_BRAND_COLORS.azure };
  }
  if (text.includes("openrouter")) {
    return { icon: OpenRouterBrandIcon, color: KEY_BRAND_COLORS.openrouter, background: "#171717" };
  }
  if (text.includes("deepseek")) {
    return { icon: BRAND_ICONS.deepseek, color: KEY_BRAND_COLORS.deepseek, scale: 1.32 };
  }
  if (text.includes("qwen")) {
    return { icon: BRAND_ICONS.qwen, color: KEY_BRAND_COLORS.qwen };
  }
  if (text.includes("alibaba") || text.includes("dashscope") || text.includes("tongyi") || text.includes("qwq")) {
    return { icon: BRAND_ICONS.alibaba, color: KEY_BRAND_COLORS.alibaba };
  }
  if (text.includes("xiaomi") || text.includes("mimo")) {
    return { icon: BRAND_ICONS.xiaomi, color: KEY_BRAND_COLORS.xiaomi };
  }
  if (text.includes("z ai") || text.includes("zai")) {
    return { icon: ZaiBrandIcon, color: KEY_BRAND_COLORS.zai };
  }
  if (text.includes("ollama")) {
    return { icon: BRAND_ICONS.ollama, color: KEY_BRAND_COLORS.ollama };
  }
  if (text.includes("moonshot") || text.includes("kimi")) {
    return { icon: KimiBrandIcon, color: KEY_BRAND_COLORS.kimi };
  }
  if (text.includes("fal")) {
    return { icon: FalBrandIcon, color: KEY_BRAND_COLORS.fal };
  }
  if (text.includes("firecrawl")) {
    return { icon: FirecrawlBrandIcon, color: KEY_BRAND_COLORS.firecrawl };
  }
  if (text.includes("arcee")) {
    return { icon: ArceeBrandIcon, color: KEY_BRAND_COLORS.arcee };
  }
  if (text.includes("nous")) {
    return { icon: NousResearchBrandIcon, color: KEY_BRAND_COLORS.nous };
  }
  if (text.includes("minimax")) {
    return { icon: BRAND_ICONS.minimax, color: KEY_BRAND_COLORS.minimax };
  }
  if (text.includes("perplexity")) {
    return { icon: BRAND_ICONS.perplexity, color: KEY_BRAND_COLORS.perplexity };
  }
  if (text.includes("openai") || text.includes("gpt")) {
    return { icon: BRAND_ICONS.openai, color: KEY_BRAND_COLORS.openai };
  }
  return { icon: KeyRound, color: "#111111", scale: 1.22 };
}

function normalizeKeyText(values: Array<string | null | undefined>) {
  return values
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .replace(/[_.\\/-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
