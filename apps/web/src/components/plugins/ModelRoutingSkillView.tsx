"use client";

import { Check, ChevronDown, Cpu, Search } from "@/components/ui/AppIcons";
import { useEffect, useMemo, useRef, useState } from "react";
import type { HermesModelDescriptor } from "@hermes-ui/hermes-client";
import {
  MODEL_ROUTING_CATEGORIES,
  useModelRouting,
  type ModelRoutingSelection
} from "@/lib/modelRoutingStore";
import pluginsStyles from "./PluginsView.module.css";
import styles from "./ModelRoutingSkillView.module.css";

type ModelRoutingSkillViewProps = {
  models: HermesModelDescriptor[];
  onBack: () => void;
};

const AUTO_LABEL = "Use composer model";

export function ModelRoutingSkillView({ models, onBack }: ModelRoutingSkillViewProps) {
  const { config, setCategoryModel } = useModelRouting();
  const configuredCount = MODEL_ROUTING_CATEGORIES.filter((category) => config[category.id]).length;

  return (
    <section className={pluginsStyles.detailView} aria-labelledby="model-routing-heading">
      <div className={pluginsStyles.breadcrumb}>
        <button type="button" onClick={onBack}>
          Skills
        </button>
        <span aria-hidden="true">&gt;</span>
        <strong>Smart Model Routing</strong>
      </div>

      <header className={pluginsStyles.detailHeader}>
        <span className={[pluginsStyles.skillIcon, pluginsStyles.resolvedIcon, pluginsStyles.toneData].join(" ")} aria-hidden="true">
          <Cpu size={30} />
        </span>
        <div>
          <h1 id="model-routing-heading">Smart Model Routing</h1>
          <p>Match each kind of task to the right model — fast for simple, powerful for hard.</p>
        </div>
      </header>

      <p className={pluginsStyles.detailDescription}>
        Pick a model for each task category below. Use a powerful, large-context model for difficult
        work and a cheaper or local model for simple tasks that need speed. Choices use the same
        Hermes model catalog as the Composer and are saved on this device. Leave a category on
        “{AUTO_LABEL}” to keep using whatever model is selected in the Composer.
      </p>

      <section className={styles.section} aria-label="Task categories">
        <h2>Task categories{configuredCount > 0 ? ` · ${configuredCount} set` : ""}</h2>
        <div className={styles.categoryList}>
          {MODEL_ROUTING_CATEGORIES.map((category) => (
            <div className={styles.categoryRow} key={category.id}>
              <div className={styles.categoryInfo}>
                <p className={styles.categoryLabel}>{category.label}</p>
                <p className={styles.categoryDescription}>{category.description}</p>
              </div>
              <CategoryModelPicker
                categoryLabel={category.label}
                models={models}
                onChange={(selection) => setCategoryModel(category.id, selection)}
                value={config[category.id] ?? null}
              />
            </div>
          ))}
        </div>
      </section>
    </section>
  );
}

