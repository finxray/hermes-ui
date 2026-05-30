#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";

const root = resolve(process.cwd());
const componentPath = resolve(root, "apps/web/src/components/chat/AgentActivityBlock.tsx");
const composerPath = resolve(root, "apps/web/src/components/chat/Composer.tsx");
const cssPath = resolve(root, "apps/web/src/components/chat/AgentActivityBlock.module.css");
const chatViewPath = resolve(root, "apps/web/src/components/chat/ChatView.tsx");
const helperPath = resolve(root, "apps/web/src/lib/agentActivityEvents.ts");
const checks = [];

checkFilesExist();
checkComponentSource();
await checkHelperBehavior();

const failed = checks.filter((check) => !check.ok);
for (const check of checks) {
  console.log(`${check.ok ? "[ok]" : "[!!]"} ${check.name}: ${check.message}`);
}

if (failed.length > 0) {
  console.error("");
  console.error(`Agent activity rendering checks failed: ${failed.length}`);
  process.exit(1);
}

console.log("");
console.log(`Agent activity rendering checks passed: ${checks.length}`);

function checkFilesExist() {
  record("component-exists", existsSync(componentPath), "AgentActivityBlock component file exists.");
  record("composer-exists", existsSync(composerPath), "Composer component file exists.");
  record("css-exists", existsSync(cssPath), "AgentActivityBlock CSS module exists.");
}

function checkComponentSource() {
  if (!existsSync(componentPath) || !existsSync(cssPath)) {
    return;
  }
  const component = readFileSync(componentPath, "utf8");
  const composer = readFileSync(composerPath, "utf8");
  const css = readFileSync(cssPath, "utf8");

  record(
    "collapsed-details",
    component.includes("<details") && component.includes("<summary") && !component.includes("open={"),
    "Activity blocks use native details/summary and stay collapsed by default."
  );
  record(
    "thinking-row",
    component.includes("Thinking...") && css.includes("activityShimmer"),
    "Thinking/running row has a generic label and shimmer styling."
  );
  record(
    "no-private-reasoning-labels",
    !component.includes("chain-of-thought") &&
      !component.includes("private reasoning") &&
      !component.includes("reasoning summary"),
    "Activity block source does not render private reasoning or chain-of-thought labels."
  );
  record(
    "specific-running-suppresses-generic-thinking",
    existsSync(chatViewPath) &&
      readFileSync(chatViewPath, "utf8").includes("!hasRunningActivity") &&
      readFileSync(chatViewPath, "utf8").includes("makeElapsedActivityEvent") &&
      readFileSync(chatViewPath, "utf8").includes("makeStoppedActivityEvent"),
    "Chat view lets specific running activity replace generic Thinking and appends elapsed/stopped markers."
  );
  record(
    "stop-button-accessibility",
    composer.includes("Stop generation") &&
      composer.includes('type={isGenerating ? "button" : "submit"}') &&
      composer.includes("onStop?.()"),
    "Composer exposes an enabled stop-generation button during active streaming."
  );
  record(
    "metadata-rendering",
    component.includes("projectKey") && component.includes("sessionKey") && component.includes("safeJson"),
    "Component renders scope metadata and compact JSON details."
  );
  record(
    "status-styling",
      css.includes('data-status="running"') &&
      css.includes('data-status="failed"') &&
      css.includes('data-status="completed"') &&
      css.includes('data-status="cancelled"'),
    "CSS includes running, failed, completed, and cancelled status states."
  );
  record(
    "no-dangerous-html",
    !component.includes("dangerouslySetInnerHTML"),
    "Activity details are rendered without dangerouslySetInnerHTML."
  );
}

async function checkHelperBehavior() {
  const activity = await importHelperModule();
  record(
    "duration-format",
    activity.formatActivityDuration(500) === "<1s" &&
      activity.formatActivityDuration(73_000) === "1m 13s" &&
      activity.formatActivityDuration(3_723_000) === "1h 2m 3s",
    "Duration formatter supports subsecond, minute, and hour Worked for style labels."
  );

  const event = activity.createActivityEventFromHermesToolEvent({
    type: "tool_event",
    name: "memory_search",
    status: "completed",
    payload: {
      Authorization: "Bearer abc123",
      preview: "Bearer abc123",
      project_key: "project-a",
      session_key: "session-a"
    }
  }, { id: "render-redaction" });

  const serialized = JSON.stringify(event);
  record(
    "redacted-details",
    event.summary === "Bearer [redacted]" &&
      serialized.includes("[redacted]") &&
      !serialized.includes("abc123"),
    "Rendered activity inputs keep secret-like values redacted."
  );
}

async function importHelperModule() {
  const source = readFileSync(helperPath, "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
      verbatimModuleSyntax: false
    },
    fileName: helperPath
  });

  const moduleUrl = `data:text/javascript;base64,${Buffer.from(compiled.outputText).toString("base64")}`;
  return import(moduleUrl);
}

function record(name, ok, message) {
  checks.push({ message, name, ok });
}
