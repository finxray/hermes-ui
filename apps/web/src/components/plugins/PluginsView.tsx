"use client";

import type { HermesPluginDescriptor, HermesSkillDescriptor, NormalizedHermesStatus } from "@hermes-ui/hermes-client";
import {
  Activity,
  BarChart3,
  Brain,
  Check,
  Cpu,
  Database,
  FileText,
  MessageSquare,
  Plug,
  RefreshCw,
  Search,
  Server,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Terminal
} from "@/components/ui/AppIcons";
import type { AppIcon } from "@/components/ui/AppIcons";
import {
  ClaudeBrandIcon,
  ClaudeCodeBrandIcon,
  CodexBrandIcon,
  ComfyUiBrandIcon,
  OpenCodeBrandIcon
} from "./BrandSkillIcons";
import {
  BRAND_ICONS,
  BookGlyph,
  BugGlyph,
  BulbGlyph,
  ChromeColorIcon,
  ComputerUseColorIcon,
  GamepadGlyph,
  GlobeGlyph,
  GoogleDocsColorIcon,
  GoogleSheetsColorIcon,
  GoogleSlidesColorIcon,
  ImageGlyph,
  KanbanGlyph,
  MailGlyph,
  MusicGlyph,
  PaletteGlyph,
  PdfColorIcon,
  PixelGlyph,
  PresentationGlyph,
  TerminalMark,
  UsersGlyph,
  VideoGlyph,
  WrenchGlyph
} from "./skillGlyphs";
import { useMemo, useState } from "react";
import { EmptyState } from "@/components/ui/EmptyState";
import { useHermesPlugins } from "@/hooks/useHermesPlugins";
import { useHermesSkills } from "@/hooks/useHermesSkills";
import styles from "./PluginsView.module.css";

type PluginsViewProps = {
  hermesStatus: NormalizedHermesStatus | null;
};

type PluginsTab = "plugins" | "skills";
type CatalogItem = HermesPluginDescriptor | HermesSkillDescriptor;