function CategoryModelPicker({
  categoryLabel,
  models,
  onChange,
  value
}: {
  categoryLabel: string;
  models: HermesModelDescriptor[];
  onChange: (selection: ModelRoutingSelection | null) => void;
  value: ModelRoutingSelection | null;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const wrapRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const hasModels = models.length > 0;

  const groups = useMemo(() => groupModels(models, query), [models, query]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      return;
    }

    const frame = window.requestAnimationFrame(() => searchRef.current?.focus());

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node | null;
      if (target && wrapRef.current?.contains(target)) {
        return;
      }
      setOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const select = (selection: ModelRoutingSelection | null) => {
    onChange(selection);
    setOpen(false);
  };

  const buttonLabel = value ? value.label : AUTO_LABEL;

  return (
    <div className={styles.pickerWrap} ref={wrapRef}>
      <button
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={`Model for ${categoryLabel}: ${buttonLabel}`}
        className={styles.pickerButton}
        data-active={value ? "true" : "false"}
        disabled={!hasModels}
        onClick={() => setOpen((current) => !current)}
        title={hasModels ? buttonLabel : "No Hermes models are available to route to yet."}
        type="button"
      >
        <span className={styles.pickerButtonText}>{hasModels ? buttonLabel : "No models available"}</span>
        <ChevronDown size={13} aria-hidden="true" />
      </button>
      {open ? (
        <div className={styles.pickerMenu} role="listbox" aria-label={`Choose a model for ${categoryLabel}`}>
          <div className={styles.pickerSearch}>
            <Search size={14} aria-hidden="true" />
            <input
              ref={searchRef}
              aria-label="Search models"
              onChange={(event) => setQuery(event.currentTarget.value)}
              placeholder="Search models"
              value={query}
            />
          </div>
          <div className={styles.pickerScroll}>
            <button
              className={styles.pickerOption}
              onClick={() => select(null)}
              role="option"
              aria-selected={value === null}
              type="button"
            >
              <span className={styles.pickerOptionText}>
                <span className={styles.pickerOptionLabel}>{AUTO_LABEL}</span>
                <span className={styles.pickerOptionMeta}>Inherit the Composer’s selected model</span>
              </span>
              {value === null ? <Check size={14} aria-hidden="true" /> : null}
            </button>
            <div className={styles.pickerDivider} />
            <PickerSection
              models={groups.hermes}
              onSelect={select}
              selectedId={value?.catalogModelId ?? null}
              title="Hermes Configured"
            />
            {groups.openRouter.length > 0 ? (
              <PickerSection
                models={groups.openRouter}
                onSelect={select}
                selectedId={value?.catalogModelId ?? null}
                title="OpenRouter"
              />
            ) : null}
            {groups.hermes.length === 0 && groups.openRouter.length === 0 ? (
              <div className={styles.pickerEmpty}>No matching models</div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function PickerSection({
  models,
  onSelect,
  selectedId,
  title
}: {
  models: HermesModelDescriptor[];
  onSelect: (selection: ModelRoutingSelection) => void;
  selectedId: string | null;
  title: string;
}) {
  if (models.length === 0) {
    return null;
  }

  return (
    <>
      <div className={styles.pickerSectionTitle}>{title}</div>
      {models.map((model) => {
        const notLoaded = model.availability === "not-loaded";
        const isSelected = model.id === selectedId;
        return (
          <button
            aria-selected={isSelected}
            className={styles.pickerOption}
            disabled={notLoaded}
            key={`${model.catalogSource ?? "model"}:${model.id}`}
            onClick={() =>
              onSelect({ catalogModelId: model.id, label: model.label, provider: model.provider ?? null })
            }
            role="option"
            type="button"
          >
            <span className={styles.pickerOptionText}>
              <span className={styles.pickerOptionLabel}>{model.label}</span>
              <span className={styles.pickerOptionMeta}>{modelMeta(model, notLoaded)}</span>
            </span>
            {isSelected ? <Check size={14} aria-hidden="true" /> : null}
          </button>
        );
      })}
    </>
  );
}

function groupModels(models: HermesModelDescriptor[], query: string) {
  const clean = query.trim().toLowerCase();
  const matches = (model: HermesModelDescriptor) => {
    if (!clean) {
      return true;
    }
    return [model.label, model.id, model.provider].filter(Boolean).join(" ").toLowerCase().includes(clean);
  };

  return {
    hermes: models.filter((model) => model.catalogSource !== "ui-openrouter" && matches(model)),
    openRouter: models.filter((model) => model.catalogSource === "ui-openrouter" && matches(model))
  };
}

function modelMeta(model: HermesModelDescriptor, notLoaded: boolean) {
  if (notLoaded) {
    return "Not loaded in LM Studio";
  }
  const parts = [model.provider ?? "Provider inherited"];
  if (model.contextLength) {
    parts.push(formatContextLength(model.contextLength));
  }
  return parts.join(" · ");
}

function formatContextLength(value: number) {
  if (value >= 1_000_000) {
    return `${Math.round(value / 1_000_000)}M context`;
  }
  if (value >= 1_000) {
    return `${Math.round(value / 1_000)}K context`;
  }
  return `${value} context`;
}
