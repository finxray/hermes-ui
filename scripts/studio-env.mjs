#!/usr/bin/env node

import { copyFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const root = resolve(process.cwd());
const envDir = join(root, "env");
const target = join(root, "apps", "web", ".env.local");
const args = parseArgs(process.argv.slice(2));

const modes = {
  "web-ui-only": "web-ui-only.env.example",
  "web-ui-with-hermes": "web-ui-with-hermes.env.example",
  bundle: "bundle-with-brain-memory.env.example",
  "bundle-with-brain-memory": "bundle-with-brain-memory.env.example",
  "attach-brain-memory-later": "attach-brain-memory-later.env.example"
};

if (args.list) {
  printModes();
  process.exit(0);
}

const mode = args.mode;
if (!mode || !modes[mode]) {
  console.error("Unknown or missing mode.");
  printModes();
  process.exit(2);
}

const source = join(envDir, modes[mode]);
if (!existsSync(source)) {
  console.error(`Template not found: ${source}`);
  process.exit(2);
}

if (existsSync(target) && !args.force) {
  console.error("apps/web/.env.local already exists; refusing to overwrite.");
  console.error("Re-run with --force if you intentionally want to replace it.");
  console.error("Current env was preserved.");
  process.exit(1);
}

mkdirSync(dirname(target), { recursive: true });
copyFileSync(source, target);

console.log(`Created apps/web/.env.local from ${modes[mode]}.`);
console.log(`Selected mode: ${mode}`);
console.log("No secrets were generated or printed.");
console.log("");
console.log("Next commands:");
console.log("- npm run studio:doctor");
console.log("- npm run dev");
console.log("- npm run studio:open");

function parseArgs(values) {
  const parsed = {
    force: false,
    list: false,
    mode: ""
  };

  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (value === "--force") {
      parsed.force = true;
    } else if (value === "--list") {
      parsed.list = true;
    } else if (value.startsWith("--mode=")) {
      parsed.mode = value.slice("--mode=".length);
    } else if (value === "--mode") {
      parsed.mode = values[index + 1] ?? "";
      index += 1;
    }
  }

  return parsed;
}

function printModes() {
  console.log("Available env modes:");
  for (const [modeName, fileName] of Object.entries(modes)) {
    console.log(`- ${modeName} (${fileName})`);
  }
  console.log("");
  console.log("Templates in env/:");
  for (const fileName of readdirSync(envDir).filter((file) => file.endsWith(".env.example"))) {
    console.log(`- ${fileName}`);
  }
}
