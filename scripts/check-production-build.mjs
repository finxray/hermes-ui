#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(process.cwd());
const required = [
  "apps/web/.next/standalone/apps/web/server.js",
  "apps/web/.next/static",
  "apps/web/public/assets/stoix-helmet-black.png",
  "apps/web/public/assets/stoix-helmet-white.png"
];
const failures = required
  .filter((path) => !existsSync(join(root, path)))
  .map((path) => `Missing production output: ${path}`);

const manifestPath = join(root, "apps/web/.next/server/app-paths-manifest.json");
if (existsSync(manifestPath)) {
  const manifest = readFileSync(manifestPath, "utf8");
  for (const route of ["/api/brain-memory", "/api/tenant-scope", "/design/"]) {
    if (manifest.includes(route)) failures.push(`Production build still includes ${route}.`);
  }
}

if (failures.length > 0) {
  console.error("Production build audit failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Production build audit passed: standalone server and Stoix assets are present.");
