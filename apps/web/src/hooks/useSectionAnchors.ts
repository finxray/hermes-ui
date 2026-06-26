"use client";

import { useCallback, useEffect, useRef } from "react";
import { useSectionNav, type SectionCategory } from "@/components/shell/SectionNavContext";

/**
 * Wires a category-organised section view to the left rail:
 * - publishes its category list to the rail
 * - scrolls a category into view when the rail requests it
 * - reports the category currently in view (scroll-spy) so the rail highlights
 *
 * The view renders one wrapper element per category with
 * `ref={register(category.id)}` and `data-category-id={category.id}`.
 */
export function useSectionAnchors(section: string, categories: SectionCategory[]) {
  const { publishCategories, scrollRequest, setActiveCategoryId } = useSectionNav();
  const refs = useRef(new Map<string, HTMLElement>());

  const register = useCallback(
    (id: string) => (element: HTMLElement | null) => {
      if (element) {
        refs.current.set(id, element);
      } else {
        refs.current.delete(id);
      }
    },
    []
  );

  useEffect(() => {
    publishCategories(section, categories);
  }, [categories, publishCategories, section]);

  useEffect(() => {
    if (!scrollRequest) {
      return;
    }
    const element = refs.current.get(scrollRequest.id);
    element?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [scrollRequest]);

  useEffect(() => {
    if (categories.length === 0 || typeof IntersectionObserver === "undefined") {
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        const id = visible?.target.getAttribute("data-category-id");
        if (id) {
          setActiveCategoryId(id);
        }
      },
      { rootMargin: "-8% 0px -78% 0px", threshold: 0 }
    );
    refs.current.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [categories, setActiveCategoryId]);

  return register;
}