export function PluginsView({ hermesStatus }: PluginsViewProps) {
  const [activeTab, setActiveTab] = useState<PluginsTab>("plugins");
  const [query, setQuery] = useState("");
  const [toggleError, setToggleError] = useState<string | null>(null);
  const canLoadSkills = hermesStatus?.uiCapabilities.tools.skills === true;
  const { isLoading, refresh, result, setSkillEnabled, skills, updatingSkillIds } = useHermesSkills(canLoadSkills);
  const {
    isLoading: isLoadingPlugins,
    plugins,
    refresh: refreshPlugins,
    result: pluginsResult,
    setPluginEnabled,
    updatingPluginIds
  } = useHermesPlugins(canLoadSkills);
  const filteredSkills = useMemo(() => filterSkills(skills, query), [query, skills]);
  const filteredPlugins = useMemo(() => filterCatalogItems(plugins, query), [plugins, query]);
  const pluginGroups = useMemo(() => groupCatalogItemsBySource(filteredPlugins), [filteredPlugins]);
  const activeRefresh = activeTab === "plugins" ? refreshPlugins : refresh;
  const activeLoading = activeTab === "plugins" ? isLoadingPlugins : isLoading;
  const title = activeTab === "skills" ? "Skills" : "Plugins";
  const subtitle =
    activeTab === "skills"
      ? "Extend Hermes' capabilities with task-specific skills"
      : "Work with Hermes across your favorite tools";

  return (
    <section className={styles.view} aria-labelledby="plugins-heading">
      <div className={styles.tabs} role="tablist" aria-label="Plugins and skills">
        <button
          className={`${styles.tab} ${activeTab === "plugins" ? styles.activeTab : ""}`}
          type="button"
          role="tab"
          aria-selected={activeTab === "plugins"}
          onClick={() => setActiveTab("plugins")}
        >
          Plugins
        </button>
        <button
          className={`${styles.tab} ${activeTab === "skills" ? styles.activeTab : ""}`}
          type="button"
          role="tab"
          aria-selected={activeTab === "skills"}
          onClick={() => setActiveTab("skills")}
        >
          Skills
        </button>
      </div>

      <div className={styles.header}>
        <div>
          <h1 id="plugins-heading">{title}</h1>
          <p>{subtitle}</p>
        </div>
        <button
          className={styles.iconButton}
          type="button"
          onClick={() => void activeRefresh()}
          title="Refresh Hermes metadata"
          aria-label="Refresh Hermes metadata"
          disabled={!canLoadSkills || activeLoading}
        >
          <RefreshCw size={15} />
        </button>
      </div>

      <div className={styles.searchRow}>
        <label className={styles.searchBox}>
          <Search size={15} />
          <input
            value={query}
            onChange={(event) => setQuery(event.currentTarget.value)}
            placeholder="Search plugins and skills"
            aria-label="Search plugins and skills"
          />
        </label>
        <button className={styles.filterButton} type="button" aria-label="Filter plugins and skills">
          <SlidersHorizontal size={15} />
        </button>
      </div>

      {activeTab === "plugins" ? (
        <div className={styles.summaryRow} aria-label="Hermes skills summary">
          <SummaryPill label="Hermes" value={hermesStatusLabel(hermesStatus)} />
          <SummaryPill label="Plugins" value={isLoadingPlugins ? "Loading" : String(plugins.length)} />
          <SummaryPill label="Enabled" value={String(plugins.filter((plugin) => plugin.enabled === true).length)} />
          <SummaryPill label="Source" value={canLoadSkills ? "Hermes plugins" : "Unavailable"} />
        </div>
      ) : null}

      {toggleError ? <div className={styles.inlineError}>{toggleError}</div> : null}

      {!canLoadSkills ? (
        <EmptyState
          compact
          title="Hermes skills are unavailable"
          body="Hermes did not advertise the skills endpoint. Connect a Hermes runtime with /v1/skills enabled to populate this view."
        />
      ) : activeTab === "plugins" && pluginsResult?.ok === false ? (
        <EmptyState compact title="Could not load Hermes plugins" body={pluginsResult.error.message} />
      ) : activeTab === "skills" && result?.ok === false ? (
        <EmptyState compact title="Could not load Hermes skills" body={result.error.message} />
      ) : activeTab === "plugins" ? (
        <PluginsPanel
          groups={pluginGroups}
          isLoading={isLoadingPlugins}
          onToggle={async (plugin, nextEnabled) => {
            setToggleError(null);
            const response = await setPluginEnabled(plugin.id, nextEnabled);
            if (!response.ok) {
              setToggleError(response.error.message);
            }
          }}
          query={query}
          updatingIds={updatingPluginIds}
        />
      ) : (
        <SkillsPanel
          isLoading={isLoading}
          onToggle={async (skill, nextEnabled) => {
            setToggleError(null);
            const response = await setSkillEnabled(skill.id, nextEnabled);
            if (!response.ok) {
              setToggleError(response.error.message);
            }
          }}
          query={query}
          skills={filteredSkills}
          updatingSkillIds={updatingSkillIds}
        />
      )}
    </section>
  );
}

