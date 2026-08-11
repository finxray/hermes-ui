import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const {
  appendUniqueTab,
  insertUniqueTab,
  reorderTab,
  resolveSidebarAddTargetPane,
  resolveSidebarSelectedSessionIds,
  resolveSidebarTargetPane,
  selectSidebarTab
} = await import(pathToFileURL("apps/web/src/lib/chatTabState.ts").toString());

assert.deepEqual(appendUniqueTab(["a", "b"], "b"), ["a", "b"]);
assert.deepEqual(appendUniqueTab(["a", "b"], "c"), ["a", "b", "c"]);

const existingTabs = ["a", "b", "c"];
assert.equal(selectSidebarTab(existingTabs, "b", "a"), existingTabs);
assert.equal(selectSidebarTab(existingTabs, "b", "b"), existingTabs);
assert.deepEqual(selectSidebarTab(["a", "b", "c"], "b", "d"), ["a", "d", "c"]);
assert.deepEqual(selectSidebarTab(["a", "b", "c"], null, "d"), ["a", "b", "d"]);
assert.deepEqual(selectSidebarTab(["a", "b", "c"], "missing", "d"), ["a", "b", "d"]);
assert.deepEqual(selectSidebarTab([], null, "a"), ["a"]);

let sidebarTabs = ["a", "b", "c"];
sidebarTabs = selectSidebarTab(sidebarTabs, "b", "d");
sidebarTabs = selectSidebarTab(sidebarTabs, "d", "e");
sidebarTabs = selectSidebarTab(sidebarTabs, "e", "f");
assert.deepEqual(sidebarTabs, ["a", "f", "c"]);
assert.equal(sidebarTabs.length, 3);

assert.equal(resolveSidebarTargetPane(["left"], ["right"], "main", "left"), "main");
assert.equal(resolveSidebarTargetPane(["left"], ["right"], "main", "right"), "side");
assert.equal(resolveSidebarTargetPane(["left"], ["right"], "main", "new"), "main");
assert.equal(resolveSidebarTargetPane(["left"], ["right"], "side", "new"), "side");

assert.equal(resolveSidebarAddTargetPane({
  focusedPane: "side",
  sideChatIsVisible: false,
  singlePane: null
}), "main");
assert.equal(resolveSidebarAddTargetPane({
  focusedPane: "side",
  sideChatIsVisible: true,
  singlePane: null
}), "side");
assert.equal(resolveSidebarAddTargetPane({
  focusedPane: "main",
  sideChatIsVisible: true,
  singlePane: null
}), "main");
assert.equal(resolveSidebarAddTargetPane({
  focusedPane: "main",
  sideChatIsVisible: true,
  singlePane: "side"
}), "side");

assert.deepEqual(resolveSidebarSelectedSessionIds({
  activeSessionId: "main",
  sideChatIsVisible: true,
  sideSessionId: "side",
  singlePane: null
}), ["main", "side"]);
assert.deepEqual(resolveSidebarSelectedSessionIds({
  activeSessionId: "main",
  sideChatIsVisible: true,
  sideSessionId: "side",
  singlePane: "main"
}), ["main"]);
assert.deepEqual(resolveSidebarSelectedSessionIds({
  activeSessionId: "main",
  sideChatIsVisible: true,
  sideSessionId: "side",
  singlePane: "side"
}), ["side"]);
assert.deepEqual(resolveSidebarSelectedSessionIds({
  activeSessionId: "main",
  sideChatIsVisible: false,
  sideSessionId: "side",
  singlePane: null
}), ["main"]);

assert.deepEqual(insertUniqueTab(["a", "b", "c"], "a", 2), ["b", "c", "a"]);
assert.deepEqual(reorderTab(["a", "b", "c"], "a", 2), ["b", "a", "c"]);

const chatViewSource = await readFile("apps/web/src/components/chat/ChatView.tsx", "utf8");
assert.match(chatViewSource, /onFocusCapture=\{onActivate\}/);
assert.match(chatViewSource, /onPointerDownCapture=\{onActivate\}/);
assert.doesNotMatch(chatViewSource, /onPointerEnter=\{onActivate\}/);

console.log("chat tab state checks passed");
