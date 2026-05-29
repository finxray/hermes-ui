#!/usr/bin/env node

import { execFile } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const url = readArg("url") || "http://127.0.0.1:3000";

try {
  await openUrl(url);
  console.log(`Opened ${url}`);
} catch (error) {
  console.log(`Could not open a browser automatically. Open this URL manually: ${url}`);
  if (error instanceof Error && error.message) {
    console.log(`Reason: ${error.message}`);
  }
}

function readArg(name) {
  const prefix = `--${name}=`;
  return process.argv.slice(2).find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
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
