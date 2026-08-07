#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join, relative, resolve } from "node:path";

const root = resolve(process.cwd());
const failures = [];
const releaseCandidates = execFileSync(
  "git",
  ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
  { cwd: root, encoding: "utf8" }
)
  .split("\0")
  .filter(Boolean);

if (releaseCandidates.some((path) => /(^|\/)\.env\.local$/i.test(path))) {
  failures.push("A .env.local file is tracked by Git.");
}

const highConfidenceSecrets = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/,
  /\bAIza[0-9A-Za-z_-]{30,}\b/,
  /\bghp_[0-9A-Za-z]{30,}\b/,
  /\bgithub_pat_[0-9A-Za-z_]{50,}\b/,
  /\bsk-[0-9A-Za-z_-]{24,}\b/,
  /\bxox[baprs]-[0-9A-Za-z-]{20,}\b/,
  /\b(?:rk|sk)_(?:live|test)_[0-9A-Za-z]{20,}\b/
];

const personalDevelopmentDetails = [
  /C:\\Users\\Alexey(?:\\|\b)/i,
  /C:\/Users\/Alexey(?:\/|\b)/i,
  /\/mnt\/c\/Users\/Alexey(?:\/|\b)/i,
  /\/home\/alexey(?:\/|\b)/i
];

for (const path of releaseCandidates) {
  const absolute = join(root, path);
  if (!existsSync(absolute) || !isTextCandidate(absolute)) continue;
  const source = readFileSync(absolute, "utf8");
  if (highConfidenceSecrets.some((pattern) => pattern.test(source))) {
    failures.push(`High-confidence credential pattern found in release candidate ${path}.`);
  }
  if (personalDevelopmentDetails.some((pattern) => pattern.test(source))) {
    failures.push(`Personal development path found in release candidate ${path}.`);
  }
}

const localEnvPath = join(root, "apps", "web", ".env.local");
if (existsSync(localEnvPath)) {
  const privateValues = parsePrivateValues(readFileSync(localEnvPath, "utf8"));
  for (const directory of [
    join(root, "apps", "web", ".next", "standalone"),
    join(root, "artifacts", "release")
  ]) {
    if (!existsSync(directory)) continue;
    scanDirectoryForValues(directory, privateValues);
  }
}

const releaseRoot = join(root, "artifacts", "release");
if (existsSync(releaseRoot)) {
  for (const path of walk(releaseRoot)) {
    const name = relative(releaseRoot, path).replaceAll("\\", "/");
    if (/(^|\/)\.env(?:\.|$)|\.log$/i.test(name)) {
      failures.push(`Private or diagnostic file included in release output: ${name}.`);
    }
  }
}

if (failures.length > 0) {
  console.error("Release secret audit failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Release secret audit passed. Local credentials are ignored and absent from build output.");

function parsePrivateValues(source) {
  const values = [];
  for (const line of source.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator < 1) continue;
    const key = trimmed.slice(0, separator).trim();
    const value = unquote(trimmed.slice(separator + 1).trim());
    if (value.length >= 8 && /KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL/i.test(key)) values.push(value);
  }
  return values;
}

function unquote(value) {
  if (value.length > 1 && value[0] === value.at(-1) && (value[0] === '"' || value[0] === "'")) {
    return value.slice(1, -1);
  }
  return value;
}

function scanDirectoryForValues(directory, values) {
  if (values.length === 0) return;
  for (const path of walk(directory)) {
    if (!isTextCandidate(path)) continue;
    const buffer = readFileSync(path);
    for (const value of values) {
      if (buffer.includes(Buffer.from(value))) {
        failures.push(
          `A local secret value was embedded in ${relative(root, path).replaceAll("\\", "/")}.`
        );
      }
    }
  }
}

function isTextCandidate(path) {
  const stats = statSync(path);
  if (!stats.isFile() || stats.size > 8 * 1024 * 1024) return false;
  const extension = extname(path).toLowerCase();
  return ![".exe", ".node", ".png", ".jpg", ".jpeg", ".gif", ".ico", ".zip", ".woff", ".woff2"].includes(extension);
}

function walk(directory) {
  const result = [];
  const stack = [directory];
  while (stack.length > 0) {
    const current = stack.pop();
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const path = join(current, entry.name);
      if (entry.isDirectory()) stack.push(path);
      else if (entry.isFile()) result.push(path);
    }
  }
  return result;
}
