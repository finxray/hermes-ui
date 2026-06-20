"use client";

import type { HermesSkillDescriptor, NormalizedHermesStatus } from "@hermes-ui/hermes-client";
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
import { useHermesSkills } from "@/hooks/useHermesSkills";
import styles from "./PluginsView.module.css";

type PluginsViewProps = {
  hermesStatus: NormalizedHermesStatus | null;
};

type PluginsTab = "plugins" | "skills";

export function PluginsView({ hermesStatus }: PluginsViewProps) {
  const [activeTab, setActiveTab] = useState<PluginsTab>("plugins");
  const [query, setQuery] = useState("");
  const canLoadSkills = hermesStatus?.uiCapabilities.tools.skills === true;
  const { isLoading, refresh, result, skills } = useHermesSkills(canLoadSkills);
  const filteredSkills = useMemo(() => filterSkills(skills, query), [query, skills]);
  const pluginGroups = useMemo(() => groupSkillsBySource(filteredSkills), [filteredSkills]);
  const title = activeTab === "skills" ? "Skills" : "Plugins";
  const subtitle =
    activeTab === "skills"
      ? "Extend Codex's capabilities with task-specific skills"
      : "Work with Codex across your favorite tools";

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
          onClick={() => void refresh()}
          title="Refresh Hermes skills"
          aria-label="Refresh Hermes skills"
          disabled={!canLoadSkills || isLoading}
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
          <SummaryPill label="Skills" value={isLoading ? "Loading" : String(skills.length)} />
          <SummaryPill label="Source" value={canLoadSkills ? "Hermes /v1/skills" : "Unavailable"} />
        </div>
      ) : null}

      {!canLoadSkills ? (
        <EmptyState
          compact
          title="Hermes skills are unavailable"
          body="Hermes did not advertise the skills endpoint. Connect a Hermes runtime with /v1/skills enabled to populate this view."
        />
      ) : result?.ok === false ? (
        <EmptyState compact title="Could not load Hermes skills" body={result.error.message} />
      ) : activeTab === "plugins" ? (
        <PluginsPanel groups={pluginGroups} isLoading={isLoading} query={query} />
      ) : (
        <SkillsPanel isLoading={isLoading} query={query} skills={filteredSkills} />
      )}
    </section>
  );
}

function PluginsPanel({
  groups,
  isLoading,
  query
}: {
  groups: Array<{ source: string; skills: HermesSkillDescriptor[] }>;
  isLoading: boolean;
  query: string;
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
          <h2 id="plugins-added-heading">Added</h2>
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
            <span>{group.skills.length} skills</span>
          </div>
          <div className={styles.grid}>
            {group.skills.map((skill) => (
              <SkillCard key={skill.id} skill={skill} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function SkillsPanel({
  isLoading,
  query,
  skills
}: {
  isLoading: boolean;
  query: string;
  skills: HermesSkillDescriptor[];
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

  const groups = groupSkillsForSkillsTab(skills);

  return (
    <div className={styles.skillsStack}>
      {groups.map((group) => (
        <section className={styles.skillsSection} key={group.label} aria-labelledby={`skills-${slug(group.label)}`}>
          <h2 id={`skills-${slug(group.label)}`}>{group.label}</h2>
          <div className={styles.skillsList}>
            {group.skills.map((skill) => (
              <SkillListRow key={skill.id} skill={skill} />
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

function SkillCard({ skill }: { skill: HermesSkillDescriptor }) {
  return (
    <article className={styles.skillCard}>
      <SkillIcon className={styles.skillIcon} skill={skill} />
      <div className={styles.skillBody}>
        <h3>{skill.title}</h3>
        <p>{skill.description ?? skill.name}</p>
        <div className={styles.metaLine}>
          <span>{skill.source ?? "Hermes"}</span>
          {skill.category ? <span>{skill.category}</span> : null}
          {skill.enabled === false ? <span>Disabled</span> : null}
        </div>
      </div>
      <button
        className={styles.skillActionButton}
        type="button"
        aria-label={`Add ${skill.title}`}
        title="Plugin install is not connected yet"
      >
        Add
      </button>
    </article>
  );
}

function SkillListRow({ skill }: { skill: HermesSkillDescriptor }) {
  const isEnabled = skill.enabled !== false;

  return (
    <article className={styles.skillListRow}>
      <SkillIcon className={styles.skillListIcon} skill={skill} />
      <div className={styles.skillListBody}>
        <h3>{skill.title}</h3>
        <p>{skill.description ?? skill.name}</p>
      </div>
      {isEnabled ? (
        <span className={styles.skillCheck} aria-label={`${skill.title} installed`} title="Installed">
          <Check size={15} />
        </span>
      ) : (
        <button className={styles.addSkillButton} type="button" aria-label={`Add ${skill.title}`}>
          Add skill
        </button>
      )}
    </article>
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
  skill?: HermesSkillDescriptor;
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

function resolveSkillVisual(skill?: HermesSkillDescriptor, source?: string | null): SkillVisual {
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
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return skills;
  }
  return skills.filter((skill) =>
    [skill.title, skill.name, skill.description, skill.source, skill.category, ...skill.tags]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(normalizedQuery))
  );
}

function groupSkillsBySource(skills: HermesSkillDescriptor[]) {
  const groups = new Map<string, HermesSkillDescriptor[]>();
  for (const skill of skills) {
    const source = skill.source ?? skill.category ?? "Hermes";
    groups.set(source, [...(groups.get(source) ?? []), skill]);
  }
  return Array.from(groups.entries())
    .map(([source, groupSkills]) => ({ source, skills: groupSkills }))
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
    { label: "Personal", skills: personal },
    { label: "System", skills: system },
    { label: "Recommended", skills: recommended }
  ].filter((group) => group.skills.length > 0);
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
