#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import {
  chmodSync,
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync
} from "node:fs";
import { createHash } from "node:crypto";
import { isAbsolute, join, relative, resolve } from "node:path";

const root = resolve(process.cwd());
const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const version = packageJson.version;
const releaseNodeVersion = packageJson.release?.nodeVersion;
const platform = process.platform;
const arch = process.arch;
const supportedPlatforms = new Set(["darwin", "linux", "win32"]);
const supportedArchitectures = new Set(["arm64", "x64"]);
const expectedPlatform = process.env.STOIX_RELEASE_PLATFORM;
const expectedArchitecture = process.env.STOIX_RELEASE_ARCH;

if (!supportedPlatforms.has(platform) || !supportedArchitectures.has(arch)) {
  throw new Error(`Unsupported release target: ${platform}-${arch}`);
}
if (expectedPlatform && platform !== expectedPlatform) {
  throw new Error(
    `Release runner platform mismatch: expected ${expectedPlatform}, received ${platform}.`
  );
}
if (expectedArchitecture && arch !== expectedArchitecture) {
  throw new Error(
    `Release runner architecture mismatch: expected ${expectedArchitecture}, received ${arch}.`
  );
}
if (!releaseNodeVersion || process.versions.node !== releaseNodeVersion) {
  throw new Error(
    `Release packages require Node ${releaseNodeVersion || "(not configured)"}; current runtime is ${process.versions.node}.`
  );
}

const standaloneRoot = join(root, "apps", "web", ".next", "standalone");
const standaloneWeb = join(standaloneRoot, "apps", "web");
if (!existsSync(join(standaloneWeb, "server.js"))) {
  throw new Error("Next standalone output is missing. Run npm run build first.");
}

const releaseRoot = join(root, "artifacts", "release");
const bundleName = `stoix-${version}-${platform}-${arch}`;
const bundleRoot = join(releaseRoot, bundleName);
const appRoot = join(bundleRoot, "app");
const runtimeRoot = join(bundleRoot, "runtime");
const launcherRoot = join(bundleRoot, "launcher");
const archiveName = `${bundleName}.zip`;
const archivePath = join(releaseRoot, archiveName);
const sourceRevision = readSourceRevision();

assertInsideRoot(releaseRoot, bundleRoot);
assertInsideRoot(releaseRoot, archivePath);
mkdirSync(releaseRoot, { recursive: true });
rmSync(bundleRoot, { recursive: true, force: true });
rmSync(archivePath, { force: true });
mkdirSync(runtimeRoot, { recursive: true });
mkdirSync(launcherRoot, { recursive: true });

cpSync(standaloneRoot, appRoot, { dereference: true, recursive: true });
cpSync(
  join(root, "apps", "web", "public"),
  join(appRoot, "apps", "web", "public"),
  { dereference: true, recursive: true }
);
cpSync(
  join(root, "apps", "web", ".next", "static"),
  join(appRoot, "apps", "web", ".next", "static"),
  { dereference: true, recursive: true }
);

const runtimeName = platform === "win32" ? "node.exe" : "node";
copyFileSync(process.execPath, join(runtimeRoot, runtimeName));
copyFileSync(
  join(root, "packaging", "stoix-launcher.cjs"),
  join(launcherRoot, "stoix-launcher.cjs")
);

const readme = readFileSync(join(root, "packaging", "README.txt"), "utf8")
  .replaceAll("{VERSION}", version);
writeFileSync(join(bundleRoot, "README.txt"), readme, "utf8");
copyFileSync(join(root, "PRIVACY.md"), join(bundleRoot, "PRIVACY.md"));
if (existsSync(join(root, "LICENSE"))) {
  copyFileSync(join(root, "LICENSE"), join(bundleRoot, "LICENSE"));
}
copyFileSync(
  join(root, "packaging", "licenses", `NODE-${releaseNodeVersion}-LICENSE.txt`),
  join(bundleRoot, "NODE_LICENSE.txt")
);
writeThirdPartyNotices(appRoot, join(bundleRoot, "THIRD_PARTY_NOTICES.txt"));
writeFileSync(
  join(bundleRoot, "VERSION.json"),
  JSON.stringify(
    {
      arch,
      builtAt: new Date().toISOString(),
      channel: "stable",
      commit: sourceRevision.commit,
      nodeVersion: process.versions.node,
      platform,
      sourceDirty: sourceRevision.dirty,
      version
    },
    null,
    2
  ) + "\n",
  "utf8"
);

writeLaunchers(bundleRoot, runtimeName);
assertBundleIsClean(bundleRoot);
createArchive(releaseRoot, bundleName, archivePath);

const digest = sha256(archivePath);
writeFileSync(join(releaseRoot, `${archiveName}.sha256`), `${digest}  ${archiveName}\n`, "utf8");
console.log(`Created ${archivePath}`);
console.log(`SHA-256 ${digest}`);

