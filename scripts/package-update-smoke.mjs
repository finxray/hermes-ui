#!/usr/bin/env node

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const root = resolve(process.cwd());
const metadata = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const bundleName = `stoix-${metadata.version}-${process.platform}-${process.arch}`;
const sourceBundle = join(root, "artifacts", "release", bundleName);
assert(existsSync(join(sourceBundle, "VERSION.json")), "Build a native package before running the update smoke.");

const smokeRoot = mkdtempSync(join(tmpdir(), "stoix-update-smoke-"));
try {
  const installRoot = join(smokeRoot, "install");
  const oldBundle = join(installRoot, "versions", "0.0.0");
  const configRoot = join(smokeRoot, "config");
  const binRoot = join(smokeRoot, "custom-bin");
  mkdirSync(configRoot, { recursive: true });
  mkdirSync(binRoot, { recursive: true });
  cpSync(sourceBundle, oldBundle, { recursive: true });

  const oldMetadataPath = join(oldBundle, "VERSION.json");
  const oldMetadata = JSON.parse(readFileSync(oldMetadataPath, "utf8"));
  oldMetadata.version = "0.0.0";
  writeFileSync(oldMetadataPath, `${JSON.stringify(oldMetadata, null, 2)}\n`, "utf8");
  writeFileSync(join(installRoot, "bin-dir.txt"), `${binRoot}\n`, "utf8");

  const runtime = join(oldBundle, "runtime", process.platform === "win32" ? "node.exe" : "node");
  const launcher = join(oldBundle, "launcher", "stoix-launcher.cjs");
  const result = spawnSync(runtime, [launcher, "update", `--config=${join(configRoot, "config.env")}`], {
    cwd: smokeRoot,
    encoding: "utf8",
    env: {
      ...process.env,
      STOIX_NO_INTEGRATE: "true",
      STOIX_NO_LAUNCH: "true",
      STOIX_SKIP_HERMES: "true"
    },
    maxBuffer: 20 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"]
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  assert.ifError(result.error);
  assert.equal(result.status, 0, "stoix update must exit successfully");

  const currentVersion = readFileSync(join(installRoot, "current.txt"), "utf8").trim();
  assert.notEqual(currentVersion, "0.0.0", "the updater must switch away from the old version");
  assert.equal(readFileSync(join(installRoot, "bin-dir.txt"), "utf8").trim(), binRoot);
  assert(existsSync(join(installRoot, "versions", currentVersion, "updater", "install.ps1")));
  assert(existsSync(join(installRoot, "versions", currentVersion, "updater", "install.sh")));
  assert(existsSync(join(configRoot, "config.env")), "the updater must preserve the configuration root");
  console.log(`Cross-platform self-update smoke passed: 0.0.0 -> ${currentVersion}.`);
} finally {
  rmSync(smokeRoot, { force: true, recursive: true });
}
