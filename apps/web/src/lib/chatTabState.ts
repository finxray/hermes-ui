export function appendUniqueTab(ids: string[], sessionId: string) {
  return ids.includes(sessionId) ? ids : [...ids, sessionId];
}

export function insertUniqueTab(ids: string[], sessionId: string, targetIndex: number) {
  const withoutSession = ids.filter((id) => id !== sessionId);
  const index = Math.max(0, Math.min(targetIndex, withoutSession.length));
  return [...withoutSession.slice(0, index), sessionId, ...withoutSession.slice(index)];
}

export function reorderTab(ids: string[], sessionId: string, targetIndex: number) {
  const sourceIndex = ids.indexOf(sessionId);
  if (sourceIndex < 0) {
    return ids;
  }
  const adjustedIndex = sourceIndex < targetIndex ? targetIndex - 1 : targetIndex;
  return insertUniqueTab(ids, sessionId, adjustedIndex);
}

export function selectSidebarTab(ids: string[], activeId: string | null, sessionId: string) {
  if (ids.includes(sessionId)) {
    return ids;
  }

  if (ids.length === 0) {
    return [sessionId];
  }

  const activeIndex = activeId ? ids.indexOf(activeId) : -1;
  const replacementIndex = activeIndex >= 0 ? activeIndex : ids.length - 1;

  return ids.map((id, index) => (index === replacementIndex ? sessionId : id));
}

export function resolveSidebarTargetPane(
  mainIds: string[],
  sideIds: string[],
  focusedPane: "main" | "side",
  sessionId: string
) {
  if (sideIds.includes(sessionId)) {
    return "side" as const;
  }
  if (mainIds.includes(sessionId)) {
    return "main" as const;
  }
  return focusedPane;
}

export function resolveSidebarAddTargetPane({
  focusedPane,
  sideChatIsVisible,
  singlePane
}: {
  focusedPane: "main" | "side";
  sideChatIsVisible: boolean;
  singlePane: "main" | "side" | null;
}) {
  if (singlePane) {
    return singlePane;
  }
  return sideChatIsVisible ? focusedPane : "main";
}

export function resolveSidebarSelectedSessionIds({
  activeSessionId,
  sideChatIsVisible,
  sideSessionId,
  singlePane
}: {
  activeSessionId: string | null | undefined;
  sideChatIsVisible: boolean;
  sideSessionId: string | null | undefined;
  singlePane: "main" | "side" | null;
}) {
  const ids = singlePane === "side"
    ? [sideSessionId]
    : singlePane === "main" || !sideChatIsVisible
      ? [activeSessionId]
      : [activeSessionId, sideSessionId];

  return Array.from(new Set(ids.filter((id): id is string => Boolean(id))));
}