function writeLaunchers(target, runtimeName) {
  if (platform === "win32") {
    writeFileSync(
      join(target, "Stoix.cmd"),
      '@echo off\r\nsetlocal\r\n"%~dp0runtime\\node.exe" "%~dp0launcher\\stoix-launcher.cjs" %*\r\n',
      "utf8"
    );
    return;
  }

  const shellLauncher = [
    "#!/usr/bin/env sh",
    'ROOT="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"',
    `exec "$ROOT/runtime/${runtimeName}" "$ROOT/launcher/stoix-launcher.cjs" "$@"`,
    ""
  ].join("\n");
  const cliPath = join(target, "stoix");
  writeFileSync(cliPath, shellLauncher, "utf8");
  chmodSync(cliPath, 0o755);
  chmodSync(join(target, "runtime", runtimeName), 0o755);

  if (platform === "darwin") {
    const commandPath = join(target, "Stoix.command");
    writeFileSync(commandPath, shellLauncher, "utf8");
    chmodSync(commandPath, 0o755);
  }
}

function createArchive(cwd, folderName, destination) {
  if (platform === "win32") {
    const escapedFolder = join(cwd, folderName).replaceAll("'", "''");
    const escapedDestination = destination.replaceAll("'", "''");
    execFileSync(
      "powershell.exe",
      [
        "-NoLogo",
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        `Compress-Archive -LiteralPath '${escapedFolder}' -DestinationPath '${escapedDestination}' -CompressionLevel Optimal`
      ],
      { stdio: "inherit" }
    );
    return;
  }
  execFileSync("zip", ["-q", "-r", destination, folderName], { cwd, stdio: "inherit" });
}

function assertBundleIsClean(target) {
  const forbidden = [
    ".env",
    ".env.local",
    "brain-memory-client",
    "api/brain-memory",
    "src/app/design"
  ];
  const paths = walkPaths(target);
  for (const path of paths) {
    const normalized = path.replaceAll("\\", "/").toLowerCase();
    if (forbidden.some((token) => normalized.includes(token))) {
      throw new Error(`Forbidden release content: ${path}`);
    }
  }
}

function walkPaths(directory) {
  const result = [];
  const stack = [directory];
  while (stack.length > 0) {
    const current = stack.pop();
    const entries = readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const path = join(current, entry.name);
      result.push(path);
      if (entry.isDirectory()) stack.push(path);
    }
  }
  return result;
}

function writeThirdPartyNotices(applicationRoot, destination) {
  const packages = new Map();
  for (const path of walkPaths(applicationRoot)) {
    if (!path.endsWith("package.json")) continue;
    try {
      const metadata = JSON.parse(readFileSync(path, "utf8"));
      if (
        !metadata.name ||
        !metadata.version ||
        metadata.name === "stoix" ||
        metadata.name === "@stoix/web" ||
        metadata.name === "@hermes-ui/hermes-client"
      ) continue;
      packages.set(`${metadata.name}@${metadata.version}`, metadata);
    } catch {
      // Generated Next metadata may not be package metadata.
    }
  }

  const sections = [
    "Stoix third-party notices",
    "=========================",
    "",
    `The bundled Node.js ${releaseNodeVersion} license and notices are provided in NODE_LICENSE.txt.`,
    "The runtime JavaScript packages below are included in the standalone application.",
    ""
  ];

  for (const [id, metadata] of [...packages.entries()].sort(([left], [right]) => left.localeCompare(right))) {
    const sourceRoot = sourcePackageRoot(metadata.name);
    const licensePath = findLicensePath(sourceRoot);
    sections.push("--------------------------------------------------------------------------------", id);
    sections.push(`License: ${metadata.license || "See upstream package"}`);
    const repository = repositoryUrl(metadata.repository) || metadata.homepage;
    if (repository) sections.push(`Source: ${repository}`);
    if (licensePath) {
      sections.push("", readFileSync(licensePath, "utf8").trim());
    } else {
      sections.push("", "The package declares the license above; consult its upstream source for the complete notice text.");
    }
    sections.push("");
  }

  writeFileSync(destination, `${sections.join("\n")}\n`, "utf8");
}

function sourcePackageRoot(name) {
  if (name === "@hermes-ui/hermes-client") return join(root, "packages", "hermes-client");
  return join(root, "node_modules", ...name.split("/"));
}

function findLicensePath(packageRoot) {
  if (!existsSync(packageRoot)) return null;
  const match = readdirSync(packageRoot).find((name) => /^(licen[cs]e|copying|notice)(\.|$)/i.test(name));
  return match ? join(packageRoot, match) : null;
}

function repositoryUrl(repository) {
  if (typeof repository === "string") return repository;
  return repository && typeof repository.url === "string" ? repository.url : "";
}

function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function readSourceRevision() {
  try {
    const commit = execFileSync("git", ["rev-parse", "--short=12", "HEAD"], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"]
    }).trim();
    const dirty = Boolean(execFileSync("git", ["status", "--porcelain"], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"]
    }).trim());
    return { commit, dirty };
  } catch {
    return { commit: "unknown", dirty: true };
  }
}

function assertInsideRoot(parent, child) {
  const pathFromParent = relative(resolve(parent), resolve(child));
  if (!pathFromParent || pathFromParent.startsWith("..") || isAbsolute(pathFromParent)) {
    throw new Error(`Unsafe release path: ${child}`);
  }
}
