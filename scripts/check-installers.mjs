#!/usr/bin/env node

import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(process.cwd());
const require = createRequire(import.meta.url);
const { compareSemanticVersions, normalizedSemanticVersion } = require(
  resolve(root, "packaging", "stoix-version.cjs")
);
const packageJson = JSON.parse(read("package.json"));
const shellInstaller = read("install.sh");
const powerShellInstaller = read("install.ps1");
const launcher = read("packaging/stoix-launcher.cjs");
const packageRelease = read("scripts/package-release.mjs");
const packageInstallSmoke = read("scripts/package-install-smoke.mjs");
const workflow = read(".github/workflows/package-release.yml");
const readinessWorkflow = read(".github/workflows/release-readiness.yml");
const adr = read("docs/architecture/ADR-0011-one-command-installation.md");

assert.equal(packageJson.release?.nodeVersion, "24.15.0");
assert.equal(
  packageJson.scripts?.["package:current"],
  "npm run build && npm run package:bundle",
  "manual packaging must build current source before creating an archive"
);
assert(
  packageJson.scripts?.["package:release"]?.includes("npm run release:check && npm run package:bundle"),
  "the full release path must reuse its verified build instead of rebuilding after the checks"
);
assert(shellInstaller.includes('NODE_VERSION="24.15.0"'));
assert(powerShellInstaller.includes('$NodeVersion = "24.15.0"'));

for (const source of [shellInstaller, powerShellInstaller]) {
  assert(source.includes("SHASUMS256.txt"), "source fallback must verify the Node.js runtime");
  assert(source.includes("sha256" ) || source.includes("SHA256"), "release package checksum must be verified");
  assert(source.includes("versions"), "installation must use versioned directories");
  assert(source.includes("STOIX_SKIP_HERMES"), "installer smoke must be able to avoid changing Hermes");
  assert(source.includes("STOIX_NO_INTEGRATE"), "installer smoke must avoid desktop/PATH changes");
  assert(source.includes("hermes-agent.nousresearch.com"), "missing Hermes must use the official installer endpoint");
  assert(source.toLowerCase().includes("noninteractive") || source.includes("non-interactive"), "Hermes bootstrap must not wait for hidden prompts");
  assert(source.toLowerCase().includes("apikeychanged") || source.includes("API_KEY_CHANGED"), "a newly configured Hermes API key must restart a running gateway");
}

assert(!/^\s*sudo\s/m.test(shellInstaller), "Stoix installation must not invoke sudo");
assert(!shellInstaller.includes("eval "), "the shell installer must not evaluate downloaded metadata");
assert(!shellInstaller.includes("-maxdepth"), "the Unix installer must use macOS-compatible POSIX tools");
assert(
  shellInstaller.includes('APP_BUNDLE="$HOME/Applications/Stoix.app"') &&
    shellInstaller.includes('"$APP_BUNDLE/Contents/MacOS"'),
  "macOS integration must create a native application bundle"
);
assert(shellInstaller.includes("Terminal=false"), "Linux desktop launch must not leave a terminal open");
assert(!powerShellInstaller.includes("Invoke-Expression"), "the PowerShell installer must not evaluate downloaded metadata");
assert(!powerShellInstaller.includes("-Verb RunAs"), "the Windows installer must not request elevation");
assert(powerShellInstaller.includes("-WindowStyle Hidden -File"), "the Windows Start shortcut must launch without a terminal window");
assert(powerShellInstaller.includes("robocopy.exe"), "the Windows installer must support long package paths");
assert(powerShellInstaller.includes("Win32_Processor"), "Windows ARM detection must use the native OS architecture");
assert(powerShellInstaller.includes('\"dashboard\", \"--host\", \"127.0.0.1\"'));
assert(shellInstaller.includes("dashboard --host 127.0.0.1"));
assert(shellInstaller.includes("bundle_is_complete"));
assert(
  shellInstaller.includes('[ "$FORCE_SOURCE" = true ] && bundle_is_complete "$TARGET_ROOT"'),
  "--source must replace a complete same-version installation"
);
assert(powerShellInstaller.includes("Test-BundleComplete"));

