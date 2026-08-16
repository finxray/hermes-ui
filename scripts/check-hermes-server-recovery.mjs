import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");
const launcherPath = path.join(root, "apps/web/src/server/hermesServerLauncher.ts");
const launcher = await import(pathToFileURL(launcherPath).href);

const adr = read("docs/architecture/ADR-0012-controlled-hermes-server-recovery.md");
const route = read("apps/web/src/app/api/hermes/server/route.ts");
const client = read("apps/web/src/lib/hermesServerRecovery.ts");
const composer = read("apps/web/src/components/chat/Composer.tsx");

for (const token of ["fixed allowlisted argument vector", "127.0.0.1", "same-origin", "not that API"]) {
  assert(adr.includes(token), `server recovery ADR is missing ${token}`);
}

for (const token of ["isAllowedHermesServerStartRequest", "launchHermesServer", "waitForHermesServer", 'runtime = "nodejs"']) {
  assert(route.includes(token), `server recovery route is missing ${token}`);
}

for (const token of ['fetch("/api/hermes/server"', '"X-Hermes-UI-Action": "start-server"', 'method: "POST"']) {
  assert(client.includes(token), `server recovery client is missing ${token}`);
}

for (const token of ["Hermes is not connected", "Launch Hermes", "useHermesServerRecovery"]) {
  assert(composer.includes(token), `composer recovery UI is missing ${token}`);
}

assert(!read("apps/web/src/server/hermesServerLauncher.ts").includes("shell: true"));

const native = launcher.buildHermesServerRecoverySpecs(
  "win32",
  { kind: "native", path: "C:\\Hermes\\hermes.exe" },
  new URL("http://127.0.0.1:8642")
);
assert.equal(native[0].command, "C:\\Hermes\\hermes.exe");
assert.deepEqual(native[0].args, ["serve", "--stop"]);
assert.deepEqual(native[1].args, ["gateway", "start"]);

const wsl = launcher.buildHermesServerRecoverySpecs(
  "win32",
  { distro: "Ubuntu", kind: "wsl", path: "/home/user/.local/bin/hermes" },
  new URL("http://localhost:8642")
);
assert.equal(wsl[0].command, "wsl.exe");
assert.equal(wsl.length, 1);
assert.deepEqual(wsl[0].args, [
  "-d",
  "Ubuntu",
  "--",
  "/home/user/.local/bin/hermes",
  "gateway",
  "run",
  "--replace",
  "--force"
]);

assert.equal(
  launcher.resolveHermesServerTarget({ HERMES_API_BASE_URL: "http://127.0.0.1:8642" }).canStart,
  true
);
assert.equal(
  launcher.resolveHermesServerTarget({ HERMES_API_BASE_URL: "https://example.com:8642" }).canStart,
  false
);

assert.match(launcher.hermesServerTimeoutMessage("darwin"), /macOS Terminal/);
assert.match(launcher.hermesServerTimeoutMessage("darwin"), /hermes gateway restart/);
assert.doesNotMatch(launcher.hermesServerTimeoutMessage("darwin"), /WSL/);
assert.match(launcher.hermesServerTimeoutMessage("win32"), /inside WSL/);
assert.doesNotMatch(route, /run `hermes gateway run` in WSL/);

console.log("Hermes server recovery checks passed.");
