#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";

const root = process.cwd();
const sourcePath = resolve(root, "apps/web/src/lib/appUpdate.ts");
const routePath = resolve(root, "apps/web/src/app/api/app-update/route.ts");
const settingsPath = resolve(root, "apps/web/src/components/settings/SettingsView.tsx");
const appShellPath = resolve(root, "apps/web/src/components/shell/AppShell.tsx");
const contextRailPath = resolve(root, "apps/web/src/components/shell/ContextRail.tsx");
const hookPath = resolve(root, "apps/web/src/hooks/useAppUpdate.ts");
const sidebarPath = resolve(root, "apps/web/src/components/shell/Sidebar.tsx");

const updateModule = await importTypeScriptModule(sourcePath);
const route = readFileSync(routePath, "utf8");
const settings = readFileSync(settingsPath, "utf8");
const appShell = readFileSync(appShellPath, "utf8");
const contextRail = readFileSync(contextRailPath, "utf8");
const hook = readFileSync(hookPath, "utf8");
const sidebar = readFileSync(sidebarPath, "utf8");

const manifest = {
  artifacts: [
    {
      arch: "x64",
      platform: "win32",
      sha256: "a".repeat(64),
      signature: "artifact-signature",
      url: "https://releases.example.test/hermes-ui-0.1.1-win32-x64.zip"
    }
  ],
  channel: "stable",
  notes: ["A production fix"],
  publishedAt: "2026-08-02T12:00:00Z",
  releaseUrl: "https://releases.example.test/v0.1.1",
  schemaVersion: 1,
  signature: "manifest-signature",
  version: "0.1.1"
};

const parsed = updateModule.parseUpdateManifest(manifest);
assert(parsed, "valid signed manifest shape should parse");
assert.equal(updateModule.compareVersions("0.1.1", "0.1.0"), 1);
assert.equal(updateModule.compareVersions("0.1.0", "0.1.0"), 0);
assert.equal(updateModule.compareVersions("0.1.0", "0.1.1"), -1);
assert.equal(updateModule.compareVersions("0.2.0-beta.2", "0.2.0-beta.1"), 1);
assert.equal(updateModule.compareVersions("0.2.0", "0.2.0-beta.2"), 1);
assert.equal(updateModule.compareVersions("0.2.0-beta.1", "0.2.0"), -1);
assert.equal(updateModule.isUpdateCheckDue(null, 1_000), true);
assert.equal(updateModule.isUpdateCheckDue(1_000, 1_000 + updateModule.UPDATE_CHECK_INTERVAL_MS - 1), false);
assert.equal(updateModule.isUpdateCheckDue(1_000, 1_000 + updateModule.UPDATE_CHECK_INTERVAL_MS), true);
assert.equal(updateModule.selectUpdateArtifact(parsed, "win32", "x64")?.sha256, "a".repeat(64));
assert.equal(updateModule.selectUpdateArtifact(parsed, "darwin", "arm64"), null);
assert.equal(updateModule.parseUpdateManifest({ ...manifest, signature: "" }), null);
assert.equal(updateModule.parseUpdateManifest({ ...manifest, releaseUrl: "http://insecure.test" }), null);
assert.equal(updateModule.parseUpdateManifest({ ...manifest, version: "latest" }), null);

const githubRelease = {
  draft: false,
  html_url: "https://github.com/finxray/hermes-ui/releases/tag/v0.1.1",
  name: "Hermes UI 0.1.1",
  prerelease: false,
  published_at: "2026-08-02T12:00:00Z",
  tag_name: "v0.1.1"
};
assert.equal(updateModule.parseGitHubLatestRelease(githubRelease)?.version, "0.1.1");
assert.equal(updateModule.parseGitHubLatestRelease({ ...githubRelease, draft: true }), null);
assert.equal(updateModule.parseGitHubLatestRelease({ ...githubRelease, tag_name: "latest" }), null);
assert.equal(updateModule.parseGitHubLatestRelease({ ...githubRelease, html_url: "https://example.test/v0.1.1" }), null);

assert(route.includes("HERMES_UI_UPDATE_MANIFEST_URL"));
assert(route.includes("DEFAULT_GITHUB_RELEASE_API_URL"));
assert(route.includes("parseGitHubLatestRelease"));
assert(route.includes("response.status === 404"));
assert(route.includes('cache: "no-store"'));
assert(route.includes("AbortSignal.timeout"));
assert(route.includes("selectUpdateArtifact(manifest, process.platform, process.arch)"));
assert(!route.includes("exec("));
assert(!route.includes("spawn("));
assert(settings.includes("Review update"));
assert(settings.includes("Checked just now"));
assert(appShell.includes("useAppUpdate"));
assert(appShell.includes("hasUnseenUpdate={appUpdate.hasUnseenUpdate}"));
assert(hook.includes("UPDATE_CHECK_INTERVAL_MS"));
assert(hook.includes("window.setTimeout"));
assert(hook.includes("window.localStorage"));
assert(sidebar.includes("Software update available"));
assert(!contextRail.includes("BrainMemoryConsole"));
assert(!contextRail.includes("Show memory panel"));
assert(!contextRail.includes("Tenant / scope diagnostics"));
assert(!contextRail.includes("Retrieved memory"));

console.log("App update and minimal Console checks passed.");

async function importTypeScriptModule(path) {
  const source = readFileSync(path, "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
      verbatimModuleSyntax: false
    },
    fileName: path
  });
  const url = `data:text/javascript;base64,${Buffer.from(compiled.outputText).toString("base64")}`;
  return import(url);
}
