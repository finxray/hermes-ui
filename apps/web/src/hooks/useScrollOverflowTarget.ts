"use client";

import { useEffect } from "react";
import type { RefObject } from "react";

function updateScrollOverflowState(element: HTMLElement) {
  const overflowY = element.scrollHeight > element.clientHeight + 1;
  const overflowX = element.scrollWidth > element.clientWidth + 1;
  const next = overflowY || overflowX ? "true" : "false";

  if (element.dataset.scrollable !== next) {
    element.dataset.scrollable = next;
  }
}

export function useScrollOverflowTarget(targetRef: RefObject<HTMLElement | null>, enabled = true) {
  useEffect(() => {
    const element = targetRef.current;
    if (!element) {
      return;
    }

    if (!enabled) {
      element.dataset.scrollable = "false";
      return;
    }

    let frame = 0;
    const scheduleUpdate = () => {
      if (frame !== 0) {
        return;
      }

      frame = window.requestAnimationFrame(() => {
        frame = 0;
        updateScrollOverflowState(element);
      });
    };

    scheduleUpdate();
    element.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", scheduleUpdate, { passive: true });

    const resizeObserver = new ResizeObserver(scheduleUpdate);
    resizeObserver.observe(element);

    // Track content changes only; do not observe attributes (writing data-scrollable
    // would retrigger attribute mutations and freeze the page).
    const mutationObserver = new MutationObserver(scheduleUpdate);
    mutationObserver.observe(element, { childList: true, subtree: true });

    return () => {
      if (frame !== 0) {
        window.cancelAnimationFrame(frame);
      }

      element.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", scheduleUpdate);
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      element.dataset.scrollable = "false";
    };
  }, [enabled, targetRef]);
}
