#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";

const root = resolve(process.cwd());
const componentPath = resolve(root, "apps/web/src/components/chat/AgentActivityBlock.tsx");
const cssPath = resolve(root, "apps/web/src/components/chat/AgentActivityBlock.module.css");
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
  record("css-exists", existsSync(cssPath), "AgentActivityBlock CSS module exists.");
}

function checkComponentSource() {
  if (!existsSync(componentPath) || !existsSync(cssPath)) {
    return;
  }
  const component = readFileSync(componentPath, "utf8");
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
    "metadata-rendering",
    component.includes("projectKey") && component.includes("sessionKey") && component.includes("safeJson"),
    "Component renders scope metadata and compact JSON details."
  );
  record(
    "status-styling",
    css.includes('data-status="running"') &&
      css.includes('data-status="failed"') &&
      css.includes('data-status="completed"'),
    "CSS includes running, failed, and completed status states."
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
    activity.formatActivityDuration(73_000) === "1m 13s",
    "Duration formatter supports Worked for style labels."
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
