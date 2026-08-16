import assert from "node:assert/strict";
import {
  parseWslDistributionList,
  prioritizeWslDistributions,
  resolveWslHermesInstallation,
  validatedWslDistributionName,
  validatedWslHermesExecutable
} from "../apps/web/src/server/wslHermesDiscovery.ts";
import { discoverWslApiServerKey } from "../apps/web/src/server/hermesClientConfig.ts";
import { resolveHermesServerTarget } from "../apps/web/src/server/hermesServerLauncher.ts";

const utf16LikeOutput = [..."docker-desktop\r\nUbuntu-24.04\r\n"].join("\0") + "\0";
assert.deepEqual(parseWslDistributionList(utf16LikeOutput), ["docker-desktop", "Ubuntu-24.04"]);
assert.deepEqual(
  prioritizeWslDistributions(["docker-desktop", "Debian", "Ubuntu-24.04", "Ubuntu"]),
  ["Ubuntu", "Ubuntu-24.04", "Debian", "docker-desktop"]
);
assert.equal(validatedWslDistributionName("Ubuntu-24.04"), "Ubuntu-24.04");
assert.throws(() => validatedWslDistributionName("Ubuntu; whoami"));
assert.equal(
  validatedWslHermesExecutable("/home/test/.local/bin/hermes\n", "missing"),
  "/home/test/.local/bin/hermes"
);
assert.throws(() => validatedWslHermesExecutable("hermes; whoami", "missing"));
assert.equal(resolveHermesServerTarget({}).baseUrl?.href, "http://127.0.0.1:8642/");

if (process.argv.includes("--live")) {
  assert.equal(process.platform, "win32", "--live WSL discovery is available only on Windows");
  const installation = await resolveWslHermesInstallation(process.env);
  const apiKey = await discoverWslApiServerKey("win32", {
    ...process.env,
    STUDIO_WSL_DISTRO: installation.distro
  });
  assert(apiKey, `Hermes in ${installation.distro} does not expose a valid API_SERVER_KEY`);
  console.log(`Live WSL Hermes discovery passed for ${installation.distro}; API key stayed private.`);
}

console.log("WSL Hermes discovery checks passed.");
