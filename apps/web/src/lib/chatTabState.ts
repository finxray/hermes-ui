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

  const activeIndex = activeId ? ids.indexOf(activeId) : -1;
  if (activeIndex < 0) {
    return appendUniqueTab(ids, sessionId);
  }

  return ids.map((id, index) => (index === activeIndex ? sessionId : id));
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