assert(packageRelease.includes('platform === "win32" ? ".zip" : ".tar.gz"'));
assert(packageRelease.includes('execFileSync("tar", ["-czf"'));
assert(
  packageRelease.includes('while [ -L "$SELF" ]') && packageRelease.includes('readlink "$SELF"'),
  "Unix launchers must resolve installer-created command and application symlinks"
);
assert(workflow.includes("artifacts/release/*.tar.gz"));
assert(workflow.includes("macos-15"));
assert(workflow.includes("macos-15-intel"));
assert(workflow.includes("windows-latest"));
assert(workflow.includes("windows-11-arm"));
assert(workflow.includes("ubuntu-latest"));
assert(workflow.includes("ubuntu-24.04-arm"));
assert(
  readinessWorkflow.includes("npm run package:release"),
  "regular CI must exercise each runner's native package and installer"
);

for (const token of [
  "acquireInstance",
  "runtime.json",
  "parsePort",
  "--doctor",
  "stoix update",
  "updateStoix",
  "findUpdate",
  "compareSemanticVersions",
  "stopRunningStoix",
  "Could not open the browser automatically"
]) {
  assert(launcher.includes(token), `packaged launcher is missing ${token}`);
}
assert(
  launcher.includes('join(bundleRoot, "updater", installerName)') &&
    launcher.includes('process.platform === "win32" ? "install.ps1" : "install.sh"'),
  "self-update must use the native installer bundled with the verified Stoix package"
);
assert(
  launcher.includes('file: "powershell.exe"') && launcher.includes('file: "/bin/sh"'),
  "self-update must support Windows, macOS, and Linux"
);
assert(
  launcher.includes('"-InstallRoot"') &&
    launcher.includes('"-BinDir"') &&
    launcher.includes('"-ConfigRoot"') &&
    launcher.includes('"--install-root"') &&
    launcher.includes('"--bin-dir"') &&
    launcher.includes('"--config-root"'),
  "self-update must preserve the existing installation, command, and configuration roots"
);
assert(
  shellInstaller.includes('"$INSTALL_ROOT/bin-dir.txt"') &&
    powerShellInstaller.includes('(Join-Path $InstallRoot "bin-dir.txt")'),
  "installers must persist the command directory for future updates"
);
assert(
  launcher.includes('.filter((candidate) => compareSemanticVersions(candidate.version, currentVersion) > 0)') &&
    launcher.includes('update.kind === "release" ? ["-Version", update.version] : ["-Source"]') &&
    launcher.includes('update.kind === "release" ? ["--version", update.version] : ["--source"]'),
  "self-update must reject downgrades and select an explicit release or source update on every platform"
);
assert(
  packageRelease.includes('copyFileSync(join(root, "install.sh"), join(updaterRoot, "install.sh"))') &&
    packageRelease.includes('copyFileSync(join(root, "install.ps1"), join(updaterRoot, "install.ps1"))'),
  "release bundles must contain both native self-update installers"
);
assert(
  shellInstaller.includes("STOIX_SKIP_ARCHIVE=true") &&
    powerShellInstaller.includes('$env:STOIX_SKIP_ARCHIVE = "true"') &&
    packageRelease.includes('process.env.STOIX_SKIP_ARCHIVE === "true"'),
  "source installation must skip unnecessary release archives in deep temporary paths"
);
assert.equal(normalizedSemanticVersion("v1.2.3"), "1.2.3");
assert.equal(normalizedSemanticVersion("1.2.3-rc.2+build.7"), "1.2.3-rc.2");
assert.equal(normalizedSemanticVersion("latest"), null);
assert(compareSemanticVersions("0.1.1", "0.1.0") > 0);
assert(compareSemanticVersions("1.0.0", "1.0.0-rc.2") > 0);
assert(compareSemanticVersions("1.0.0-rc.10", "1.0.0-rc.2") > 0);
assert.equal(compareSemanticVersions("1.2.3", "1.2.3"), 0);
assert(!launcher.includes("offset < 20"), "launcher must not silently change the browser storage origin");
assert(launcher.includes("workspace data is tied to the local address"), "port conflicts must explain how to recover safely");
assert(
  packageInstallSmoke.includes("maxRetries: 20") && packageInstallSmoke.includes("retryDelay: 250"),
  "native installer smoke cleanup must tolerate delayed Windows file-handle release"
);

for (const token of [
  "SHA-256",
  "per-user",
  "previous version",
  "official Nous Research installer",
  "Provider authentication"
]) {
  assert(adr.includes(token), `installer ADR is missing ${token}`);
}

console.log("Cross-platform installer contract checks passed.");

function read(path) {
  return readFileSync(resolve(root, path), "utf8");
}
