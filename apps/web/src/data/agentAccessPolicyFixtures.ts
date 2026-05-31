import type { HermesRunsBffAgentAccessMode } from "@/types/hermesRunsBffRequest";

export type AgentAccessPolicyFixture = {
  mode: HermesRunsBffAgentAccessMode;
  displayLabel: string;
  intendedMeaning: string;
  expectedToolPolicy:
    | "no_tools"
    | "read_only_tools_only"
    | "approval_required_before_tools"
    | "configured_policy_only"
    | "future_custom_policy";
  expectedApprovalBehavior: string;
  brainMemoryReadAllowed: boolean;
  brainMemoryWriteAllowed: boolean;
  commandAllowed: boolean;
  externalActionAllowed: boolean;
  productionUiEnabled: false;
  enforcementAvailable: false;
  reasonDisabled: string;
  safetyWarning?: string;
};

export const agentAccessPolicyFixtures = [
  {
    brainMemoryReadAllowed: false,
    brainMemoryWriteAllowed: false,
    commandAllowed: false,
    displayLabel: "Chat only",
    enforcementAvailable: false,
    expectedApprovalBehavior: "approval.request should not occur because tool access is disabled.",
    expectedToolPolicy: "no_tools",
    externalActionAllowed: false,
    intendedMeaning: "Assistant text only; no runtime tools, commands, external actions, or memory writes.",
    mode: "chat_only",
    productionUiEnabled: false,
    reasonDisabled: "BFF and Hermes Runs do not yet enforce a no-tools policy for production chat."
  },
  {
    brainMemoryReadAllowed: true,
    brainMemoryWriteAllowed: false,
    commandAllowed: false,
    displayLabel: "Read-only tools",
    enforcementAvailable: false,
    expectedApprovalBehavior:
      "read approvals may be displayed if Hermes requests them; write, mutation, command, and external actions must be denied or blocked.",
    expectedToolPolicy: "read_only_tools_only",
    externalActionAllowed: false,
    intendedMeaning: "Read/search/status/detail tools only through approved BFF and Gateway paths.",
    mode: "read_only_tools",
    productionUiEnabled: false,
    reasonDisabled: "BFF and Hermes Runs do not yet enforce a read-only tool allowlist for production chat."
  },
  {
    brainMemoryReadAllowed: true,
    brainMemoryWriteAllowed: false,
    commandAllowed: false,
    displayLabel: "Ask before tools",
    enforcementAvailable: false,
    expectedApprovalBehavior:
      "approval.request must pause execution and user decisions must go through BFF approval enforcement.",
    expectedToolPolicy: "approval_required_before_tools",
    externalActionAllowed: false,
    intendedMeaning: "Tool/action requests require a BFF-mediated approval before execution.",
    mode: "ask_before_tools",
    productionUiEnabled: false,
    reasonDisabled: "Production chat does not yet use a BFF-owned Runs lifecycle with approval enforcement."
  },
  {
    brainMemoryReadAllowed: true,
    brainMemoryWriteAllowed: false,
    commandAllowed: false,
    displayLabel: "Full access",
    enforcementAvailable: false,
    expectedApprovalBehavior:
      "allowed configured actions may proceed without per-action prompts only after enforceable policy exists; high-risk actions may still require approval.",
    expectedToolPolicy: "configured_policy_only",
    externalActionAllowed: false,
    intendedMeaning: "Configured policy access, not unrestricted system access.",
    mode: "full_access",
    productionUiEnabled: false,
    reasonDisabled: "No enforceable production BFF/Hermes policy maps this mode to a safe toolset yet.",
    safetyWarning:
      "Full access is not unrestricted OS, filesystem, shell, network, admin, storage, or system access."
  },
  {
    brainMemoryReadAllowed: false,
    brainMemoryWriteAllowed: false,
    commandAllowed: false,
    displayLabel: "Custom",
    enforcementAvailable: false,
    expectedApprovalBehavior: "future-only policy profile; behavior must be inspectable before UI exposure.",
    expectedToolPolicy: "future_custom_policy",
    externalActionAllowed: false,
    intendedMeaning: "Future explicit policy profile with allowlists, denylists, and approval rules.",
    mode: "custom",
    productionUiEnabled: false,
    reasonDisabled: "Custom Agent access policy profiles are future-only and not implemented."
  }
] satisfies AgentAccessPolicyFixture[];

export const agentAccessPolicyFixtureModes = agentAccessPolicyFixtures.map((fixture) => fixture.mode);
