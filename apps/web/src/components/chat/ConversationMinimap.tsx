"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type RefObject
} from "react";
import type { ChatMessage } from "@/data/types";
import styles from "./ConversationMinimap.module.css";

const MAX_VISIBLE_TURNS = 24;
const MIN_VISIBLE_TURNS = 5;
const SCROLL_END_TOLERANCE_PX = 3;

type ConversationMinimapProps = {
  messages: ChatMessage[];
  scrollViewportRef: RefObject<HTMLDivElement | null>;
};

type ConversationTurn = {
  anchorMessageId: string;
  assistant: ChatMessage | null;
  index: number;
  user: ChatMessage | null;
};

type PointerGeometry = {
  firstCenter: number;
  lastCenter: number;
  markerCount: number;
};

export function ConversationMinimap({ messages, scrollViewportRef }: ConversationMinimapProps) {
  const turns = useMemo(() => groupConversationTurns(messages), [messages]);
  const visibleTurns = useMemo(() => sampleConversationTurns(turns, MAX_VISIBLE_TURNS), [turns]);
  const [activeTurnId, setActiveTurnId] = useState<string | null>(turns.at(-1)?.anchorMessageId ?? null);
  const [pointerPosition, setPointerPosition] = useState<number | null>(null);
  const [keyboardFocusIndex, setKeyboardFocusIndex] = useState<number | null>(null);
  const pointerFrameRef = useRef<number | null>(null);
  const pointerGeometryRef = useRef<PointerGeometry | null>(null);
  const pendingPointerPositionRef = useRef<number | null>(null);

  useEffect(() => {
    const viewport = scrollViewportRef.current;
    if (!viewport || turns.length < MIN_VISIBLE_TURNS) {
      setActiveTurnId(null);
      return;
    }

    let frame: number | null = null;

    const updateActiveTurn = () => {
      frame = null;
      if (isViewportAtEnd(viewport)) {
        const lastTurnId = turns.at(-1)?.anchorMessageId ?? null;
        setActiveTurnId((current) => current === lastTurnId ? current : lastTurnId);
        return;
      }

      const viewportRect = viewport.getBoundingClientRect();
      const readingLine = viewportRect.top + Math.min(180, viewport.clientHeight * 0.32);
      let nextTurnId = turns[0]?.anchorMessageId ?? null;

      for (const turn of turns) {
        const anchor = findMessageAnchor(viewport, turn.anchorMessageId);
        if (!anchor) {
          continue;
        }
        if (anchor.getBoundingClientRect().top <= readingLine) {
          nextTurnId = turn.anchorMessageId;
        } else {
          break;
        }
      }

      setActiveTurnId((current) => current === nextTurnId ? current : nextTurnId);
    };

    const scheduleUpdate = () => {
      if (frame === null) {
        frame = window.requestAnimationFrame(updateActiveTurn);
      }
    };

    scheduleUpdate();
    viewport.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", scheduleUpdate);

    const resizeObserver = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(scheduleUpdate);
    resizeObserver?.observe(viewport);

    return () => {
      viewport.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", scheduleUpdate);
      resizeObserver?.disconnect();
      if (frame !== null) {
        window.cancelAnimationFrame(frame);
      }
    };
  }, [scrollViewportRef, turns]);

  useEffect(() => () => {
    if (pointerFrameRef.current !== null) {
      window.cancelAnimationFrame(pointerFrameRef.current);
    }
  }, []);

  if (visibleTurns.length < MIN_VISIBLE_TURNS) {
    return null;
  }

  const activeVisibleTurn = resolveVisibleActiveTurn(visibleTurns, turns, activeTurnId);
  const focusPosition = pointerPosition ?? keyboardFocusIndex;
  const isPointerHovering = pointerPosition !== null;
  const compactMarkers = visibleTurns.length < 10;

  const updatePointerPosition = (event: ReactMouseEvent<HTMLDivElement>) => {
    const geometry = pointerGeometryRef.current ?? measurePointerGeometry(event.currentTarget);
    if (!geometry) {
      return;
    }
    pointerGeometryRef.current = geometry;

    const span = geometry.lastCenter - geometry.firstCenter;
    const position = span <= 0
      ? 0
      : ((event.clientY - geometry.firstCenter) / span) * (geometry.markerCount - 1);
    pendingPointerPositionRef.current = Math.max(0, Math.min(geometry.markerCount - 1, position));

    if (pointerFrameRef.current === null) {
      pointerFrameRef.current = window.requestAnimationFrame(() => {
        pointerFrameRef.current = null;
        setPointerPosition(pendingPointerPositionRef.current);
      });
    }
  };

  const clearPointerPosition = () => {
    if (pointerFrameRef.current !== null) {
      window.cancelAnimationFrame(pointerFrameRef.current);
      pointerFrameRef.current = null;
    }
    pointerGeometryRef.current = null;
    pendingPointerPositionRef.current = null;
    setPointerPosition(null);
  };

  const jumpToTurn = (turn: ConversationTurn) => {
    const viewport = scrollViewportRef.current;
    const anchor = viewport ? findMessageAnchor(viewport, turn.anchorMessageId) : null;
    if (!viewport || !anchor) {
      return;
    }

    const viewportRect = viewport.getBoundingClientRect();
    const anchorRect = anchor.getBoundingClientRect();
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    viewport.scrollTo({
      behavior: prefersReducedMotion ? "auto" : "smooth",
      top: Math.max(0, viewport.scrollTop + anchorRect.top - viewportRect.top - 96)
    });
    setActiveTurnId(turn.anchorMessageId);
  };

  return (
    <nav className={styles.minimap} aria-label="Conversation overview">
      <div
        className={styles.markers}
        data-pointer-active={pointerPosition !== null ? "true" : "false"}
        onMouseLeave={clearPointerPosition}
        onMouseMove={updatePointerPosition}
      >
        {visibleTurns.map((turn, visibleIndex) => {
          const title = previewTitle(turn);
          const body = previewBody(turn);
          const isActive = !isPointerHovering && turn.anchorMessageId === activeVisibleTurn?.anchorMessageId;
          const isFocused = focusPosition !== null && Math.round(focusPosition) === visibleIndex;
          const markerStyle = {
            "--conversation-marker-width": `${focusPosition === null ? 6.8 : focusedMarkerWidth(
              Math.abs(visibleIndex - focusPosition),
              visibleTurns.length,
              compactMarkers
            )}px`
          } as CSSProperties;

          return (
            <div className={`${styles.markerWrap} ${isFocused ? styles.markerFocused : ""}`} key={turn.anchorMessageId}>
              <button
                aria-current={isActive ? "location" : undefined}
                aria-label={`Jump to exchange ${turn.index + 1}: ${title}`}
                className={styles.markerButton}
                onBlur={() => setKeyboardFocusIndex(null)}
                onClick={() => jumpToTurn(turn)}
                onFocus={() => setKeyboardFocusIndex(visibleIndex)}
                style={markerStyle}
                type="button"
              >
                <span className={styles.markerLine} aria-hidden="true" />
              </button>
              <span className={styles.preview} role="tooltip">
                <strong>{title}</strong>
                <span>{body}</span>
              </span>
            </div>
          );
        })}
      </div>
    </nav>
  );
}

