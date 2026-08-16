import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => readFileSync(resolve(root, relativePath), "utf8");
const { splitLogTimestamp } = await import(
  pathToFileURL(resolve(root, "apps/web/src/lib/logPresentation.ts")).href
);

assert.deepEqual(splitLogTimestamp("2026-08-15 17:25:26,662 INFO gateway ready"), {
  timestamp: "2026-08-15 17:25:26,662",
  separator: " ",
  message: "INFO gateway ready"
});
assert.deepEqual(splitLogTimestamp("2026-08-15T17:25:26.662Z ERROR failed"), {
  timestamp: "2026-08-15T17:25:26.662Z",
  separator: " ",
  message: "ERROR failed"
});
assert.deepEqual(splitLogTimestamp("[17:25:26,662] WARN waiting"), {
  timestamp: "[17:25:26,662]",
  separator: " ",
  message: "WARN waiting"
});
assert.equal(splitLogTimestamp("INFO no leading timestamp"), null);

const appShell = read("apps/web/src/components/shell/AppShell.tsx");
const splitPane = read("apps/web/src/components/shell/SplitPane.tsx");
const logsView = read("apps/web/src/components/logs/LogsView.tsx");
const logsStyles = read("apps/web/src/components/logs/LogsView.module.css");
const messageStyles = read("apps/web/src/components/chat/MessageBubble.module.css");

assert.match(appShell, /function openLogsSideView\(\)/);
assert.match(appShell, /onOpenSideView=\{openLogsSideView\}/);
assert.match(splitPane, /RightPaneMode = [^;]*"logs"/);
assert.match(splitPane, /<LogsView hermesStatus=\{hermesStatus\} onClose=\{onCloseLogs\} variant="side"/);
assert.match(logsView, /Copy visible logs/);
assert.match(logsView, /filteredLines\.map/);
assert.match(logsView, /navigator\.clipboard\?\.writeText/);
assert.match(logsView, /document\.execCommand\("copy"\)/);
assert.match(logsView, /className=\{styles\.timestamp\}/);
assert.match(logsStyles, /white-space:\s*pre-wrap/);
assert.match(logsStyles, /overflow-wrap:\s*anywhere/);
assert.match(logsStyles, /overflow-x:\s*hidden/);
assert.match(messageStyles, /border-radius:\s*12\.8px 12\.8px 3px 12\.8px/);

console.log("Side-pane logs and chat-bubble presentation: 17 checks passed.");
