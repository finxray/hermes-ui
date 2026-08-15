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

const chatPaneTabsSource = await readFile("apps/web/src/components/chat/ChatPaneTabs.tsx", "utf8");
const chatPaneTabsStyles = await readFile("apps/web/src/components/chat/ChatPaneTabs.module.css", "utf8");
const globalStyles = await readFile("apps/web/src/app/globals.css", "utf8");
assert.match(chatPaneTabsSource, /data-active=\{active \? "true" : "false"\}/);
assert.doesNotMatch(chatPaneTabsSource, /data-has-background/);
assert.match(
  chatPaneTabsStyles,
  /\.tabWrap\[data-active="true"\] \.closeButton\s*\{\s*opacity:\s*1;/,
  "each pane's active tab must keep its close control visible"
);
assert.match(
  chatPaneTabsStyles,
  /\.tabWrap\[data-active="true"\] \.moreButton[\s\S]*?opacity:\s*1;/,
  "each pane's active tab must keep its actions control visible"
);
assert.match(
  chatPaneTabsStyles,
  /\.viewport > \.tabSequence:only-child \.tabWrap\s*\{\s*background:\s*transparent;/,
  "a pane containing one tab must keep the resting tab background transparent"
);
assert.match(
  chatPaneTabsStyles,
  /\.viewport > \.tabSequence:only-child \.tabWrap:hover,[\s\S]*?background:\s*var\(--bg-control-hover\);/,
  "a pane containing one tab must restore its background on hover"
);
assert.match(
  globalStyles,
  /\*::-webkit-scrollbar-button\s*\{[\s\S]*?-webkit-appearance:\s*none;/,
  "custom scrollbar buttons must bypass native macOS appearance"
);
assert.equal(
  globalStyles.match(/rgba\(180%2C%20176%2C%20183%2C%200\.62\)/g)?.length,
  4,
  "all four scrollbar arrow directions must use the visible high-contrast treatment"
);

console.log("chat tab state checks passed");
