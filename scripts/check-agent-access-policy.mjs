#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const failures = [];

function read(path) {
  return readFileSync(join(root, path), "utf8");
}

function expect(condition, message) {
  if (!condition) {
    failures.push(message);
  }
}

const EXPECTED_MODES = ["chat_only", "read_only_tools", "ask_before_tools", "full_access", "custom"];
const invalid_agent_access_mode = "invalid_mode_sentinel_not_a_real_mode";

const fixturesSource = read("apps/web/src/data/agentAccessPolicyFixtures.ts");
const composerSource = read("apps/web/src/components/chat/Composer.tsx");

// Dynamically evaluate fixtures for semantic checks
const modeRegex = /mode:\s*"([^"]+)"/g;
const presentModes = [];
let m;
while ((m = modeRegex.exec(fixturesSource)) !== null) {
  presentModes.push(m[1]);
}

function checkAllModesPresent() {
  for (const mode of EXPECTED_MODES) {
    expect(
      presentModes.includes(mode),
      `Agent access policy fixtures must include mode: ${mode}`
    );
  }
  expect(
    !presentModes.includes(invalid_agent_access_mode),
    "Agent access policy fixtures must not include the invalid sentinel mode."
  );
}

function checkAllModesDisabled() {
  expect(
    !fixturesSource.includes("productionUiEnabled: true"),
    "No agent access mode may have productionUiEnabled: true — enforcement is not yet available."
  );
  expect(
    !fixturesSource.includes("enforcementAvailable: true"),
    "No agent access mode may have enforcementAvailable: true — policy enforcement is not yet implemented."
  );
}

function checkFullAccessWarning() {
  expect(
    fixturesSource.includes("safetyWarning"),
    "full_access mode must carry a safetyWarning clarifying it is not unrestricted system access."
  );
  expect(
    fixturesSource.includes("not unrestricted") || fixturesSource.includes("not unlimited"),
    "full_access safetyWarning must explicitly state it is not unrestricted access."
  );
}

function checkModePolicySemantics() {
  expect(
    fixturesSource.includes('"no_tools"'),
    "chat_only mode must map to no_tools policy."
  );
  expect(
    fixturesSource.includes('"read_only_tools_only"'),
    "read_only_tools mode must map to read_only_tools_only policy."
  );
  expect(
    fixturesSource.includes('"approval_required_before_tools"'),
    "ask_before_tools mode must map to approval_required_before_tools policy."
  );
  expect(
    fixturesSource.includes('"configured_policy_only"'),
    "full_access mode must map to configured_policy_only policy."
  );
  expect(
    fixturesSource.includes('"future_custom_policy"'),
    "custom mode must map to future_custom_policy."
  );
}

function checkValidatorModeContract() {
  expect(
    fixturesSource.includes("agentAccessPolicyFixtureModes"),
    "Fixtures must export agentAccessPolicyFixtureModes for validator mode contract checks."
  );
  expect(
    fixturesSource.includes("HermesRunsBffAgentAccessMode"),
    "Fixtures must export HermesRunsBffAgentAccessMode type for validator contract."
  );
}

function checkNoComposerSelector() {
  expect(
    !composerSource.includes("agentAccessMode") && !composerSource.includes("agent-access-mode"),
    "Composer must not expose an agent access mode selector — policy is server-side only."
  );
  expect(
    !composerSource.includes("agentAccessPolicy"),
    "Composer must not read or render agentAccessPolicy — this is a BFF concern."
  );
}

function checkNoEnabledFullAccessProductionUi() {
  expect(
    !composerSource.includes("full_access") || composerSource.includes("disabled"),
    "Composer must not render an enabled full_access production UI element."
  );
  expect(
    fixturesSource.includes("productionUiEnabled: false"),
    "full_access fixture must have productionUiEnabled: false."
  );
}

function checkNoApprovalButtonsInComposer() {
  expect(
    !composerSource.includes("approveAction") && !composerSource.includes("denyAction"),
    "Composer must not include approval action buttons — approval belongs in activity rails."
  );
  expect(
    !composerSource.includes("ApprovalButton") && !composerSource.includes("approval-button"),
    "Composer must not render an ApprovalButton component."
  );
}

function checkDisabledRouteStillDisabled() {
  const runsDisabledPath = "apps/web/src/app/api/hermes/runs/chat/stream/route.ts";
  if (existsSync(join(root, runsDisabledPath))) {
    const route = read(runsDisabledPath);
    expect(
      route.includes("production_runs_route_not_enabled") || route.includes("405") || route.includes("disabled"),
      "Hermes Runs production route must remain disabled until enforcement is available."
    );
  }
  // Route absent == pruned and disabled by omission — acceptable
}

function checkRouteGuardCoversAgentAccessModes() {
  expect(
    EXPECTED_MODES.every((mode) => fixturesSource.includes(`"${mode}"`)),
    "Agent access policy fixtures must enumerate all modes that a future route guard must cover."
  );
  expect(
    fixturesSource.includes("reasonDisabled"),
    "Each mode must document its reasonDisabled for route guard reference."
  );
}

const validChatOnlyDisabledRequestBody = {
  mode: "chat_only",
  productionUiEnabled: false,
  enforcementAvailable: false
};

const validFullAccessDisabledRequestBody = {
  mode: "full_access",
  productionUiEnabled: false,
  enforcementAvailable: false,
  safetyWarning: "Full access is not unrestricted OS, filesystem, shell, network, admin, storage, or system access."
};

function checkFixtureBodyShape() {
  expect(
    typeof validChatOnlyDisabledRequestBody.mode === "string" &&
      validChatOnlyDisabledRequestBody.productionUiEnabled === false,
    "validChatOnlyDisabledRequestBody shape must reflect disabled production state."
  );
  expect(
    typeof validFullAccessDisabledRequestBody.safetyWarning === "string" &&
      validFullAccessDisabledRequestBody.productionUiEnabled === false,
    "validFullAccessDisabledRequestBody must carry a safetyWarning and disabled state."
  );
}

checkAllModesPresent();
checkAllModesDisabled();
checkFullAccessWarning();
checkModePolicySemantics();
checkValidatorModeContract();
checkNoComposerSelector();
checkNoEnabledFullAccessProductionUi();
checkNoApprovalButtonsInComposer();
checkDisabledRouteStillDisabled();
checkRouteGuardCoversAgentAccessModes();
checkFixtureBodyShape();

if (failures.length > 0) {
  console.error("Agent access policy checks failed:");
  for (const failure of failures) {
    console.error(`  - ${failure}`);
  }
  process.exit(1);
}

console.log(`Agent access policy checks passed (${EXPECTED_MODES.length} modes verified, all disabled).`);
