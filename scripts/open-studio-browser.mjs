#!/usr/bin/env node

import { execFile } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { promisify } from "node:util";
import { selectedBaseUrl } from "./smoke-base-url.mjs";

const execFileAsync = promisify(execFile);
const url = readArg("url") || `${selectedBaseUrl(readArg("base-url"))}/`;

try {
  await openUrl(url);
  console.log(`Opened selected Studio URL: ${url}`);
} catch (error) {
  console.log(`Could not open a browser automatically. Open this URL manually: ${url}`);
  if (error instanceof Error && error.message) {
    console.log(`Reason: ${error.message}`);
  }
}

function readArg(name) {
  const prefix = `--${name}=`;
  const values = process.argv.slice(2);
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (value.startsWith(prefix)) {
      return value.slice(prefix.length);
    }
    if (value === `--${name}`) {
      return values[index + 1] || "";
    }
  }
  return "";
}

async function openUrl(targetUrl) {
  if (isWsl()) {
    try {
      await execFileAsync("powershell.exe", [
        "-NoProfile",
        "-Command",
        `Start-Process '${targetUrl.replaceAll("'", "''")}'`
      ]);
      return;
    } catch {
      // Fall through to Linux open commands.
    }
  }

  if (process.platform === "win32") {
    await execFileAsync("powershell.exe", [
      "-NoProfile",
      "-Command",
      `Start-Process '${targetUrl.replaceAll("'", "''")}'`
    ]);
    return;
  }

  if (process.platform === "darwin") {
    await execFileAsync("open", [targetUrl]);
    return;
  }

  await execFileAsync("xdg-open", [targetUrl]);
}

function isWsl() {
  if (process.platform !== "linux") {
    return false;
  }
  if (process.env.WSL_DISTRO_NAME) {
    return true;
  }
  try {
    return existsSync("/proc/version") && /microsoft|wsl/i.test(readFileSync("/proc/version", "utf8"));
  } catch {
    return false;
  }
}
