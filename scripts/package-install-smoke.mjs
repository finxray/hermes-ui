#!/usr/bin/env node

import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import appPackage from "../package.json" with { type: "json" };

const root = resolve(process.cwd());
const platform = process.platform;
const arch = process.arch;
const extension = platform === "win32" ? ".zip" : ".tar.gz";
const archive = join(
  root,
  "artifacts",
  "release",
  `stoix-${appPackage.version}-${platform}-${arch}${extension}`
);
const smokeRoot = mkdtempSync(join(tmpdir(), "stoix-package-install-"));
const installRoot = join(smokeRoot, "install");
const binRoot = join(smokeRoot, "bin");
const configRoot = join(smokeRoot, "config");
const configPath = join(configRoot, "config.env");

if (!existsSync(archive)) {
  throw new Error(`Packaged archive is missing: ${archive}`);
}

try {
  runInstaller();

  const targetRoot = join(installRoot, "versions", appPackage.version);
  const metadataPath = join(targetRoot, "VERSION.json");
  if (!existsSync(metadataPath) || !existsSync(configPath)) {
    throw new Error("Installer did not create the versioned application and isolated configuration.");
  }
  const metadata = JSON.parse(readFileSync(metadataPath, "utf8"));
  if (metadata.version !== appPackage.version || metadata.platform !== platform || metadata.arch !== arch) {
    throw new Error("Installed VERSION.json does not match the native package target.");
  }

  const installedLauncher = join(targetRoot, "launcher", "stoix-launcher.cjs");
  rmSync(installedLauncher, { force: true });
  runInstaller();
  if (!existsSync(installedLauncher)) {
    throw new Error("Installer did not repair a deliberately incomplete application version.");
  }
  const preservedIncompleteVersion = readdirSync(join(installRoot, "versions"), { withFileTypes: true })
    .some((entry) => entry.isDirectory() && entry.name.startsWith(`.incomplete-${appPackage.version}-`));
  if (!preservedIncompleteVersion) {
    throw new Error("Installer did not preserve the incomplete version during repair.");
  }
  console.log("Damaged-install repair smoke passed.");

  await assertSingleInstance(targetRoot, configPath);
  await assertStablePortConflict(targetRoot, configPath);

  const launcherArgs = ["--smoke", "--port=32911", `--config=${configPath}`];
  if (platform === "win32") {
    const command = join(binRoot, "stoix.ps1");
    execFileSync("powershell.exe", [
      "-NoLogo",
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      command,
      ...launcherArgs
    ], {
      cwd: installRoot,
      stdio: "inherit",
      timeout: 90_000
    });
  } else {
    execFileSync(join(binRoot, "stoix"), launcherArgs, {
      cwd: installRoot,
      stdio: "inherit",
      timeout: 90_000
    });
  }

  console.log("Native one-command install smoke passed.");
} finally {
  rmSync(smokeRoot, { force: true, recursive: true });
}

function runInstaller() {
  if (platform === "win32") {
    execFileSync(
      "powershell.exe",
      [
        "-NoLogo",
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        join(root, "install.ps1"),
        "-ArchivePath",
        archive,
        "-InstallRoot",
        installRoot,
        "-BinDir",
        binRoot,
        "-ConfigRoot",
        configRoot,
        "-SkipHermes",
        "-NoLaunch",
        "-NoIntegrate"
      ],
      { cwd: root, stdio: "inherit", timeout: 120_000 }
    );
  } else {
    execFileSync(
      "sh",
      [
        join(root, "install.sh"),
        "--archive",
        archive,
        "--install-root",
        installRoot,
        "--bin-dir",
        binRoot,
        "--config-root",
        configRoot,
        "--skip-hermes",
        "--no-launch",
        "--no-integrate"
      ],
      { cwd: root, stdio: "inherit", timeout: 120_000 }
    );
  }
}

async function assertSingleInstance(targetRoot, configPath) {
  const runtime = join(targetRoot, "runtime", platform === "win32" ? "node.exe" : "node");
  const launcher = join(targetRoot, "launcher", "stoix-launcher.cjs");
  const runtimeStatePath = join(configRoot, "runtime.json");
  const output = { stderr: "", stdout: "" };
  const first = spawn(runtime, [launcher, "--no-open", "--port=32912", `--config=${configPath}`], {
    cwd: targetRoot,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true
  });
  first.stdout.setEncoding("utf8");
  first.stderr.setEncoding("utf8");
  first.stdout.on("data", (chunk) => { output.stdout += chunk; });
  first.stderr.on("data", (chunk) => { output.stderr += chunk; });

  try {
    const state = await waitForRuntimeState(runtimeStatePath, first, output);
    const response = await fetch(state.url, { cache: "no-store", signal: AbortSignal.timeout(5_000) });
    if (!response.ok) {
      throw new Error(`Installed launcher returned HTTP ${response.status} during single-instance smoke.`);
    }
    const secondOutput = execFileSync(
      runtime,
      [launcher, "--no-open", "--port=32912", `--config=${configPath}`],
      { cwd: targetRoot, encoding: "utf8", timeout: 15_000, windowsHide: true }
    );
    if (!secondOutput.includes("is already running at")) {
      throw new Error("A second launcher did not reuse the running Stoix instance.");
    }
    console.log("Single-instance launcher smoke passed.");
  } finally {
    if (first.exitCode === null) first.kill("SIGTERM");
    await Promise.race([
      new Promise((resolveExit) => first.once("exit", resolveExit)),
      new Promise((resolveTimeout) => setTimeout(resolveTimeout, 5_000))
    ]);
    if (first.exitCode === null) first.kill("SIGKILL");
  }
}

async function assertStablePortConflict(targetRoot, configPath) {
  const runtime = join(targetRoot, "runtime", platform === "win32" ? "node.exe" : "node");
  const launcher = join(targetRoot, "launcher", "stoix-launcher.cjs");
  const blocker = createServer();
  await new Promise((resolveListen, rejectListen) => {
    blocker.once("error", rejectListen);
    blocker.listen({ host: "127.0.0.1", port: 32913, exclusive: true }, resolveListen);
  });
  try {
    let output = "";
    try {
      execFileSync(
        runtime,
        [launcher, "--no-open", "--port=32913", `--config=${configPath}`],
        { cwd: targetRoot, encoding: "utf8", timeout: 15_000, windowsHide: true }
      );
      throw new Error("Launcher silently switched away from its configured browser origin.");
    } catch (error) {
      output = `${error?.stdout ?? ""}\n${error?.stderr ?? ""}`;
      if (!output.includes("browser workspace data is tied to the local address")) {
        throw error;
      }
    }
    console.log("Stable-port conflict smoke passed.");
  } finally {
    await new Promise((resolveClose) => blocker.close(resolveClose));
  }
}

async function waitForRuntimeState(runtimeStatePath, child, output) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`Installed launcher exited early.\n${output.stdout}\n${output.stderr}`);
    }
    if (existsSync(runtimeStatePath)) {
      const state = JSON.parse(readFileSync(runtimeStatePath, "utf8"));
      if (typeof state.url === "string") return state;
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 200));
  }
  throw new Error(`Installed launcher did not publish runtime state.\n${output.stdout}\n${output.stderr}`);
}
