import assert from "node:assert/strict";
import {
  launchHermesServer,
  probeHermesServer,
  stopManagedWslGatewayProcess,
  waitForHermesServer
} from "../apps/web/src/server/hermesServerLauncher.ts";

assert.equal(process.platform, "win32", "The live WSL recovery smoke requires Windows");
const baseUrl = new URL("http://127.0.0.1:8642");
await launchHermesServer(baseUrl, "win32", {
  ...process.env,
  HERMES_DASHBOARD_WINDOWS_MODE: "wsl"
});
assert(await waitForHermesServer(baseUrl), "Managed WSL Hermes did not become healthy");
await new Promise((resolve) => setTimeout(resolve, 3_000));
assert(await probeHermesServer(baseUrl), "Managed WSL Hermes stopped after becoming healthy");
console.log("Live managed WSL Hermes recovery passed and remained healthy.");
await stopManagedWslGatewayProcess();