function isViewportAtEnd(viewport: HTMLElement) {
  const remainingScroll = viewport.scrollHeight - viewport.clientHeight - viewport.scrollTop;
  return remainingScroll <= SCROLL_END_TOLERANCE_PX;
}

function measurePointerGeometry(container: HTMLDivElement): PointerGeometry | null {
  const buttons = Array.from(container.querySelectorAll<HTMLButtonElement>("button"));
  const first = buttons[0];
  const last = buttons.at(-1);
  if (!first || !last) {
    return null;
  }

  const firstRect = first.getBoundingClientRect();
  const lastRect = last.getBoundingClientRect();
  return {
    firstCenter: firstRect.top + firstRect.height / 2,
    lastCenter: lastRect.top + lastRect.height / 2,
    markerCount: buttons.length
  };
}

function focusedMarkerWidth(distance: number, markerCount: number, compact: boolean) {
  const baseWidth = compact ? 5.2 : 6.8;
  const expansion = compact ? 15.6 : 20.4;
  const spread = Math.max(1.8, Math.min(4, markerCount * 0.16));
  const width = baseWidth + expansion * Math.exp(-(distance ** 2) / (2 * spread ** 2));
  return Math.round(width * 10) / 10;
}

function groupConversationTurns(messages: ChatMessage[]) {
  const turns: ConversationTurn[] = [];

  for (const message of messages) {
    if (message.role === "user") {
      turns.push({
        anchorMessageId: message.id,
        assistant: null,
        index: turns.length,
        user: message
      });
      continue;
    }

    const currentTurn = turns.at(-1);
    if (currentTurn && currentTurn.assistant === null) {
      currentTurn.assistant = message;
      continue;
    }

    turns.push({
      anchorMessageId: message.id,
      assistant: message,
      index: turns.length,
      user: null
    });
  }

  return turns;
}

function sampleConversationTurns(turns: ConversationTurn[], limit: number) {
  if (turns.length <= limit) {
    return turns;
  }

  const sampled: ConversationTurn[] = [];
  const step = (turns.length - 1) / (limit - 1);
  let previousIndex = -1;

  for (let slot = 0; slot < limit; slot += 1) {
    const index = Math.min(turns.length - 1, Math.round(slot * step));
    if (index !== previousIndex) {
      sampled.push(turns[index]);
      previousIndex = index;
    }
  }

  return sampled;
}

function resolveVisibleActiveTurn(
  visibleTurns: ConversationTurn[],
  turns: ConversationTurn[],
  activeTurnId: string | null
) {
  if (visibleTurns.length === 0) {
    return null;
  }

  const activeIndex = turns.findIndex((turn) => turn.anchorMessageId === activeTurnId);
  if (activeIndex < 0) {
    return visibleTurns[0];
  }

  let nearest = visibleTurns[0];
  for (const turn of visibleTurns) {
    if (turn.index > activeIndex) {
      break;
    }
    nearest = turn;
  }
  return nearest;
}

function findMessageAnchor(viewport: HTMLElement, messageId: string) {
  const escapedId = typeof CSS !== "undefined" && CSS.escape ? CSS.escape(messageId) : messageId.replace(/["\\]/g, "\\$&");
  return viewport.querySelector<HTMLElement>(`[data-chat-message-id="${escapedId}"]`);
}

function previewTitle(turn: ConversationTurn) {
  const fallback = turn.user?.attachments?.[0]?.fileName ?? "Hermes response";
  return compactText(turn.user?.content || fallback, 92);
}

function previewBody(turn: ConversationTurn) {
  if (turn.assistant?.content) {
    return compactText(turn.assistant.content, 260);
  }
  if (turn.assistant?.status === "streaming") {
    return "Hermes is responding…";
  }
  return "No assistant response in this exchange.";
}

function compactText(value: string, maxLength: number) {
  const compact = value.replace(/\s+/g, " ").trim();
  if (compact.length <= maxLength) {
    return compact;
  }
  return `${compact.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}
