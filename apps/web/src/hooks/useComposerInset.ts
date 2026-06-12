"use client";

import { useLayoutEffect, useState } from "react";
import type { RefObject } from "react";

const DEFAULT_CLEARANCE_PX = 198;
const COMPOSER_CONTENT_GAP_PX = 50;

export function useComposerInset(
  scrollViewportRef: RefObject<HTMLElement | null>,
  composerWrapRef: RefObject<HTMLElement | null>,
  enabled: boolean
) {
  const [clearancePx, setClearancePx] = useState(DEFAULT_CLEARANCE_PX);

  useLayoutEffect(() => {
    const scrollViewport = scrollViewportRef.current;
    const anchor = composerWrapRef.current;

    if (!enabled || !scrollViewport || !anchor) {
      setClearancePx(DEFAULT_CLEARANCE_PX);
      return;
    }

    const measure = () => {
      const anchorRect = anchor.getBoundingClientRect();
      setClearancePx(Math.ceil(anchorRect.height + COMPOSER_CONTENT_GAP_PX));
    };

    const scheduleMeasure = () => {
      measure();
      window.requestAnimationFrame(measure);
    };

    scheduleMeasure();
    const observer = new ResizeObserver(scheduleMeasure);
    observer.observe(anchor);
    const composerBox = anchor.querySelector<HTMLElement>("[data-composer-box]");
    if (composerBox) {
      observer.observe(composerBox);
    }
    window.addEventListener("resize", scheduleMeasure);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", scheduleMeasure);
    };
  }, [composerWrapRef, enabled, scrollViewportRef]);

  return clearancePx;
}
