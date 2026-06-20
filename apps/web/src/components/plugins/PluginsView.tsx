"use client";

import type { HermesSkillDescriptor, NormalizedHermesStatus } from "@hermes-ui/hermes-client";
import {
  Activity,
  Brain,
  Cpu,
  Database,
  FileText,
  MessageSquare,
  Plug,
  RefreshCw,
  Search,
  Server,
  SlidersHorizontal,
  Sparkles,
  Terminal,
  TerminalSquare
} from "@/components/ui/AppIcons";
import type { AppIcon } from "@/components/ui/AppIcons";
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
          <h1 id="plugins-heading">Plugins</h1>
          <p>Work with Hermes skills across local tools and memory-aware workflows</p>
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

      <div className={styles.summaryRow} aria-label="Hermes skills summary">
        <SummaryPill label="Hermes" value={hermesStatusLabel(hermesStatus)} />
        <SummaryPill label="Skills" value={isLoading ? "Loading" : String(skills.length)} />
        <SummaryPill label="Source" value={canLoadSkills ? "Hermes /v1/skills" : "Unavailable"} />
      </div>

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

  return (
    <section className={styles.group} aria-labelledby="skills-heading">
      <div className={styles.sectionHeader}>
        <h2 id="skills-heading">Hermes Configured</h2>
        <span>{skills.length}</span>
      </div>
      <div className={styles.grid}>
        {skills.map((skill) => (
          <SkillCard key={skill.id} skill={skill} />
        ))}
      </div>
    </section>
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

  return (
    <span
      className={[className, styles.resolvedIcon, styles[visual.tone]].join(" ")}
      aria-hidden="true"
      title={label ?? skill?.title ?? source}
    >
      {visual.mark ? <span className={styles.iconMark}>{visual.mark}</span> : <Icon size={17} />}
    </span>
  );
}

type SkillVisual = {
  icon: AppIcon;
  mark?: string;
  tone:
    | "toneAgent"
    | "toneArticle"
    | "toneCode"
    | "toneCreative"
    | "toneData"
    | "toneDiagram"
    | "toneHermes"
    | "toneMemory"
    | "toneVideo";
};

function resolveSkillVisual(skill?: HermesSkillDescriptor, source?: string | null): SkillVisual {
  const text = normalizeIconText([
    skill?.title,
    skill?.name,
    skill?.description,
    skill?.source,
    skill?.category,
    source,
    ...(skill?.tags ?? [])
  ]);

  if (text.includes("codex")) {
    return { icon: TerminalSquare, mark: "Cx", tone: "toneCode" };
  }
  if (text.includes("claude")) {
    return { icon: Brain, mark: "Cl", tone: "toneAgent" };
  }
  if (text.includes("opencode") || text.includes("open code")) {
    return { icon: TerminalSquare, mark: "OC", tone: "toneCode" };
  }
  if (text.includes("hermes")) {
    return { icon: Sparkles, mark: "H", tone: "toneHermes" };
  }
  if (text.includes("memory") || text.includes("brain")) {
    return { icon: Database, tone: "toneMemory" };
  }
  if (text.includes("agent") || text.includes("autonomous")) {
    return { icon: Brain, tone: "toneAgent" };
  }
  if (text.includes("creative")) {
    return { icon: Sparkles, tone: "toneCreative" };
  }
  if (text.includes("diagram") || text.includes("architecture") || text.includes("infographic")) {
    return { icon: Activity, tone: "toneDiagram" };
  }
  if (text.includes("ascii")) {
    return { icon: Terminal, mark: "Aa", tone: "toneCode" };
  }
  if (text.includes("video")) {
    return { icon: VideoGlyph, tone: "toneVideo" };
  }
  if (text.includes("comic") || text.includes("illustrator") || text.includes("illustration")) {
    return { icon: MessageSquare, tone: "toneCreative" };
  }
  if (text.includes("article") || text.includes("writer") || text.includes("docs")) {
    return { icon: FileText, tone: "toneArticle" };
  }
  if (text.includes("comfy") || text.includes("image") || text.includes("workflow")) {
    return { icon: Cpu, tone: "toneCreative" };
  }
  if (text.includes("server") || text.includes("mcp") || text.includes("gateway")) {
    return { icon: Server, tone: "toneData" };
  }

  return skill?.category === "memory"
    ? { icon: Sparkles, tone: "toneMemory" }
    : { icon: Plug, tone: "toneHermes" };
}

const VideoGlyph: AppIcon = ({ size = 17, ...props }) => (
  <svg
    aria-hidden="true"
    fill="none"
    height={size}
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth="1.75"
    viewBox="0 0 24 24"
    width={size}
    {...props}
  >
    <rect x="4" y="6" width="12" height="12" rx="2.4" />
    <path d="m16 10 4-2.2v8.4L16 14" />
    <path d="M8.2 9.2v5.6" />
  </svg>
);

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
