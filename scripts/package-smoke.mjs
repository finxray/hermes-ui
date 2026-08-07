#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import appPackage from "../package.json" with { type: "json" };

const root = resolve(process.cwd());
const bundle = join(
  root,
  "artifacts",
  "release",
  `stoix-${appPackage.version}-${process.platform}-${process.arch}`
);
const runtime = join(bundle, "runtime", process.platform === "win32" ? "node.exe" : "node");
const launcher = join(bundle, "launcher", "stoix-launcher.cjs");
const smokeConfig = join(root, "artifacts", "release", ".smoke-config.env");

if (!existsSync(runtime) || !existsSync(launcher)) {
  throw new Error("Packaged runtime is missing. Run node scripts/package-release.mjs first.");
}

try {
  execFileSync(
    runtime,
    [launcher, "--smoke", "--port=32910", `--config=${smokeConfig}`],
    { cwd: bundle, stdio: "inherit", timeout: 60_000 }
  );
} finally {
  rmSync(smokeConfig, { force: true });
}

console.log("Portable Stoix package smoke passed.");
