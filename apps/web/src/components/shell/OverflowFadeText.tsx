"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

export function OverflowFadeText({
  children,
  className,
  id
}: {
  children: ReactNode;
  className: string;
  id?: string;
}) {
  const elementRef = useRef<HTMLSpanElement>(null);
  const [isOverflowing, setIsOverflowing] = useState(false);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) {
      return;
    }

    const measure = () => {
      setIsOverflowing(element.scrollWidth > element.clientWidth + 1);
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [children]);

  return (
    <span
      ref={elementRef}
      className={className}
      data-overflow={isOverflowing ? "true" : "false"}
      id={id}
    >
      {children}
    </span>
  );
}