function PluginsPanel({
  groups,
  isLoading,
  onToggle,
  query,
  updatingIds
}: {
  groups: Array<{ source: string; items: HermesPluginDescriptor[] }>;
  isLoading: boolean;
  onToggle: (plugin: HermesPluginDescriptor, enabled: boolean) => Promise<void>;
  query: string;
  updatingIds: Set<string>;
}) {
  if (isLoading) {
    return <LoadingGrid />;
  }

  if (groups.length === 0) {
    return (
      <EmptyState
        compact
        title="No plugins found"
        body={query ? "No Hermes skill sources match this search." : "Hermes returned no skills yet."}
      />
    );
  }

  return (
    <div className={styles.groupStack}>
      <section className={styles.addedSection} aria-labelledby="plugins-added-heading">
        <div className={styles.sectionHeader}>
          <h2 id="plugins-added-heading">Enabled</h2>
          <span>{groups.length}</span>
        </div>
        <div className={styles.addedIcons} aria-label="Added Hermes skill sources">
          {groups.slice(0, 8).map((group) => (
            <SkillIcon className={styles.pluginIcon} key={group.source} label={group.source} source={group.source} />
          ))}
        </div>
      </section>

      {groups.map((group) => (
        <section className={styles.group} key={group.source} aria-labelledby={`plugin-${slug(group.source)}`}>
          <div className={styles.sectionHeader}>
            <h2 id={`plugin-${slug(group.source)}`}>{group.source}</h2>
            <span>{group.items.length} plugins</span>
          </div>
          <div className={styles.grid}>
            {group.items.map((plugin) => (
              <PluginCard
                isUpdating={updatingIds.has(plugin.id)}
                key={plugin.id}
                onToggle={onToggle}
                plugin={plugin}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function SkillsPanel({
  isLoading,
  onToggle,
  query,
  skills,
  updatingSkillIds
}: {
  isLoading: boolean;
  onToggle: (skill: HermesSkillDescriptor, enabled: boolean) => Promise<void>;
  query: string;
  skills: HermesSkillDescriptor[];
  updatingSkillIds: Set<string>;
}) {
  if (isLoading) {
    return <LoadingGrid />;
  }

  if (skills.length === 0) {
    return (
      <EmptyState
        compact
        title="No skills found"
        body={query ? "No Hermes skills match this search." : "Hermes returned no skills yet."}
      />
    );
  }

  const groups = groupCatalogItemsBySource(skills);

  return (
    <div className={styles.skillsStack}>
      {groups.map((group) => (
        <section className={styles.skillsSection} key={group.source} aria-labelledby={`skills-${slug(group.source)}`}>
          <h2 id={`skills-${slug(group.source)}`}>{group.source}</h2>
          <div className={styles.grid}>
            {group.items.map((skill) => (
              <SkillCard
                isUpdating={updatingSkillIds.has(skill.id)}
                key={skill.id}
                onToggle={onToggle}
                skill={skill as HermesSkillDescriptor}
              />
            ))}
          </div>
        </section>
      ))}
      <div className={styles.skillsBottomAction}>
        <button className={styles.addSkillButton} type="button" title="Skill install is not connected yet">
          Add skill
        </button>
      </div>
    </div>
  );
}

function PluginCard({
  isUpdating,
  onToggle,
  plugin
}: {
  isUpdating: boolean;
  onToggle: (plugin: HermesPluginDescriptor, enabled: boolean) => Promise<void>;
  plugin: HermesPluginDescriptor;
}) {
  return (
    <article className={styles.skillCard}>
      <SkillIcon className={styles.skillIcon} skill={plugin} />
      <div className={styles.skillBody}>
        <h3>{plugin.title}</h3>
        <p>{plugin.description ?? plugin.name}</p>
        <div className={styles.metaLine}>
          <span>{plugin.source ?? "Hermes"}</span>
          {plugin.version ? <span>v{plugin.version}</span> : null}
          {plugin.status ? <span>{plugin.status}</span> : null}
        </div>
      </div>
      <PluginActionButton isUpdating={isUpdating} onToggle={(enabled) => onToggle(plugin, enabled)} item={plugin} />
    </article>
  );
}

function SkillCard({
  isUpdating,
  onToggle,
  skill
}: {
  isUpdating: boolean;
  onToggle: (skill: HermesSkillDescriptor, enabled: boolean) => Promise<void>;
  skill: HermesSkillDescriptor;
}) {
  return (
    <article className={styles.skillCard}>
      <SkillIcon className={styles.skillIcon} skill={skill} />
      <div className={styles.skillBody}>
        <h3>{skill.title}</h3>
        <p>{skill.description ?? skill.name}</p>
        <div className={styles.metaLine}>
          <span>{skill.source ?? "Hermes"}</span>
          {skill.category ? <span>{skill.category}</span> : null}
          {skill.enabled === null ? <span>Unknown</span> : null}
        </div>
      </div>
      <SkillToggle isUpdating={isUpdating} onToggle={(enabled) => onToggle(skill, enabled)} skill={skill} />
    </article>
  );
}

function SkillListRow({
  isUpdating,
  onToggle,
  skill
}: {
  isUpdating: boolean;
  onToggle: (skill: HermesSkillDescriptor, enabled: boolean) => Promise<void>;
  skill: HermesSkillDescriptor;
}) {
  return (
    <article className={styles.skillListRow}>
      <SkillIcon className={styles.skillListIcon} skill={skill} />
      <div className={styles.skillListBody}>
        <h3>{skill.title}</h3>
        <p>{skill.description ?? skill.name}</p>
      </div>
      <SkillToggle isUpdating={isUpdating} onToggle={(enabled) => onToggle(skill, enabled)} skill={skill} />
    </article>
  );
}

function PluginActionButton({
  isUpdating,
  item,
  onToggle,
}: {
  isUpdating: boolean;
  item: CatalogItem;
  onToggle: (enabled: boolean) => Promise<void>;
}) {
  const hasKnownState = item.enabled !== null;
  const isEnabled = item.enabled === true;
  const actionLabel = isEnabled ? "Disable" : "Enable";
  const nextEnabled = !isEnabled;

  return (
    <button
      className={`${styles.pluginActionButton} ${isEnabled ? styles.removeActionButton : ""}`}
      disabled={!hasKnownState || isUpdating}
      onClick={() => void onToggle(nextEnabled)}
      title={hasKnownState ? `${actionLabel} ${item.title}` : "Hermes did not report this plugin state"}
      type="button"
      aria-label={hasKnownState ? `${actionLabel} ${item.title}` : `${item.title} state unavailable`}
    >
      {isUpdating ? "..." : hasKnownState ? actionLabel : "Unavailable"}
    </button>
  );
}

function SkillToggle({
  isUpdating,
  onToggle,
  skill
}: {
  isUpdating: boolean;
  onToggle: (enabled: boolean) => Promise<void>;
  skill: HermesSkillDescriptor;
}) {
  const hasKnownState = skill.enabled !== null;
  const isEnabled = skill.enabled === true;
  const label = hasKnownState
    ? `${isEnabled ? "Disable" : "Enable"} ${skill.title}`
    : `${skill.title} enable state is not reported by Hermes`;

  return (
    <label className={styles.skillToggle} title={label} aria-label={label}>
      <input
        checked={isEnabled}
        className={styles.skillToggleInput}
        disabled={!hasKnownState || isUpdating}
        onChange={(event) => void onToggle(event.currentTarget.checked)}
        type="checkbox"
      />
      <span className={styles.skillToggleTrack} aria-hidden="true">
        <span className={styles.skillToggleThumb} />
      </span>
    </label>
  );
}

function SkillIcon({
  className,
  label,
  skill,
  source
}: {
  className: string;
  label?: string;
  skill?: CatalogItem;
  source?: string;
}) {
  const visual = resolveSkillVisual(skill, source ?? skill?.source ?? label);
  const Icon = visual.icon;
  const style =
    visual.color || visual.background
      ? {
          background: visual.background,
          color: visual.color
        }
      : undefined;

  return (
    <span
      className={[className, styles.resolvedIcon, styles[visual.tone]].join(" ")}
      aria-hidden="true"
      style={style}
      title={label ?? skill?.title ?? source}
    >
      {visual.mark ? <span className={styles.iconMark}>{visual.mark}</span> : <Icon size={17} />}
    </span>
  );
}

type SkillVisual = {
  background?: string;
  color?: string;
  icon: AppIcon;
  mark?: string;
  tone:
    | "toneAgent"
    | "toneArticle"
    | "toneBrand"
    | "toneCode"
    | "toneCreative"
    | "toneData"
    | "toneDiagram"
    | "toneHermes"
    | "toneMemory"
    | "toneVideo";
};

type IconRule = { match: string[]; icon: AppIcon; tone?: SkillVisual["tone"]; mark?: string };

const BRAND_COLORS = {
  airtable: "#18bfff",
  anthropic: "#d97757",
  arxiv: "#b31b1b",
  claude: "#d97757",
  codex: "#f4f4f5",
  comfyui: "#f0ff41",
  excalidraw: "#6965db",
  giphy: "#ff6666",
  github: "#f5f5f5",
  google: "#4285f4",
  googledocs: "#4285f4",
  googlemaps: "#4285f4",
  huggingface: "#ffd21e",
  jupyter: "#f37626",
  linear: "#5e6ad2",
  linux: "#fcc624",
  notion: "#f5f5f5",
  obsidian: "#7c3aed",
  ollama: "#f5f5f5",
  opencode: "#f5f5f5",
  p5dotjs: "#ed225d",
  philipshue: "#0065d3",
  spotify: "#1ed760",
  weightsandbiases: "#ffbe00",
  x: "#f5f5f5",
  youtube: "#ff0000"
} as const;

const DARK_BRAND_BACKGROUND = "rgba(255, 255, 255, 0.075)";
const LIGHT_BRAND_BACKGROUND = "#f4f4f5";

function brandVisual(icon: AppIcon, color: string, background = DARK_BRAND_BACKGROUND): SkillVisual {
  return { background, color, icon, tone: "toneBrand" };
}

function colorTile(icon: AppIcon): SkillVisual {
  return { background: "rgba(255, 255, 255, 0.08)", icon, tone: "toneBrand" };
}

// Brand logos (Simple Icons paths + a few hand-tuned marks). Checked first so a
// skill that maps to a real product shows its real glyph, like Codex's app list.
// Order matters: more specific keys precede generic ones.
const BRAND_RULES: IconRule[] = [
  { match: ["computer use"], icon: ComputerUseColorIcon },
  { match: ["chrome"], icon: ChromeColorIcon },
  { match: ["spreadsheets", "spreadsheet", "sheets"], icon: GoogleSheetsColorIcon },
  { match: ["presentations", "presentation", "slides"], icon: GoogleSlidesColorIcon },
  { match: ["pdf"], icon: PdfColorIcon },
  { match: ["documents", "document", "google docs", "docs"], icon: GoogleDocsColorIcon },
  { match: ["claude code"], icon: ClaudeCodeBrandIcon },
  { match: ["codex"], icon: CodexBrandIcon },
  { match: ["opencode", "open code"], icon: OpenCodeBrandIcon },
  { match: ["comfy"], icon: ComfyUiBrandIcon },
  { match: ["claude"], icon: ClaudeBrandIcon },
  { match: ["airtable"], icon: BRAND_ICONS.airtable },
  { match: ["linear"], icon: BRAND_ICONS.linear },
  { match: ["notion"], icon: BRAND_ICONS.notion },
  { match: ["obsidian"], icon: BRAND_ICONS.obsidian },
  { match: ["jupyter"], icon: BRAND_ICONS.jupyter },
  { match: ["hugging"], icon: BRAND_ICONS.huggingface },
  { match: ["excalidraw"], icon: BRAND_ICONS.excalidraw },
  { match: ["p5js", "p5.js"], icon: BRAND_ICONS.p5dotjs },
  { match: ["arxiv"], icon: BRAND_ICONS.arxiv },
  { match: ["ollama"], icon: BRAND_ICONS.ollama },
  { match: ["spotify"], icon: BRAND_ICONS.spotify },
  { match: ["youtube"], icon: BRAND_ICONS.youtube },
  { match: ["github"], icon: BRAND_ICONS.github },
  { match: ["xurl"], icon: BRAND_ICONS.x },
  { match: ["gif "], icon: BRAND_ICONS.giphy },
  { match: ["weights and biases", "wandb"], icon: BRAND_ICONS.weightsandbiases },
  { match: ["google maps", "maps"], icon: BRAND_ICONS.googlemaps },
  { match: ["openhue", "philips hue"], icon: BRAND_ICONS.philipshue },
  { match: ["google workspace", "google docs", "gmail"], icon: BRAND_ICONS.googledocs },
  { match: ["wsl", "ubuntu", "linux"], icon: BRAND_ICONS.linux }
];

const BRAND_VISUALS = new Map<AppIcon, SkillVisual>([
  [ComputerUseColorIcon, colorTile(ComputerUseColorIcon)],
  [ChromeColorIcon, colorTile(ChromeColorIcon)],
  [GoogleSheetsColorIcon, colorTile(GoogleSheetsColorIcon)],
  [GoogleSlidesColorIcon, colorTile(GoogleSlidesColorIcon)],
  [PdfColorIcon, colorTile(PdfColorIcon)],
  [GoogleDocsColorIcon, colorTile(GoogleDocsColorIcon)],
  [ClaudeCodeBrandIcon, brandVisual(ClaudeCodeBrandIcon, BRAND_COLORS.claude)],
  [CodexBrandIcon, brandVisual(CodexBrandIcon, BRAND_COLORS.codex)],
  [OpenCodeBrandIcon, brandVisual(OpenCodeBrandIcon, BRAND_COLORS.opencode)],
  [ComfyUiBrandIcon, brandVisual(ComfyUiBrandIcon, BRAND_COLORS.comfyui, "#162dd4")],
  [ClaudeBrandIcon, brandVisual(ClaudeBrandIcon, BRAND_COLORS.claude)],
  [BRAND_ICONS.airtable, brandVisual(BRAND_ICONS.airtable, BRAND_COLORS.airtable)],
  [BRAND_ICONS.linear, brandVisual(BRAND_ICONS.linear, BRAND_COLORS.linear)],
  [BRAND_ICONS.notion, brandVisual(BRAND_ICONS.notion, "#111111", LIGHT_BRAND_BACKGROUND)],
  [BRAND_ICONS.obsidian, brandVisual(BRAND_ICONS.obsidian, BRAND_COLORS.obsidian)],
  [BRAND_ICONS.jupyter, brandVisual(BRAND_ICONS.jupyter, BRAND_COLORS.jupyter)],
  [BRAND_ICONS.huggingface, brandVisual(BRAND_ICONS.huggingface, "#111111", BRAND_COLORS.huggingface)],
  [BRAND_ICONS.excalidraw, brandVisual(BRAND_ICONS.excalidraw, BRAND_COLORS.excalidraw)],
  [BRAND_ICONS.p5dotjs, brandVisual(BRAND_ICONS.p5dotjs, BRAND_COLORS.p5dotjs)],
  [BRAND_ICONS.arxiv, brandVisual(BRAND_ICONS.arxiv, BRAND_COLORS.arxiv)],
  [BRAND_ICONS.ollama, brandVisual(BRAND_ICONS.ollama, "#111111", LIGHT_BRAND_BACKGROUND)],
  [BRAND_ICONS.spotify, brandVisual(BRAND_ICONS.spotify, BRAND_COLORS.spotify)],
  [BRAND_ICONS.youtube, brandVisual(BRAND_ICONS.youtube, BRAND_COLORS.youtube)],
  [BRAND_ICONS.github, brandVisual(BRAND_ICONS.github, BRAND_COLORS.github)],
  [BRAND_ICONS.x, brandVisual(BRAND_ICONS.x, BRAND_COLORS.x)],
  [BRAND_ICONS.giphy, brandVisual(BRAND_ICONS.giphy, BRAND_COLORS.giphy)],
  [BRAND_ICONS.weightsandbiases, brandVisual(BRAND_ICONS.weightsandbiases, "#111111", BRAND_COLORS.weightsandbiases)],
  [BRAND_ICONS.googlemaps, brandVisual(BRAND_ICONS.googlemaps, BRAND_COLORS.googlemaps)],
  [BRAND_ICONS.philipshue, brandVisual(BRAND_ICONS.philipshue, BRAND_COLORS.philipshue)],
  [BRAND_ICONS.googledocs, brandVisual(BRAND_ICONS.googledocs, BRAND_COLORS.googledocs)],
  [BRAND_ICONS.linux, brandVisual(BRAND_ICONS.linux, "#111111", BRAND_COLORS.linux)]
]);

// Semantic glyphs for skills with no brand. Ordered most-specific first.
const SEMANTIC_RULES: IconRule[] = [
  { match: ["hermes"], icon: Sparkles, mark: "H", tone: "toneHermes" },
  { match: ["ascii"], icon: TerminalMark, mark: "Aa", tone: "toneCode" },
  { match: ["pixel"], icon: PixelGlyph, tone: "toneCreative" },
  { match: ["godmode", "red team", "jailbreak", "exploit", "security"], icon: ShieldCheck, tone: "toneVideo" },
  { match: ["kanban", "lane", "board", "worker", "orchestrator"], icon: KanbanGlyph, tone: "toneAgent" },
  { match: ["minecraft", "pokemon", "modpack", "gaming", "game"], icon: GamepadGlyph, tone: "toneCreative" },
  { match: ["openhue", "smart home", "philips hue"], icon: BulbGlyph, tone: "toneCreative" },
  { match: ["infographic", "bloomberg", "polymarket", "ib connect", "chart", "dashboard", "analytics", "market", "trading"], icon: BarChart3, tone: "toneData" },
  { match: ["comic", "illustrat", "manga"], icon: MessageSquare, tone: "toneCreative" },
  { match: ["palette", "web design", "popular web", "design", "sketch", "humanizer"], icon: PaletteGlyph, tone: "toneCreative" },
  { match: ["architecture", "diagram", "flowchart"], icon: Activity, tone: "toneDiagram" },
  { match: ["segment anything", "stable diffusion", "nano banana", "image", "photo", "inpaint"], icon: ImageGlyph, tone: "toneCreative" },
  { match: ["video", "film", "animation", "touchdesigner"], icon: VideoGlyph, tone: "toneVideo" },
  { match: ["music", "song", "audio", "audiocraft", "melody", "heartmula", "songsee"], icon: MusicGlyph, tone: "toneCreative" },
  { match: ["powerpoint", "presentation", "slides", "deck"], icon: PresentationGlyph, tone: "toneArticle" },
  { match: ["meeting", "teams", "standup", "call"], icon: UsersGlyph, tone: "toneArticle" },
  { match: ["ocr", "pdf", "document"], icon: FileText, tone: "toneArticle" },
  { match: ["debug", "debugger", "debugpy", "node inspect", "troubleshoot"], icon: BugGlyph, tone: "toneCode" },
  { match: ["audit", "code review", "review", "policy", "verification", "inspection"], icon: ShieldCheck, tone: "toneCode" },
  { match: ["test driven", "tdd"], icon: Check, tone: "toneCode" },
  { match: ["arxiv", "research", "paper", "wiki", "blog", "blogwatcher"], icon: BookGlyph, tone: "toneArticle" },
  { match: ["memory", "brain memory", "obliteratus"], icon: Database, tone: "toneMemory" },
  { match: ["llm", "vllm", "llama", "dspy", "eval", "harness", "serving", "model", "inference", "mlops"], icon: Cpu, tone: "toneData" },
  { match: ["agent", "autonomous", "supervis", "dogfood", "subagent", "yuanbao"], icon: Brain, tone: "toneAgent" },
  { match: ["email", "himalaya", "imap", "mail"], icon: MailGlyph, tone: "toneArticle" },
  { match: ["server", "mcp", "gateway", "webhook", "container", "supervision", "integration", "bridge", "connect", "provider"], icon: Server, tone: "toneData" },
  { match: ["environment", "awareness", "windows", "map"], icon: GlobeGlyph, tone: "toneData" },
  { match: ["plan", "spike", "ideation"], icon: FileText, tone: "toneCode" },
  { match: ["code", "coding", "debugging", "python", "node", "tui"], icon: Terminal, tone: "toneCode" },
  { match: ["tool", "wrench", "status"], icon: WrenchGlyph, tone: "toneData" }
];

// Per-category default when no keyword rule matches.
const CATEGORY_DEFAULTS: Record<string, SkillVisual> = {
  productivity: { icon: FileText, tone: "toneArticle" },
  creative: { icon: Sparkles, tone: "toneCreative" },
  research: { icon: BookGlyph, tone: "toneArticle" },
  mlops: { icon: Cpu, tone: "toneData" },
  tools: { icon: WrenchGlyph, tone: "toneData" },
  "autonomous-ai-agents": { icon: Brain, tone: "toneAgent" },
  "software-development": { icon: Terminal, tone: "toneCode" },
  github: { icon: BRAND_ICONS.github, tone: "toneBrand" },
  media: { icon: MusicGlyph, tone: "toneCreative" },
  devops: { icon: Server, tone: "toneData" },
  gaming: { icon: GamepadGlyph, tone: "toneCreative" },
  email: { icon: MailGlyph, tone: "toneArticle" },
  "data-science": { icon: Cpu, tone: "toneData" },
  "smart-home": { icon: BulbGlyph, tone: "toneCreative" },
  "social-media": { icon: BRAND_ICONS.x, tone: "toneBrand" },
  "note-taking": { icon: FileText, tone: "toneArticle" },
  mcp: { icon: Plug, tone: "toneData" },
  domain: { icon: GlobeGlyph, tone: "toneData" },
  "red-teaming": { icon: ShieldCheck, tone: "toneVideo" }
};

function matchRule(rules: IconRule[], text: string): IconRule | undefined {
  return rules.find((rule) => rule.match.some((keyword) => text.includes(keyword)));
}

function resolveSkillVisual(skill?: CatalogItem, source?: string | null): SkillVisual {
  // Brand matching uses only the identifying fields — a description that merely
  // mentions "Claude" or "GitHub" should not hijack a skill's logo.
  const brandText = normalizeIconText([
    skill?.title,
    skill?.name,
    skill?.source,
    skill?.category,
    source,
    ...(skill?.tags ?? [])
  ]);
  const brand = matchRule(BRAND_RULES, brandText);
  if (brand) {
    return BRAND_VISUALS.get(brand.icon) ?? { icon: brand.icon, tone: "toneBrand" };
  }

  // Semantic matching also ignores the description: every Hermes skill's blurb
  // mentions "Hermes"/"Codex"/etc., which would otherwise mislabel skills.
  const semantic = matchRule(SEMANTIC_RULES, brandText);
  if (semantic) {
    return { icon: semantic.icon, mark: semantic.mark, tone: semantic.tone ?? "toneHermes" };
  }

  const category = (skill?.category ?? source ?? "").toLowerCase().replace(/\s+/g, "-");
  if (CATEGORY_DEFAULTS[category]) {
    return CATEGORY_DEFAULTS[category];
  }

  return { icon: Plug, tone: "toneHermes" };
}

function normalizeIconText(values: Array<string | null | undefined>) {
  return values
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .replace(/[_-]+/g, " ");
}

function SummaryPill({ label, value }: { label: string; value: string }) {
  return (
    <span className={styles.summaryPill}>
      <span>{label}</span>
      <strong>{value}</strong>
    </span>
  );
}

function LoadingGrid() {
  return (
    <div className={styles.loadingGrid} aria-label="Loading Hermes skills">
      {Array.from({ length: 6 }).map((_, index) => (
        <span className={styles.loadingCard} key={index} />
      ))}
    </div>
  );
}

function filterSkills(skills: HermesSkillDescriptor[], query: string) {
  return filterCatalogItems(skills, query) as HermesSkillDescriptor[];
}

function filterCatalogItems<T extends CatalogItem>(items: T[], query: string) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return items;
  }
  return items.filter((item) =>
    [item.title, item.name, item.description, item.source, item.category, ...item.tags]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(normalizedQuery))
  );
}

function groupCatalogItemsBySource<T extends CatalogItem>(items: T[]) {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const source = item.category ?? item.source ?? "Hermes";
    groups.set(source, [...(groups.get(source) ?? []), item]);
  }
  return Array.from(groups.entries())
    .map(([source, groupItems]) => ({
      label: source,
      source,
      items: sortCatalogItemsByState(groupItems)
    }))
    .sort((a, b) => a.source.localeCompare(b.source));
}

function groupSkillsBySource(skills: HermesSkillDescriptor[]) {
  const groups = new Map<string, HermesSkillDescriptor[]>();
  for (const skill of skills) {
    const source = skill.source ?? skill.category ?? "Hermes";
    groups.set(source, [...(groups.get(source) ?? []), skill]);
  }
  return Array.from(groups.entries())
    .map(([source, groupSkills]) => ({ source, skills: sortSkillsByState(groupSkills) }))
    .sort((a, b) => a.source.localeCompare(b.source));
}

function groupSkillsForSkillsTab(skills: HermesSkillDescriptor[]) {
  const personal: HermesSkillDescriptor[] = [];
  const system: HermesSkillDescriptor[] = [];
  const recommended: HermesSkillDescriptor[] = [];

  for (const skill of skills) {
    if (skill.enabled === false) {
      recommended.push(skill);
    } else if (isSystemSkill(skill)) {
      system.push(skill);
    } else {
      personal.push(skill);
    }
  }

  return [
    { label: "Personal", skills: sortSkillsByState(personal) },
    { label: "System", skills: sortSkillsByState(system) },
    { label: "Recommended", skills: sortSkillsByState(recommended) }
  ].filter((group) => group.skills.length > 0);
}

function sortCatalogItemsByState<T extends CatalogItem>(items: T[]) {
  return [...items].sort((a, b) => {
    const stateDelta = skillStateRank(a) - skillStateRank(b);
    if (stateDelta !== 0) {
      return stateDelta;
    }
    return a.title.localeCompare(b.title);
  });
}

function sortSkillsByState(skills: HermesSkillDescriptor[]) {
  return sortCatalogItemsByState(skills) as HermesSkillDescriptor[];
}

function skillStateRank(skill: CatalogItem) {
  if (skill.enabled === true) {
    return 0;
  }
  if (skill.enabled === null) {
    return 1;
  }
  return 2;
}

function isSystemSkill(skill: HermesSkillDescriptor) {
  const text = normalizeIconText([skill.title, skill.name, skill.source, skill.category, ...(skill.tags ?? [])]);
  return [
    "browser",
    "image gen",
    "imagegen",
    "openai docs",
    "plugin creator",
    "skill creator",
    "skill installer",
    "system"
  ].some((keyword) => text.includes(keyword));
}

function hermesStatusLabel(status: NormalizedHermesStatus | null) {
  if (!status) {
    return "Checking";
  }
  if (status.mode === "real" && status.reachable) {
    return "Connected";
  }
  if (status.mode === "unconfigured") {
    return "Unconfigured";
  }
  return "Unavailable";
}

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}
