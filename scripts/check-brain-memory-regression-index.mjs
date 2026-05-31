#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const docPath = join(root, "docs/product/BRAIN_MEMORY_REGRESSION_INDEX_15K.md");
const failures = [];

if (!existsSync(docPath)) {
  failures.push("Missing docs/product/BRAIN_MEMORY_REGRESSION_INDEX_15K.md.");
} else {
  const doc = readFileSync(docPath, "utf8");

  for (const token of [
    "BFF status route",
    "BFF search route",
    "BFF inspect/detail route",
    "Memory Console status panel",
    "Memory search UI",
    "Memory result cards",
    "Memory detail panel",
    "Evidence not_implemented state",
    "Supersession not_implemented state",
    "Audit metadata-only section",
    "Memory timeline",
    "Tenant/scope diagnostics",
    "Live memory activity blocks",
    "Project/session scope behavior",
    "Project-only read behavior",
    "Non-live memory detail fixture",
    "Brain Memory client normalization"
  ]) {
    requireToken(doc, token, `Regression index is missing surface: ${token}`);
  }

  for (const command of [
    "npm run check:brain-memory-client",
    "npm run check:tenant-scope",
    "npm run check:ui-structure",
    "npm run check:brain-memory-regression-index",
    "npm run smoke:mvp",
    "npm run smoke:ui",
    "npm run smoke:ui:memory-live",
    "npm run smoke:ui:memory-scope",
    "npm run smoke:memory-detail"
  ]) {
    requireToken(doc, command, `Regression index is missing command: ${command}`);
  }

  for (const deferred of [
    "memory mutation/admin actions",
    "durable evidence storage",
    "durable supersession storage",
    "durable audit persistence",
    "full auth/classification model",
    "production one-command CLI",
    "future project-level memory writes",
    "export/import"
  ]) {
    requireToken(doc, deferred, `Regression index is missing deferred capability: ${deferred}`);
  }

  for (const requiredBoundary of [
    "no memory mutation/admin UI was added",
    "no direct browser-to-Gateway path is added or claimed",
    "no direct browser-to-Hermes path is added or claimed",
    "no direct storage path is added or claimed",
    "Brain Memory reads remain BFF-mediated and Gateway-authorized"
  ]) {
    requireToken(doc, requiredBoundary, `Regression index is missing boundary: ${requiredBoundary}`);
  }

  for (const forbiddenClaim of [
    "Delete memory is available",
    "Supersede memory is available",
    "Pin memory is available",
    "Mark stale is available",
    "browser calls Brain Memory Gateway directly",
    "browser calls Hermes directly",
    "direct storage access is implemented"
  ]) {
    if (doc.includes(forbiddenClaim)) {
      failures.push(`Regression index claims forbidden behavior: ${forbiddenClaim}`);
    }
  }
}

if (failures.length > 0) {
  console.error("Brain Memory regression index checks failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Brain Memory regression index checks passed.");

function requireToken(doc, token, message) {
  if (!doc.includes(token)) {
    failures.push(message);
  }
}
