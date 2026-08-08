import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";

const {
  appendUniqueTab,
  insertUniqueTab,
  reorderTab,
  resolveSidebarTargetPane,
  selectSidebarTab
} = await import(pathToFileURL("apps/web/src/lib/chatTabState.ts").toString());

assert.deepEqual(appendUniqueTab(["a", "b"], "b"), ["a", "b"]);
assert.deepEqual(appendUniqueTab(["a", "b"], "c"), ["a", "b", "c"]);

const existingTabs = ["a", "b", "c"];
assert.equal(selectSidebarTab(existingTabs, "b", "a"), existingTabs);
assert.equal(selectSidebarTab(existingTabs, "b", "b"), existingTabs);
assert.deepEqual(selectSidebarTab(["a", "b", "c"], "b", "d"), ["a", "d", "c"]);
assert.deepEqual(selectSidebarTab([], null, "a"), ["a"]);

assert.equal(resolveSidebarTargetPane(["left"], ["right"], "main", "left"), "main");
assert.equal(resolveSidebarTargetPane(["left"], ["right"], "main", "right"), "side");
assert.equal(resolveSidebarTargetPane(["left"], ["right"], "main", "new"), "main");
assert.equal(resolveSidebarTargetPane(["left"], ["right"], "side", "new"), "side");

assert.deepEqual(insertUniqueTab(["a", "b", "c"], "a", 2), ["b", "c", "a"]);
assert.deepEqual(reorderTab(["a", "b", "c"], "a", 2), ["b", "a", "c"]);

console.log("chat tab state checks passed");
