#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(process.cwd());
const failures = [];
const forbiddenPaths = [
  "apps/web/src/app/api/brain-memory",
  "apps/web/src/app/api/tenant-scope",
  "apps/web/src/app/design",
  "apps/web/src/components/memory",
  "apps/web/src/lib/brainMemoryClient.ts",
  "apps/web/src/lib/memoryScopeBridge.ts",
  "apps/web/src/lib/storage/brain-memory-plugin-store.ts",
  "packages/brain-memory-client"
];

for (const path of forbiddenPaths) {
  if (containsFiles(join(root, path))) failures.push(`Core-only release still contains ${path}.`);
}

const webPackage = readJson("apps/web/package.json");
if (webPackage.dependencies?.["@hermes-ui/brain-memory-client"]) {
  failures.push("The Web UI still depends on @hermes-ui/brain-memory-client.");
}

for (const path of [".env.example", "env/web-ui-only.env.example", "env/web-ui-with-hermes.env.example"]) {
  const source = readText(path);
  if (/BRAIN_MEMORY_|HERMES_UI_ENABLE_MEMORY_SCOPE_BRIDGE/.test(source)) {
    failures.push(`${path} still configures embedded Brain Memory integration.`);
  }
}

const chatRoute = readText("apps/web/src/app/api/hermes/chat/stream/route.ts");
if (/buildMemoryScopeBridgeInstruction|ENABLE_MEMORY_SCOPE_BRIDGE/.test(chatRoute)) {
  failures.push("Hermes chat still injects the retired Brain Memory instruction bridge.");
}

const routeManifestPaths = [
  "apps/web/.next/server/app-paths-manifest.json",
  "apps/web/.next/server/app-path-routes-manifest.json"
];
for (const path of routeManifestPaths) {
  if (!existsSync(join(root, path))) continue;
  const manifest = readText(path);
  if (/\/api\/brain-memory|\/api\/tenant-scope|\/design\//.test(manifest)) {
    failures.push(`Production route manifest still contains a retired route: ${path}.`);
  }
}

if (failures.length > 0) {
  console.error("Core release boundary failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Core release boundary passed: Stoix 0.1 ships only the Hermes integration.");

function readText(path) {
  const absolute = join(root, path);
  return existsSync(absolute) ? readFileSync(absolute, "utf8") : "";
}

function readJson(path) {
  return JSON.parse(readText(path));
}

function containsFiles(path) {
  if (!existsSync(path)) return false;
  if (statSync(path).isFile()) return true;
  const entries = readdirSync(path, { withFileTypes: true });
  return entries.some((entry) =>
    entry.isFile() || (entry.isDirectory() && containsFiles(join(path, entry.name)))
  );
}
