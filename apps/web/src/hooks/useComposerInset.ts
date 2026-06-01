"use client";

import { useLayoutEffect, useState } from "react";
import type { RefObject } from "react";

const DEFAULT_INSET_PX = 168;
const INSET_SAFE_GAP_PX = 20;

export function useComposerInset(composerWrapRef: RefObject<HTMLElement | null>, enabled: boolean) {
  const [insetPx, setInsetPx] = useState(DEFAULT_INSET_PX);

  useLayoutEffect(() => {
    const node = composerWrapRef.current;
    if (!enabled || !node) {
      setInsetPx(DEFAULT_INSET_PX);
      return;
    }

    const measure = () => {
      setInsetPx(Math.ceil(node.getBoundingClientRect().height) + INSET_SAFE_GAP_PX);
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    window.addEventListener("resize", measure);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [composerWrapRef, enabled]);

  return insetPx;
}
