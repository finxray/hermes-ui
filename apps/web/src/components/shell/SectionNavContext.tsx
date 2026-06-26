"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";

export type SectionCategory = {
  id: string;
  label: string;
  count: number;
};

type ScrollRequest = { id: string; nonce: number };

type Published = { section: string; categories: SectionCategory[] };
type PublishedLabel = { section: string; label: string };

type SectionNavValue = {
  /** Category currently scrolled into view (drives rail highlight). */
  activeCategoryId: string | null;
  /** Categories published by the view owning `section`, else an empty list. */
  categoriesForSection: (section: string) => SectionCategory[];
  /** True once a view has published categories, even when the list is empty. */
  hasPublishedCategories: (section: string) => boolean;
  /** Optional label published by the active view for the sidebar page marker. */
  labelForSection: (section: string) => string | null;
  /** Called by the active view to publish its category list to the rail. */
  publishCategories: (section: string, categories: SectionCategory[]) => void;
  /** Called by the active view to publish the label shown above its rail. */
  publishSectionLabel: (section: string, label: string) => void;
  /** Called by a scroll-spy in the active view to highlight the rail. */
  setActiveCategoryId: (id: string | null) => void;
  /** Called by the rail to ask the active view to scroll a category into view. */
  requestScroll: (id: string) => void;
  /** Observed by the active view; bumps when the rail requests a scroll. */
  scrollRequest: ScrollRequest | null;
};

const SectionNavContext = createContext<SectionNavValue | null>(null);

export function SectionNavProvider({ children }: { children: ReactNode }) {
  const [published, setPublished] = useState<Published>({ section: "", categories: [] });
  const [publishedLabel, setPublishedLabel] = useState<PublishedLabel>({ section: "", label: "" });
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [scrollRequest, setScrollRequest] = useState<ScrollRequest | null>(null);
  const nonceRef = useRef(0);
  const signatureRef = useRef("");

  const publishCategories = useCallback((section: string, next: SectionCategory[]) => {
    // Avoid re-render loops: only update when the section + category set changes.
    const signature = `${section}::${next.map((category) => `${category.id}:${category.count}`).join("|")}`;
    if (signature === signatureRef.current) {
      return;
    }
    signatureRef.current = signature;
    setPublished({ section, categories: next });
  }, []);

  const categoriesForSection = useCallback(
    (section: string) => (published.section === section ? published.categories : []),
    [published]
  );

  const hasPublishedCategories = useCallback(
    (section: string) => published.section === section,
    [published.section]
  );

  const publishSectionLabel = useCallback((section: string, label: string) => {
    setPublishedLabel((current) =>
      current.section === section && current.label === label ? current : { section, label }
    );
  }, []);

  const labelForSection = useCallback(
    (section: string) => (publishedLabel.section === section ? publishedLabel.label : null),
    [publishedLabel]
  );

  const requestScroll = useCallback((id: string) => {
    nonceRef.current += 1;
    setActiveCategoryId(id);
    setScrollRequest({ id, nonce: nonceRef.current });
  }, []);

  const value = useMemo<SectionNavValue>(
    () => ({
      activeCategoryId,
      categoriesForSection,
      hasPublishedCategories,
      labelForSection,
      publishCategories,
      publishSectionLabel,
      setActiveCategoryId,
      requestScroll,
      scrollRequest
    }),
    [
      activeCategoryId,
      categoriesForSection,
      hasPublishedCategories,
      labelForSection,
      publishCategories,
      publishSectionLabel,
      requestScroll,
      scrollRequest
    ]
  );

  return <SectionNavContext.Provider value={value}>{children}</SectionNavContext.Provider>;
}

export function useSectionNav(): SectionNavValue {
  const value = useContext(SectionNavContext);
  if (!value) {
    throw new Error("useSectionNav must be used within a SectionNavProvider");
  }
  return value;
}
