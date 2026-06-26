"use client";

import type { HermesModelDescriptor, HermesPluginDescriptor, HermesSkillDescriptor, NormalizedHermesStatus } from "@hermes-ui/hermes-client";
import {
  Activity,
  BarChart3,
  Brain,
  Check,
  Cpu,
  Database,
  FileText,
  MessageSquare,
  MoreHorizontal,
  Plug,
  Plus,
  RotateCcw,
  Search,
  Server,
  ShieldCheck,
  Sparkles,
  Terminal,
  Trash2
} from "@/components/ui/AppIcons";
import type { AppIcon } from "@/components/ui/AppIcons";
import {
  ArceeBrandIcon,
  AzureBrandIcon,
  BedrockBrandIcon,
  BloombergBrandIcon,
  BraveBrandIcon,
  BrowserUseBrandIcon,
  BrowserbaseBrandIcon,
  ClaudeBrandIcon,
  ClaudeCodeBrandIcon,
  CodexBrandIcon,
  ComfyUiBrandIcon,
  DiscordBrandIcon,
  DuckDuckGoBrandIcon,
  ExaBrandIcon,
  FalBrandIcon,
  FirecrawlBrandIcon,
  GoogleChatBrandIcon,
  GoogleMeetBrandIcon,
  InteractiveBrokersBrandIcon,
  KiloCodeBrandIcon,
  KimiBrandIcon,
  KreaBrandIcon,
  LangfuseBrandIcon,
  LineBrandIcon,
  MattermostBrandIcon,
  MicrosoftBrandIcon,
  NousResearchBrandIcon,
  NovitaBrandIcon,
  NtfyBrandIcon,
  OpenCodeBrandIcon,
  OpenRouterBrandIcon,
  ParallelBrandIcon,
  SearxngBrandIcon,
  SimplexBrandIcon,
  StepfunBrandIcon,
  TavilyBrandIcon,
  ZaiBrandIcon
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
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { EmptyState } from "@/components/ui/EmptyState";
import { useHermesPlugins } from "@/hooks/useHermesPlugins";
import { useHermesSkills } from "@/hooks/useHermesSkills";
import { useSectionAnchors } from "@/hooks/useSectionAnchors";
import { useSectionNav } from "@/components/shell/SectionNavContext";
import { ModelRoutingSkillView } from "./ModelRoutingSkillView";
import { MODEL_ROUTING_CATEGORIES, useModelRouting } from "@/lib/modelRoutingStore";
import styles from "./PluginsView.module.css";

type PluginsViewProps = {
  availableModels?: HermesModelDescriptor[];
  hermesStatus: NormalizedHermesStatus | null;
};

type PluginsTab = "plugins" | "skills";
type CatalogItem = HermesPluginDescriptor | HermesSkillDescriptor;
type CatalogMode = "browse" | "detail" | "manage" | "routing";
type SelectedCatalogItem = { item: CatalogItem; kind: PluginsTab; source: string };

export function PluginsView({ availableModels = [], hermesStatus }: PluginsViewProps) {
  const [activeTab, setActiveTab] = useState<PluginsTab>("plugins");
  const [mode, setMode] = useState<CatalogMode>("browse");
  const [selectedItem, setSelectedItem] = useState<SelectedCatalogItem | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterSource, setFilterSource] = useState("all");
  const autoSelectedSkillsRef = useRef(false);
  const filterRef = useRef<HTMLSpanElement | null>(null);
  const [manageTab, setManageTab] = useState<PluginsTab>("plugins");
  const [query, setQuery] = useState("");
  const [toggleError, setToggleError] = useState<string | null>(null);
  const sectionNav = useSectionNav();
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
  const visiblePlugins = useMemo(
    () => filterSource === "all" ? filteredPlugins : filteredPlugins.filter((item) => itemCategorySource(item) === filterSource),
    [filterSource, filteredPlugins]
  );
  const visibleSkills = useMemo(
    () => filterSource === "all" ? filteredSkills : filteredSkills.filter((item) => itemCategorySource(item) === filterSource),
    [filterSource, filteredSkills]
  );
  const pluginGroups = useMemo(() => groupCatalogItemsBySource(visiblePlugins), [visiblePlugins]);
  const skillGroups = useMemo(() => groupCatalogItemsBySource(visibleSkills), [visibleSkills]);
  const enabledPlugins = useMemo(() => plugins.filter((plugin) => plugin.enabled === true).slice(0, 10), [plugins]);
  const enabledSkills = useMemo(() => skills.filter((skill) => skill.enabled === true).slice(0, 10), [skills]);
  const activeGroups = activeTab === "plugins" ? pluginGroups : skillGroups;
  const filterOptions = useMemo(
    () => [
      { id: "all", label: "All" },
      ...groupCatalogItemsBySource(activeTab === "plugins" ? filteredPlugins : filteredSkills).map((group) => ({
        id: group.source,
        label: prettyCategory(group.source)
      }))
    ],
    [activeTab, filteredPlugins, filteredSkills]
  );
  const railCategories = useMemo(
    () => activeGroups.map((group) => ({ id: slug(group.source), label: prettyCategory(group.source), count: group.items.length })),
    [activeGroups]
  );
  const register = useSectionAnchors("plugins", railCategories);
  const activeRefresh = activeTab === "plugins" ? refreshPlugins : refresh;
  const activeLoading = activeTab === "plugins" ? isLoadingPlugins : isLoading;
  const title = activeTab === "skills" ? "Skills" : "Plugins";
  const subtitle =
    activeTab === "skills"
      ? "Extend Hermes' capabilities with task-specific skills"
      : "Work with Hermes across your favorite tools";

  useEffect(() => {
    sectionNav.publishSectionLabel("plugins", title);
  }, [sectionNav, title]);

  useEffect(() => {
    if (
      autoSelectedSkillsRef.current ||
      activeTab !== "plugins" ||
      pluginsResult?.ok !== false ||
      result?.ok !== true ||
      skills.length === 0
    ) {
      return;
    }
    autoSelectedSkillsRef.current = true;
    setActiveTab("skills");
    setFilterSource("all");
  }, [activeTab, pluginsResult, result, skills.length]);

  useEffect(() => {
    if (!filterOpen) {
      return;
    }
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!filterRef.current?.contains(event.target as Node)) {
        setFilterOpen(false);
      }
    };
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePointer);
  }, [filterOpen]);

  if (mode === "routing") {
    return <ModelRoutingSkillView models={availableModels} onBack={() => setMode("browse")} />;
  }

  if (mode === "detail" && selectedItem) {
    const currentItem =
      selectedItem.kind === "plugins"
        ? plugins.find((plugin) => plugin.id === selectedItem.item.id) ?? selectedItem.item
        : skills.find((skill) => skill.id === selectedItem.item.id) ?? selectedItem.item;
    const isUpdating =
      selectedItem.kind === "plugins"
        ? updatingPluginIds.has(selectedItem.item.id)
        : updatingSkillIds.has(selectedItem.item.id);
    return (
      <CatalogDetailView
        isUpdating={isUpdating}
        item={currentItem}
        kind={selectedItem.kind}
        onBack={() => setMode("browse")}
        onToggle={async (nextEnabled) => {
          setToggleError(null);
          const response =
            selectedItem.kind === "plugins"
              ? await setPluginEnabled(selectedItem.item.id, nextEnabled)
              : await setSkillEnabled(selectedItem.item.id, nextEnabled);
          if (!response.ok) {
            setToggleError(response.error.message);
          }
        }}
        source={selectedItem.source}
      />
    );
  }

  if (mode === "manage") {
    return (
      <ManageCatalogView
        activeTab={manageTab}
        onBack={() => setMode("browse")}
        onSelectTab={setManageTab}
        onTogglePlugin={async (plugin, nextEnabled) => {
          setToggleError(null);
          const response = await setPluginEnabled(plugin.id, nextEnabled);
          if (!response.ok) {
            setToggleError(response.error.message);
          }
        }}
        onToggleSkill={async (skill, nextEnabled) => {
          setToggleError(null);
          const response = await setSkillEnabled(skill.id, nextEnabled);
          if (!response.ok) {
            setToggleError(response.error.message);
          }
        }}
        plugins={plugins}
        skills={skills}
        updatingPluginIds={updatingPluginIds}
        updatingSkillIds={updatingSkillIds}
      />
    );
  }

  return (
    <section className={styles.view} aria-labelledby="plugins-heading">
      <div className={styles.stickyControls}>
        <div className={styles.tabs} role="tablist" aria-label="Plugins and skills">
          <button
            className={`${styles.tab} ${activeTab === "plugins" ? styles.activeTab : ""}`}
            type="button"
            role="tab"
            aria-selected={activeTab === "plugins"}
            onClick={() => {
              setActiveTab("plugins");
              setFilterSource("all");
            }}
          >
            Plugins
          </button>
          <button
            className={`${styles.tab} ${activeTab === "skills" ? styles.activeTab : ""}`}
            type="button"
            role="tab"
            aria-selected={activeTab === "skills"}
            onClick={() => {
              setActiveTab("skills");
              setFilterSource("all");
            }}
          >
            Skills
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
          <span className={styles.filterWrap} ref={filterRef}>
            <button
              className={styles.filterButton}
              type="button"
              aria-expanded={filterOpen}
              aria-label="Filter plugins and skills"
              onClick={() => setFilterOpen((value) => !value)}
            >
              <FilterLinesIcon size={18} />
            </button>
            {filterOpen ? (
              <span className={styles.filterMenu} role="menu">
                {filterOptions.map((option) => (
                  <button
                    className={option.id === filterSource ? styles.filterMenuItemActive : styles.filterMenuItem}
                    key={option.id}
                    onClick={() => {
                      setFilterSource(option.id);
                      setFilterOpen(false);
                    }}
                    role="menuitemradio"
                    type="button"
                    aria-checked={option.id === filterSource}
                  >
                    <span>{option.label}</span>
                    {option.id === filterSource ? <Check size={16} /> : null}
                  </button>
                ))}
              </span>
            ) : null}
          </span>
        </div>
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
          <RotateCcw size={15} strokeWidth={2.1} />
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
        <EmptyState
          compact
          title="Hermes plugins are unavailable"
          body="This Hermes runtime is reachable, but it does not expose the dashboard plugin hub endpoint. Use Skills for the available Hermes capabilities."
        />
      ) : activeTab === "skills" && result?.ok === false ? (
        <EmptyState compact title="Could not load Hermes skills" body={result.error.message} />
      ) : activeTab === "plugins" ? (
        <PluginsPanel
          enabledPlugins={enabledPlugins}
          groups={pluginGroups}
          isLoading={isLoadingPlugins}
          onManage={() => setMode("manage")}
          onSelectEnabled={(plugin) => {
            setSelectedItem({ item: plugin, kind: "plugins", source: itemCategorySource(plugin) });
            setMode("detail");
          }}
          onSelect={(plugin, source) => {
            setSelectedItem({ item: plugin, kind: "plugins", source });
            setMode("detail");
          }}
          onToggle={async (plugin, nextEnabled) => {
            setToggleError(null);
            const response = await setPluginEnabled(plugin.id, nextEnabled);
            if (!response.ok) {
              setToggleError(response.error.message);
            }
          }}
          query={query}
          register={register}
          updatingIds={updatingPluginIds}
        />
      ) : (
        <SkillsPanel
          groups={skillGroups}
          enabledSkills={enabledSkills}
          isLoading={isLoading}
          onManage={() => {
            setManageTab("skills");
            setMode("manage");
          }}
          onOpenRouting={() => setMode("routing")}
          onSelectEnabled={(skill) => {
            setSelectedItem({ item: skill, kind: "skills", source: itemCategorySource(skill) });
            setMode("detail");
          }}
          onSelect={(skill, source) => {
            setSelectedItem({ item: skill, kind: "skills", source });
            setMode("detail");
          }}
          onToggle={async (skill, nextEnabled) => {
            setToggleError(null);
            const response = await setSkillEnabled(skill.id, nextEnabled);
            if (!response.ok) {
              setToggleError(response.error.message);
            }
          }}
          query={query}
          register={register}
          updatingSkillIds={updatingSkillIds}
        />
      )}
    </section>
  );
}

type CategoryGroup<T> = { label: string; source: string; items: T[] };
type RegisterRef = (id: string) => (element: HTMLElement | null) => void;

function PluginsPanel({
  enabledPlugins,
  groups,
  isLoading,
  onManage,
  onSelect,
  onSelectEnabled,
  onToggle,
  query,
  register,
  updatingIds
}: {
  enabledPlugins: HermesPluginDescriptor[];
  groups: CategoryGroup<HermesPluginDescriptor>[];
  isLoading: boolean;
  onManage: () => void;
  onSelect: (plugin: HermesPluginDescriptor, source: string) => void;
  onSelectEnabled: (plugin: HermesPluginDescriptor) => void;
  onToggle: (plugin: HermesPluginDescriptor, enabled: boolean) => Promise<void>;
  query: string;
  register: RegisterRef;
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
        body={query ? "No Hermes plugins match this search." : "Hermes returned no plugins yet."}
      />
    );
  }

  return (
    <div className={styles.groupStack}>
      {!query && enabledPlugins.length > 0 ? (
        <AddedPluginsSection enabledPlugins={enabledPlugins} onManage={onManage} onSelect={onSelectEnabled} />
      ) : null}
      {groups.map((group) => (
        <section
          className={styles.group}
          data-category-id={slug(group.source)}
          id={`plugin-${slug(group.source)}`}
          key={group.source}
          ref={register(slug(group.source))}
        >
          <div className={styles.sectionHeader}>
            <h2>{prettyCategory(group.source)}</h2>
          </div>
          <div className={styles.grid}>
            {group.items.map((plugin) => (
              <PluginCard
                isUpdating={updatingIds.has(plugin.id)}
                key={plugin.id}
                onSelect={() => onSelect(plugin, group.source)}
                onToggle={onToggle}
                plugin={plugin}
                source={group.source}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function SkillsPanel({
  enabledSkills,
  groups,
  isLoading,
  onManage,
  onOpenRouting,
  onSelect,
  onSelectEnabled,
  onToggle,
  query,
  register,
  updatingSkillIds
}: {
  enabledSkills: HermesSkillDescriptor[];
  groups: CategoryGroup<HermesSkillDescriptor>[];
  isLoading: boolean;
  onManage: () => void;
  onOpenRouting: () => void;
  onSelect: (skill: HermesSkillDescriptor, source: string) => void;
  onSelectEnabled: (skill: HermesSkillDescriptor) => void;
  onToggle: (skill: HermesSkillDescriptor, enabled: boolean) => Promise<void>;
  query: string;
  register: RegisterRef;
  updatingSkillIds: Set<string>;
}) {
  if (isLoading) {
    return <LoadingGrid />;
  }

  return (
    <div className={styles.skillsStack}>
      {!query ? <RoutingSkillSection onOpen={onOpenRouting} /> : null}
      {!query && enabledSkills.length > 0 ? (
        <AddedCatalogSection
          countLabel="skills"
          items={enabledSkills}
          onManage={onManage}
          onSelect={onSelectEnabled}
        />
      ) : null}
      {groups.length === 0 ? (
        <EmptyState
          compact
          title="No skills found"
          body={query ? "No Hermes skills match this search." : "Hermes returned no skills yet."}
        />
      ) : null}
      {groups.map((group) => (
        <section
          className={styles.skillsSection}
          data-category-id={slug(group.source)}
          id={`skills-${slug(group.source)}`}
          key={group.source}
          ref={register(slug(group.source))}
        >
          <div className={styles.sectionHeader}>
            <h2>{prettyCategory(group.source)}</h2>
          </div>
          <div className={styles.grid}>
            {group.items.map((skill) => (
              <SkillCard
                isUpdating={updatingSkillIds.has(skill.id)}
                key={skill.id}
                onSelect={() => onSelect(skill, group.source)}
                onToggle={onToggle}
                skill={skill}
                source={group.source}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function RoutingSkillSection({ onOpen }: { onOpen: () => void }) {
  const { config } = useModelRouting();
  const configured = MODEL_ROUTING_CATEGORIES.filter((category) => config[category.id]).length;
  const subtitle =
    configured > 0
      ? `${configured} categor${configured === 1 ? "y" : "ies"} routed`
      : "Pick a model per task type — fast for simple, powerful for hard";

  return (
    <section className={styles.skillsSection} aria-label="Workspace skills">
      <div className={styles.sectionHeader}>
        <h2>Workspace</h2>
      </div>
      <div className={styles.grid}>
        <article className={styles.skillCard}>
          <button className={styles.cardMain} onClick={onOpen} type="button">
            <span
              className={[styles.skillIcon, styles.resolvedIcon, styles.toneData].join(" ")}
              aria-hidden="true"
            >
              <Cpu size={30} />
            </span>
            <div className={styles.skillBody}>
              <h3>Smart Model Routing</h3>
              <p>{subtitle}</p>
            </div>
          </button>
          <div className={styles.itemActions}>
            <button className={styles.pluginActionButton} onClick={onOpen} type="button">
              Configure
            </button>
          </div>
        </article>
      </div>
    </section>
  );
}

function AddedPluginsSection({
  enabledPlugins,
  onManage,
  onSelect
}: {
  enabledPlugins: HermesPluginDescriptor[];
  onManage: () => void;
  onSelect: (plugin: HermesPluginDescriptor) => void;
}) {
  return <AddedCatalogSection countLabel="plugins" items={enabledPlugins} onManage={onManage} onSelect={onSelect} />;
}

function AddedCatalogSection<T extends CatalogItem>({
  countLabel,
  items,
  onManage,
  onSelect
}: {
  countLabel: string;
  items: T[];
  onManage: () => void;
  onSelect: (item: T) => void;
}) {
  return (
    <section className={styles.addedSection} aria-label={`Added ${countLabel}`}>
      <div className={styles.sectionHeader}>
        <h2>Added</h2>
        <button className={styles.manageButton} type="button" onClick={onManage}>
          Manage
        </button>
      </div>
      <div className={styles.addedIcons}>
        {items.map((item) => (
          <button
            className={styles.addedIconButton}
            key={item.id}
            onClick={() => onSelect(item)}
            type="button"
            aria-label={`Open ${item.title}`}
          >
            <SkillIcon className={styles.pluginIcon} showNativeTitle={false} skill={item} source={itemCategorySource(item)} />
            <span className={styles.addedIconLabel}>{item.title}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

function CatalogDetailView({
  isUpdating,
  item,
  kind,
  onBack,
  onToggle,
  source
}: {
  isUpdating: boolean;
  item: CatalogItem;
  kind: PluginsTab;
  onBack: () => void;
  onToggle: (enabled: boolean) => Promise<void>;
  source: string;
}) {
  const rows = detailRows(item, source);
  const isEnabled = item.enabled === true;
  const actionLabel = isEnabled ? "Disable" : kind === "plugins" ? "Add plugin" : "Enable skill";
  const nextEnabled = !isEnabled;
  return (
    <section className={styles.detailView} aria-labelledby="plugin-detail-heading">
      <div className={styles.breadcrumb}>
        <button type="button" onClick={onBack}>
          {kind === "plugins" ? "Plugins" : "Skills"}
        </button>
        <span aria-hidden="true">&gt;</span>
        <strong>{item.title}</strong>
      </div>
      <header className={styles.detailHeader}>
        <SkillIcon className={styles.skillIcon} skill={item} source={source} />
        <div>
          <h1 id="plugin-detail-heading">{item.title}</h1>
          <p>{item.description ?? item.name}</p>
        </div>
        {item.enabled !== null ? (
          <button
            aria-busy={isUpdating}
            className={isEnabled ? styles.detailActionButton : styles.detailAddButton}
            onClick={() => {
              if (!isUpdating) {
                void onToggle(nextEnabled);
              }
            }}
            type="button"
          >
            {!isEnabled ? <Plus size={14} /> : null}
            <span>{actionLabel}</span>
          </button>
        ) : null}
      </header>
      <div className={styles.detailHero}>
        <div className={styles.detailPrompt}>
          <SkillIcon className={styles.pluginIcon} skill={item} source={source} />
          <span>{item.title}</span>
          <b>{item.description ?? item.name}</b>
        </div>
      </div>
      {item.description ? <p className={styles.detailDescription}>{item.description}</p> : null}
      <section className={styles.detailInfo} aria-label="Information">
        <h2>Information</h2>
        {rows.map((row) => (
          <div className={styles.detailInfoRow} key={row.label}>
            <span>{row.label}</span>
            <b>{row.value}</b>
          </div>
        ))}
      </section>
    </section>
  );
}

function ManageCatalogView({
  activeTab,
  onBack,
  onSelectTab,
  onTogglePlugin,
  onToggleSkill,
  plugins,
  skills,
  updatingPluginIds,
  updatingSkillIds
}: {
  activeTab: PluginsTab;
  onBack: () => void;
  onSelectTab: (tab: PluginsTab) => void;
  onTogglePlugin: (plugin: HermesPluginDescriptor, enabled: boolean) => Promise<void>;
  onToggleSkill: (skill: HermesSkillDescriptor, enabled: boolean) => Promise<void>;
  plugins: HermesPluginDescriptor[];
  skills: HermesSkillDescriptor[];
  updatingPluginIds: Set<string>;
  updatingSkillIds: Set<string>;
}) {
  const [manageQuery, setManageQuery] = useState("");
  const [openActionId, setOpenActionId] = useState<string | null>(null);
  const actionMenuRef = useRef<HTMLSpanElement | null>(null);
  const rows = activeTab === "plugins" ? filterCatalogItems(plugins, manageQuery) : filterCatalogItems(skills, manageQuery);

  useEffect(() => {
    if (!openActionId) {
      return;
    }

    function closeOnOutsidePointer(event: PointerEvent) {
      const target = event.target;
      if (target instanceof Node && actionMenuRef.current?.contains(target)) {
        return;
      }
      setOpenActionId(null);
    }

    document.addEventListener("pointerdown", closeOnOutsidePointer, true);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePointer, true);
  }, [openActionId]);

  return (
    <section className={styles.manageView} aria-labelledby="plugin-manage-heading">
      <h1 className={styles.srOnly} id="plugin-manage-heading">
        Manage plugins and skills
      </h1>
      <div className={styles.breadcrumb}>
        <button type="button" onClick={onBack}>
          Plugins
        </button>
        <span aria-hidden="true">&gt;</span>
        <strong>Manage</strong>
      </div>
      <div className={styles.manageToolbar}>
        <div className={styles.manageTabs} role="tablist" aria-label="Manage catalog">
          <button
            className={activeTab === "plugins" ? styles.manageTabActive : styles.manageTab}
            onClick={() => onSelectTab("plugins")}
            type="button"
          >
            Plugins <span>{plugins.length}</span>
          </button>
          <button className={styles.manageTab} disabled type="button">
            MCPs <span>0</span>
          </button>
          <button
            className={activeTab === "skills" ? styles.manageTabActive : styles.manageTab}
            onClick={() => onSelectTab("skills")}
            type="button"
          >
            Skills <span>{skills.length}</span>
          </button>
        </div>
        <label className={styles.manageSearch}>
          <Search size={14} />
          <input
            aria-label={`Search ${activeTab}`}
            onChange={(event) => setManageQuery(event.currentTarget.value)}
            placeholder={`Search ${activeTab}`}
            value={manageQuery}
          />
        </label>
      </div>
      <div className={styles.manageList}>
        {rows.map((item) => {
          const isPlugin = activeTab === "plugins";
          const updating = isPlugin ? updatingPluginIds.has(item.id) : updatingSkillIds.has(item.id);
          return (
            <article className={styles.manageRow} key={item.id}>
              <SkillIcon className={styles.skillIcon} skill={item} source={itemCategorySource(item)} />
              <div className={styles.skillBody}>
                <h3>{item.title}</h3>
                <p>{item.description ?? item.name}</p>
              </div>
              <span className={styles.manageActions} ref={openActionId === item.id ? actionMenuRef : null}>
                <button
                  aria-expanded={openActionId === item.id}
                  aria-label={`More actions for ${item.title}`}
                  className={styles.manageMoreButton}
                  onClick={() => setOpenActionId((current) => current === item.id ? null : item.id)}
                  type="button"
                >
                  <MoreHorizontal size={15} />
                </button>
                {openActionId === item.id ? (
                  <span className={styles.manageActionMenu} role="menu">
                    <button
                      className={styles.manageDeleteButton}
                      onClick={() => setOpenActionId(null)}
                      role="menuitem"
                      type="button"
                    >
                      <Trash2 size={14} />
                      <span>Delete</span>
                    </button>
                  </span>
                ) : null}
              </span>
              <ManageToggle
                checked={item.enabled === true}
                disabled={item.enabled === null}
                isUpdating={updating}
                onToggle={(enabled) =>
                  isPlugin
                    ? onTogglePlugin(item as HermesPluginDescriptor, enabled)
                    : onToggleSkill(item as HermesSkillDescriptor, enabled)
                }
              />
            </article>
          );
        })}
      </div>
    </section>
  );
}

function ManageToggle({
  checked,
  disabled,
  isUpdating,
  onToggle
}: {
  checked: boolean;
  disabled: boolean;
  isUpdating: boolean;
  onToggle: (enabled: boolean) => Promise<void>;
}) {
  return (
    <button
      aria-pressed={checked}
      className={checked ? styles.manageToggleOn : styles.manageToggle}
      disabled={disabled}
      onClick={() => {
        if (!isUpdating) {
          void onToggle(!checked);
        }
      }}
      type="button"
    >
      <span />
    </button>
  );
}

function PluginCard({
  isUpdating,
  onSelect,
  onToggle,
  plugin,
  source
}: {
  isUpdating: boolean;
  onSelect: () => void;
  onToggle: (plugin: HermesPluginDescriptor, enabled: boolean) => Promise<void>;
  plugin: HermesPluginDescriptor;
  source: string;
}) {
  return (
    <article className={styles.skillCard}>
      <button className={styles.cardMain} onClick={onSelect} type="button">
        <SkillIcon className={styles.skillIcon} skill={plugin} source={source} />
        <div className={styles.skillBody}>
          <h3>{plugin.title}</h3>
          <p>{plugin.description ?? plugin.name}</p>
        </div>
      </button>
      <ItemActions isUpdating={isUpdating} onToggle={(enabled) => onToggle(plugin, enabled)} item={plugin} />
    </article>
  );
}

function SkillCard({
  isUpdating,
  onSelect,
  onToggle,
  skill,
  source
}: {
  isUpdating: boolean;
  onSelect: () => void;
  onToggle: (skill: HermesSkillDescriptor, enabled: boolean) => Promise<void>;
  skill: HermesSkillDescriptor;
  source: string;
}) {
  return (
    <article className={styles.skillCard}>
      <button className={styles.cardMain} onClick={onSelect} type="button">
        <SkillIcon className={styles.skillIcon} skill={skill} source={source} />
        <div className={styles.skillBody}>
          <h3>{skill.title}</h3>
          <p>{skill.description ?? skill.name}</p>
        </div>
      </button>
      <ItemActions isUpdating={isUpdating} onToggle={(enabled) => onToggle(skill, enabled)} item={skill} />
    </article>
  );
}

function ItemActions({
  isUpdating,
  item,
  onToggle
}: {
  isUpdating: boolean;
  item: CatalogItem;
  onToggle: (enabled: boolean) => Promise<void>;
}) {
  const hasKnownState = item.enabled !== null;
  const isEnabled = item.enabled === true;
  const statusLabel = !hasKnownState ? "State unavailable" : isEnabled ? "Enabled" : "Disabled";
  const addLabel = isEnabled ? `${item.title} is already added` : `Add ${item.title}`;
  const toggleLabel = !hasKnownState ? `${item.title} state unavailable` : isEnabled ? `Disable ${item.title}` : `Enable ${item.title}`;

  return (
    <div className={styles.itemActions}>
      <span
        className={`${styles.itemStateSlot} ${
          !hasKnownState ? styles.itemStateUnknown : isEnabled ? styles.itemStateEnabled : styles.itemStateDisabled
        }`}
        title={hasKnownState ? `${item.title} is ${statusLabel.toLowerCase()}` : "Hermes did not report this item state"}
      >
        <span className={styles.itemStatusDot} aria-label={statusLabel} role="img" />
        <button
          aria-busy={isUpdating}
          aria-label={toggleLabel}
          aria-pressed={isEnabled}
          className={styles.itemStateToggle}
          disabled={!hasKnownState}
          onClick={(event) => {
            event.stopPropagation();
            if (!isUpdating && hasKnownState) {
              void onToggle(!isEnabled);
            }
          }}
          title={toggleLabel}
          type="button"
        >
          <span />
        </button>
      </span>
      {!isEnabled && hasKnownState ? (
        <button
          className={styles.pluginActionButton}
          disabled={isUpdating}
          onClick={(event) => {
            event.stopPropagation();
            if (!isUpdating) {
              void onToggle(true);
            }
          }}
          title={addLabel}
          type="button"
          aria-busy={isUpdating}
          aria-label={addLabel}
        >
          Add
        </button>
      ) : (
        <span
          aria-hidden="true"
          className={styles.pluginActionPlaceholder}
          title={hasKnownState ? addLabel : "Hermes did not report this item state"}
        />
      )}
    </div>
  );
}

function SkillIcon({
  className,
  label,
  showNativeTitle = true,
  skill,
  source
}: {
  className: string;
  label?: string;
  showNativeTitle?: boolean;
  skill?: CatalogItem;
  source?: string;
}) {
  const visual = resolveSkillVisual(skill, source ?? skill?.source ?? label);
  const Icon = visual.icon;
  const style = {
    background: LIGHT_BRAND_BACKGROUND,
    color: colorForLightThumbnail(visual.color ?? TONE_LIGHT_ICON_COLORS[visual.tone])
  };

  return (
    <span
      className={[className, styles.resolvedIcon, styles[visual.tone], styles.lightIcon].join(" ")}
      aria-hidden="true"
      style={style}
      title={showNativeTitle ? label ?? skill?.title ?? source : undefined}
    >
      {visual.mark ? <span className={styles.iconMark}>{visual.mark}</span> : <Icon size={30} />}
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
  alibaba: "#ff6a00",
  anthropic: "#d97757",
  arcee: "#d97757",
  arxiv: "#b31b1b",
  azure: "#53a9ff",
  bedrock: "#49d17f",
  brave: "#fb542b",
  browserbase: "#ff4500",
  browseruse: "#f5f5f5",
  claude: "#d97757",
  codex: "#f4f4f5",
  comfyui: "#f0ff41",
  copilot: "#f5f5f5",
  deepseek: "#4d6bfe",
  discord: "#5865f2",
  duckduckgo: "#de5833",
  exa: "#f5f5f5",
  excalidraw: "#6965db",
  fal: "#ff176b",
  gemini: "#8e75f8",
  giphy: "#ff6666",
  github: "#f5f5f5",
  google: "#4285f4",
  googlechat: "#34a853",
  googledocs: "#4285f4",
  googlemaps: "#4285f4",
  googlemeet: "#34a853",
  huggingface: "#ffd21e",
  jupyter: "#f37626",
  kilocode: "#f5f5f5",
  kimi: "#f5f5f5",
  krea: "#f4f4f5",
  langfuse: "#f5f5f5",
  line: "#06c755",
  linear: "#5e6ad2",
  linux: "#fcc624",
  mattermost: "#0058cc",
  microsoft: "#f25022",
  minimax: "#e8443b",
  notion: "#f5f5f5",
  novita: "#f5f5f5",
  ntfy: "#338574",
  nvidia: "#76b900",
  nous: "#f5f5f5",
  obsidian: "#7c3aed",
  ollama: "#f5f5f5",
  openai: "#f5f5f5",
  opencode: "#f5f5f5",
  openrouter: "#f5f5f5",
  p5dotjs: "#ed225d",
  parallel: "#1d1c1a",
  perplexity: "#20b8cd",
  philipshue: "#0065d3",
  qwen: "#615ced",
  searxng: "#2a5e8d",
  simplex: "#f5f5f5",
  spotify: "#1ed760",
  stepfun: "#f5f5f5",
  tavily: "#f5f5f5",
  weightsandbiases: "#ffbe00",
  x: "#f5f5f5",
  xai: "#f5f5f5",
  xiaomi: "#ff6900",
  youtube: "#ff0000",
  zai: "#f5f5f5"
} as const;

const DARK_BRAND_BACKGROUND = "rgba(255, 255, 255, 0.075)";
const LIGHT_BRAND_BACKGROUND = "#ffffff";

function brandVisual(icon: AppIcon, color: string, background = LIGHT_BRAND_BACKGROUND): SkillVisual {
  return { background, color: background === LIGHT_BRAND_BACKGROUND ? colorForLightThumbnail(color) : color, icon, tone: "toneBrand" };
}

function colorTile(icon: AppIcon): SkillVisual {
  return { background: LIGHT_BRAND_BACKGROUND, color: "#111111", icon, tone: "toneBrand" };
}

function colorForLightThumbnail(color: string) {
  const normalized = color.toLowerCase();
  if (normalized === "#ffffff" || normalized === "#fff" || normalized === "#f4f4f5" || normalized === "#f5f5f5") {
    return "#111111";
  }

  const hex = normalized.replace("#", "");
  const expanded =
    hex.length === 3
      ? hex
          .split("")
          .map((value) => value + value)
          .join("")
      : hex;

  if (!/^[0-9a-f]{6}$/.test(expanded)) {
    return color;
  }

  const r = parseInt(expanded.slice(0, 2), 16);
  const g = parseInt(expanded.slice(2, 4), 16);
  const b = parseInt(expanded.slice(4, 6), 16);
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  if (luminance <= 0.64) {
    return color;
  }

  const darken = (value: number) => Math.round(value * 0.56)
    .toString(16)
    .padStart(2, "0");
  return `#${darken(r)}${darken(g)}${darken(b)}`;
}

const TONE_LIGHT_ICON_COLORS: Record<SkillVisual["tone"], string> = {
  toneAgent: "#2f7d62",
  toneArticle: "#3f5f84",
  toneBrand: "#111111",
  toneCode: "#3b6fd8",
  toneCreative: "#7a4fd8",
  toneData: "#2575a7",
  toneDiagram: "#118a9e",
  toneHermes: "#111111",
  toneMemory: "#7853bd",
  toneVideo: "#cf4d4d"
};

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
  { match: ["browser use"], icon: BrowserUseBrandIcon },
  { match: ["browserbase"], icon: BrowserbaseBrandIcon },
  { match: ["claude code"], icon: ClaudeCodeBrandIcon },
  { match: ["codex"], icon: CodexBrandIcon },
  { match: ["opencode", "open code"], icon: OpenCodeBrandIcon },
  { match: ["comfy"], icon: ComfyUiBrandIcon },
  { match: ["fal ai", "fal"], icon: FalBrandIcon },
  { match: ["krea"], icon: KreaBrandIcon },
  { match: ["arcee"], icon: ArceeBrandIcon },
  { match: ["bedrock", "aws bedrock"], icon: BedrockBrandIcon },
  { match: ["azure foundry", "azure ai", "azure"], icon: AzureBrandIcon },
  { match: ["bloomberg"], icon: BloombergBrandIcon },
  { match: ["firecrawl"], icon: FirecrawlBrandIcon },
  { match: ["hermes agent"], icon: NousResearchBrandIcon },
  { match: ["kilocode", "kilo code"], icon: KiloCodeBrandIcon },
  { match: ["kimi coding", "kimi", "moonshot"], icon: KimiBrandIcon },
  { match: ["langfuse"], icon: LangfuseBrandIcon },
  { match: ["novita"], icon: NovitaBrandIcon },
  { match: ["openrouter", "open router"], icon: OpenRouterBrandIcon },
  { match: ["stepfun", "step fun"], icon: StepfunBrandIcon },
  { match: ["tavily"], icon: TavilyBrandIcon },
  { match: ["z ai", "zai"], icon: ZaiBrandIcon },
  { match: ["exa"], icon: ExaBrandIcon },
  { match: ["parallel"], icon: ParallelBrandIcon },
  { match: ["brave"], icon: BraveBrandIcon },
  { match: ["discord"], icon: DiscordBrandIcon },
  { match: ["ddgs", "duckduckgo", "duck duck go"], icon: DuckDuckGoBrandIcon },
  { match: ["google chat"], icon: GoogleChatBrandIcon },
  { match: ["google meet"], icon: GoogleMeetBrandIcon },
  { match: ["interactive brokers", "ib connect"], icon: InteractiveBrokersBrandIcon },
  { match: ["line"], icon: LineBrandIcon },
  { match: ["mattermost"], icon: MattermostBrandIcon },
  { match: ["microsoft teams", "teams pipeline", "teams"], icon: MicrosoftBrandIcon },
  { match: ["nous research", "nous"], icon: NousResearchBrandIcon },
  { match: ["ntfy"], icon: NtfyBrandIcon },
  { match: ["searxng", "searx"], icon: SearxngBrandIcon },
  { match: ["simplex"], icon: SimplexBrandIcon },
  { match: ["claude"], icon: ClaudeBrandIcon },
  { match: ["airtable"], icon: BRAND_ICONS.airtable },
  { match: ["linear"], icon: BRAND_ICONS.linear },
  { match: ["notion"], icon: BRAND_ICONS.notion },
  { match: ["obsidian"], icon: BRAND_ICONS.obsidian },
  { match: ["jupyter"], icon: BRAND_ICONS.jupyter },
  { match: ["hugging"], icon: BRAND_ICONS.huggingface },
  { match: ["nvidia"], icon: BRAND_ICONS.nvidia },
  { match: ["gemini", "google ai", "google-ai"], icon: BRAND_ICONS.gemini },
  { match: ["copilot"], icon: BRAND_ICONS.copilot },
  { match: ["deepseek"], icon: BRAND_ICONS.deepseek },
  { match: ["qwen"], icon: BRAND_ICONS.qwen },
  { match: ["xiaomi", "mimo"], icon: BRAND_ICONS.xiaomi },
  { match: ["alibaba", "qwq", "tongyi"], icon: BRAND_ICONS.alibaba },
  { match: ["minimax"], icon: BRAND_ICONS.minimax },
  { match: ["xai", "grok"], icon: BRAND_ICONS.xai },
  { match: ["perplexity"], icon: BRAND_ICONS.perplexity },
  { match: ["anthropic"], icon: BRAND_ICONS.anthropic },
  { match: ["ollama"], icon: BRAND_ICONS.ollama },
  { match: ["openai", "gpt"], icon: BRAND_ICONS.openai },
  { match: ["excalidraw"], icon: BRAND_ICONS.excalidraw },
  { match: ["p5js", "p5.js"], icon: BRAND_ICONS.p5dotjs },
  { match: ["arxiv"], icon: BRAND_ICONS.arxiv },
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

const DESCRIPTION_BRAND_RULES = BRAND_RULES.filter((rule) => rule.icon !== NousResearchBrandIcon);

const BRAND_VISUALS = new Map<AppIcon, SkillVisual>([
  [ComputerUseColorIcon, colorTile(ComputerUseColorIcon)],
  [ChromeColorIcon, colorTile(ChromeColorIcon)],
  [GoogleSheetsColorIcon, colorTile(GoogleSheetsColorIcon)],
  [GoogleSlidesColorIcon, colorTile(GoogleSlidesColorIcon)],
  [PdfColorIcon, colorTile(PdfColorIcon)],
  [GoogleDocsColorIcon, colorTile(GoogleDocsColorIcon)],
  [BrowserUseBrandIcon, brandVisual(BrowserUseBrandIcon, BRAND_COLORS.browseruse)],
  [BrowserbaseBrandIcon, colorTile(BrowserbaseBrandIcon)],
  [ClaudeCodeBrandIcon, brandVisual(ClaudeCodeBrandIcon, BRAND_COLORS.claude)],
  [CodexBrandIcon, brandVisual(CodexBrandIcon, BRAND_COLORS.codex)],
  [OpenCodeBrandIcon, brandVisual(OpenCodeBrandIcon, BRAND_COLORS.opencode)],
  [ComfyUiBrandIcon, brandVisual(ComfyUiBrandIcon, BRAND_COLORS.comfyui, "#162dd4")],
  [FalBrandIcon, brandVisual(FalBrandIcon, BRAND_COLORS.fal)],
  [KreaBrandIcon, brandVisual(KreaBrandIcon, BRAND_COLORS.krea, "#34274f")],
  [ArceeBrandIcon, brandVisual(ArceeBrandIcon, BRAND_COLORS.arcee, "#2f1f19")],
  [BedrockBrandIcon, brandVisual(BedrockBrandIcon, BRAND_COLORS.bedrock, "#123421")],
  [AzureBrandIcon, brandVisual(AzureBrandIcon, BRAND_COLORS.azure, "#121f33")],
  [BloombergBrandIcon, brandVisual(BloombergBrandIcon, "#111111")],
  [FirecrawlBrandIcon, brandVisual(FirecrawlBrandIcon, "#fa5d19")],
  [KiloCodeBrandIcon, brandVisual(KiloCodeBrandIcon, BRAND_COLORS.kilocode, "#111111")],
  [KimiBrandIcon, brandVisual(KimiBrandIcon, BRAND_COLORS.kimi, "#151515")],
  [LangfuseBrandIcon, brandVisual(LangfuseBrandIcon, BRAND_COLORS.langfuse, "#171717")],
  [NovitaBrandIcon, brandVisual(NovitaBrandIcon, BRAND_COLORS.novita, "#171717")],
  [OpenRouterBrandIcon, brandVisual(OpenRouterBrandIcon, BRAND_COLORS.openrouter, "#171717")],
  [StepfunBrandIcon, brandVisual(StepfunBrandIcon, BRAND_COLORS.stepfun, "#171717")],
  [TavilyBrandIcon, brandVisual(TavilyBrandIcon, BRAND_COLORS.tavily, "#171717")],
  [ZaiBrandIcon, brandVisual(ZaiBrandIcon, BRAND_COLORS.zai, "#171717")],
  [ExaBrandIcon, brandVisual(ExaBrandIcon, BRAND_COLORS.exa, "#111111")],
  [ParallelBrandIcon, brandVisual(ParallelBrandIcon, BRAND_COLORS.parallel, LIGHT_BRAND_BACKGROUND)],
  [BraveBrandIcon, brandVisual(BraveBrandIcon, BRAND_COLORS.brave)],
  [DiscordBrandIcon, brandVisual(DiscordBrandIcon, BRAND_COLORS.discord)],
  [DuckDuckGoBrandIcon, brandVisual(DuckDuckGoBrandIcon, BRAND_COLORS.duckduckgo)],
  [GoogleChatBrandIcon, brandVisual(GoogleChatBrandIcon, BRAND_COLORS.googlechat)],
  [GoogleMeetBrandIcon, brandVisual(GoogleMeetBrandIcon, BRAND_COLORS.googlemeet)],
  [InteractiveBrokersBrandIcon, brandVisual(InteractiveBrokersBrandIcon, "#111111")],
  [LineBrandIcon, brandVisual(LineBrandIcon, BRAND_COLORS.line)],
  [MattermostBrandIcon, brandVisual(MattermostBrandIcon, BRAND_COLORS.mattermost)],
  [MicrosoftBrandIcon, brandVisual(MicrosoftBrandIcon, BRAND_COLORS.microsoft, "#111111")],
  [NousResearchBrandIcon, brandVisual(NousResearchBrandIcon, "#111111", LIGHT_BRAND_BACKGROUND)],
  [NtfyBrandIcon, brandVisual(NtfyBrandIcon, BRAND_COLORS.ntfy)],
  [SearxngBrandIcon, brandVisual(SearxngBrandIcon, BRAND_COLORS.searxng)],
  [SimplexBrandIcon, brandVisual(SimplexBrandIcon, BRAND_COLORS.simplex, "#111111")],
  [ClaudeBrandIcon, brandVisual(ClaudeBrandIcon, BRAND_COLORS.claude)],
  [BRAND_ICONS.airtable, brandVisual(BRAND_ICONS.airtable, BRAND_COLORS.airtable)],
  [BRAND_ICONS.linear, brandVisual(BRAND_ICONS.linear, BRAND_COLORS.linear)],
  [BRAND_ICONS.notion, brandVisual(BRAND_ICONS.notion, "#111111", LIGHT_BRAND_BACKGROUND)],
  [BRAND_ICONS.obsidian, brandVisual(BRAND_ICONS.obsidian, BRAND_COLORS.obsidian)],
  [BRAND_ICONS.jupyter, brandVisual(BRAND_ICONS.jupyter, BRAND_COLORS.jupyter)],
  [BRAND_ICONS.huggingface, brandVisual(BRAND_ICONS.huggingface, "#111111", BRAND_COLORS.huggingface)],
  [BRAND_ICONS.nvidia, brandVisual(BRAND_ICONS.nvidia, BRAND_COLORS.nvidia)],
  [BRAND_ICONS.gemini, brandVisual(BRAND_ICONS.gemini, BRAND_COLORS.gemini)],
  [BRAND_ICONS.copilot, brandVisual(BRAND_ICONS.copilot, BRAND_COLORS.copilot)],
  [BRAND_ICONS.deepseek, brandVisual(BRAND_ICONS.deepseek, BRAND_COLORS.deepseek)],
  [BRAND_ICONS.qwen, brandVisual(BRAND_ICONS.qwen, BRAND_COLORS.qwen)],
  [BRAND_ICONS.xiaomi, brandVisual(BRAND_ICONS.xiaomi, BRAND_COLORS.xiaomi)],
  [BRAND_ICONS.alibaba, brandVisual(BRAND_ICONS.alibaba, BRAND_COLORS.alibaba)],
  [BRAND_ICONS.minimax, brandVisual(BRAND_ICONS.minimax, BRAND_COLORS.minimax)],
  [BRAND_ICONS.xai, brandVisual(BRAND_ICONS.xai, BRAND_COLORS.xai)],
  [BRAND_ICONS.perplexity, brandVisual(BRAND_ICONS.perplexity, BRAND_COLORS.perplexity)],
  [BRAND_ICONS.anthropic, brandVisual(BRAND_ICONS.anthropic, BRAND_COLORS.anthropic)],
  [BRAND_ICONS.openai, brandVisual(BRAND_ICONS.openai, BRAND_COLORS.openai)],
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
  const paddedText = ` ${text} `;
  return rules.find((rule) =>
    rule.match.some((keyword) => {
      const normalizedKeyword = normalizeIconText([keyword]);
      if (/^[a-z0-9]+$/.test(normalizedKeyword) && normalizedKeyword.length <= 4) {
        return paddedText.includes(` ${normalizedKeyword} `);
      }
      return text.includes(normalizedKeyword);
    })
  );
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
  const titleText = normalizeIconText([skill?.title, skill?.name]);
  const categoryText = normalizeIconText([skill?.category, source]);
  if (
    categoryText === "hermes" ||
    titleText === "hermes" ||
    titleText.startsWith("hermes ") ||
    titleText.includes(" hermes ")
  ) {
    return BRAND_VISUALS.get(NousResearchBrandIcon) ?? { icon: NousResearchBrandIcon, tone: "toneBrand" };
  }

  const brand = matchRule(BRAND_RULES, brandText);
  if (brand) {
    return BRAND_VISUALS.get(brand.icon) ?? { icon: brand.icon, tone: "toneBrand" };
  }

  // Branded integrations (providers, platforms, web/browser tools, media gen)
  // that have no logo get a lettered monogram tile — the modern app-directory
  // convention — instead of a generic plug/server glyph. This wins over the
  // greedy semantic "provider"/"server" rule below.
  const rawCategory = (skill?.category ?? source ?? "").toLowerCase().trim();
  if (INTEGRATION_CATEGORIES.has(rawCategory)) {
    const integrationBrandText = normalizeIconText([skill?.description]);
    const integrationBrand = matchRule(DESCRIPTION_BRAND_RULES, integrationBrandText);
    if (integrationBrand) {
      return BRAND_VISUALS.get(integrationBrand.icon) ?? { icon: integrationBrand.icon, tone: "toneBrand" };
    }
    return monogramVisual(skill?.title ?? skill?.name ?? source ?? "");
  }

  // Semantic matching also ignores the description: every Hermes skill's blurb
  // mentions "Hermes"/"Codex"/etc., which would otherwise mislabel skills.
  const semantic = matchRule(SEMANTIC_RULES, brandText);
  if (semantic) {
    return { icon: semantic.icon, mark: semantic.mark, tone: semantic.tone ?? "toneHermes" };
  }

  const category = rawCategory.replace(/\s+/g, "-");
  if (CATEGORY_DEFAULTS[category]) {
    return CATEGORY_DEFAULTS[category];
  }

  return { icon: Plug, tone: "toneHermes" };
}

const INTEGRATION_CATEGORIES = new Set([
  "model providers",
  "platforms",
  "web",
  "browser",
  "image gen",
  "video gen",
  "observability",
  "dashboard auth",
  "google meet",
  "spotify",
  "teams pipeline"
]);

const MONOGRAM_COLORS = ["#5b6cff", "#1fa392", "#c2643b", "#9a6cff", "#3b82c2", "#c23b6e", "#3ba35b", "#b08b2e"];

function monogramVisual(label: string): SkillVisual {
  const words = label.replace(/[_/-]+/g, " ").trim().split(/\s+/).filter(Boolean);
  const mark = (words.length >= 2 ? words[0][0] + words[1][0] : (words[0] ?? "?").slice(0, 2)).toUpperCase();
  let hash = 0;
  for (let index = 0; index < label.length; index += 1) {
    hash = (hash * 31 + label.charCodeAt(index)) >>> 0;
  }
  const color = MONOGRAM_COLORS[hash % MONOGRAM_COLORS.length];
  return { background: hexToTint(color), color, icon: Plug, mark, tone: "toneBrand" };
}

function hexToTint(hex: string): string {
  const value = hex.replace("#", "");
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, 0.16)`;
}

function normalizeIconText(values: Array<string | null | undefined>) {
  return values
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .replace(/[_.\\/-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function SummaryPill({ label, value }: { label: string; value: string }) {
  return (
    <span className={styles.summaryPill}>
      <span>{label}</span>
      <b>{value}</b>
    </span>
  );
}

function FilterLinesIcon({ size = 16 }: { size?: number }) {
  return (
    <svg aria-hidden="true" fill="none" height={size} viewBox="0 0 24 24" width={size}>
      <path d="M5 7h14M8.5 12h7M11 17h2" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
    </svg>
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

function itemCategorySource(item: CatalogItem) {
  return item.category ?? item.source ?? "Hermes";
}

type DetailRow = { label: string; value: ReactNode };

function detailRows(item: CatalogItem, source: string): DetailRow[] {
  const website = firstUrl(item.description);
  const rows: DetailRow[] = [
    { label: "Developer", value: developerLabel(item, source) },
    { label: "Category", value: prettyCategory(item.category ?? source) }
  ];

  if (website) {
    rows.push({
      label: "Website",
      value: (
        <a href={website} rel="noreferrer" target="_blank">
          {website.replace(/^https?:\/\//, "")}
        </a>
      )
    });
  }

  rows.push({ label: "Source", value: item.source ?? source });

  if ("status" in item && item.status) {
    rows.push({ label: "Status", value: item.status });
  }

  if ("version" in item && item.version) {
    rows.push({ label: "Version", value: item.version });
  }

  if (item.tags.length > 0) {
    rows.push({ label: "Tags", value: item.tags.join(", ") });
  }

  return rows;
}

function developerLabel(item: CatalogItem, source: string) {
  if (item.source && item.source !== "bundled") {
    return prettyCategory(item.source);
  }
  return item.title;
}

function firstUrl(value: string | null | undefined) {
  const match = value?.match(/https?:\/\/[^\s),]+/);
  return match?.[0] ?? null;
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
    const source = itemCategorySource(item);
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

function sortCatalogItemsByState<T extends CatalogItem>(items: T[]) {
  return [...items].sort((a, b) => {
    const stateDelta = skillStateRank(a) - skillStateRank(b);
    if (stateDelta !== 0) {
      return stateDelta;
    }
    return a.title.localeCompare(b.title);
  });
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

function prettyCategory(value: string) {
  return value
    .replace(/[_-]+/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
