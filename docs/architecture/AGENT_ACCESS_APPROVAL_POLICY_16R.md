# Agent Access Approval Policy 16R

Date: 2026-05-31
Base commit before this slice: `c14a041 test: add disabled Runs request validation contract`

## Purpose

This document defines the future Agent access and approval policy contract for
Hermes Runs-backed chat. It exists so a future composer control can be honest:
no `Full access` or similar mode should appear enabled unless BFF and Hermes
can actually enforce it.

This is contract-only. No composer Agent access selector was implemented.
Production chat still uses `/api/hermes/chat/stream`.

## Mode Map

The future request field is `agentAccessMode`:

| User label | Request value | Current status |
| --- | --- | --- |
| Chat only | `chat_only` | Future metadata only. |
| Read-only tools | `read_only_tools` | Future metadata only. |
| Ask before tools | `ask_before_tools` | Future metadata only. |
| Full access | `full_access` | Future metadata only. |
| Custom | `custom` | Future metadata only. |

The disabled production-shaped Runs route may validate this enum, but it must
not claim enforcement. Enforcement requires BFF/Hermes support, policy mapping,
and source checks before any UI selector is enabled.

## Mode Semantics

### Chat Only

- Assistant text only.
- No tools.
- No memory writes.
- No command execution.
- No external actions.
- Approval should not occur because tools are disabled.
- UI can enable this only after BFF/Hermes can deny tool use for the run.

### Read-Only Tools

- Allows read/search/status/detail tools only.
- Allows Brain Memory status, search, and detail/inspect through approved
  paths.
- Blocks writes, command execution, file mutation, external side effects, and
  Brain Memory mutation/admin actions.
- Approval may appear only for allowed read actions if Hermes requests it;
  write/action approvals must be denied or blocked by policy.
- UI must not claim read-only enforcement if Hermes cannot enforce the tool
  boundary.

### Ask Before Tools

- Tool/action requests require approval before execution.
- `approval.request` must pause the run.
- User decisions go only to the Web UI BFF.
- BFF validates run ownership, tenant/project/session scope, allowed choices,
  and policy before calling Hermes approval endpoints.
- This is the likely safer future default for an agentic mode.
- No direct browser-to-Hermes approval call is allowed.

### Full Access

- Allows configured tools without per-action prompts.
- Still bounded by BFF/Hermes allowed tools, tenant scope, project/session
  scope, Gateway policy, and service policy.
- Does not mean unrestricted OS, filesystem, shell, network, admin, or storage
  access.
- Dangerous action classes still require explicit policy support and may still
  require approvals.
- Must never bypass Hermes, Brain Memory Gateway, or the Web UI BFF.

### Custom

- Future project/session policy profile.
- Could map to explicit allowlists, denylists, approval rules, and memory
  behavior.
- Not implemented.
- Must not appear enabled until backed by durable BFF/Hermes policy support.

## Enforcement Ownership

| Layer | Responsibility |
| --- | --- |
| Browser | Display selected mode only after enforcement exists; call only Web UI BFF routes; never imply policy with decorative UI. |
| Web UI BFF | Validate requested mode, tenant/project/session scope, run ownership, approval choices, and safe policy; forward only enforceable policy to Hermes. |
| Hermes Runs | Enforce run tool/approval behavior, emit approval events, accept approval responses only for active runs. |
| Brain Memory Gateway | Enforce tenant/project/session/key boundaries and remain the memory authority. |

The browser must not claim enforcement without BFF/Hermes support. The BFF
must not fake approval success if Hermes rejects the approval.

## Approval Behavior By Mode

| Mode | Expected approval behavior |
| --- | --- |
| `chat_only` | Approval should not happen because tools are disabled. Unexpected approval requests should be denied or treated as policy violations. |
| `read_only_tools` | Read approvals may be displayed if Hermes requests them; write, mutation, command, external, and admin actions should be denied or blocked. |
| `ask_before_tools` | `approval.request` pauses execution and the user chooses through BFF-mediated controls. |
| `full_access` | Allowed actions may proceed without per-action prompts, but high-risk or out-of-policy actions still require explicit policy or approval. |
| `custom` | Behavior is policy-driven and must be inspectable. |

Hermes approval probes have proven diagnostic `approval.request` and
`approval.responded` behavior, but production approval UI is not implemented.

## Future Composer Selector Constraints

A future composer selector may be labelled `Agent access`, but only when:

- Hermes capabilities and BFF policy support are known;
- each mode maps to concrete enforceable BFF/Hermes policy;
- unavailable modes are hidden or disabled with honest explanations;
- project/session policy can override the visible choice;
- selected mode is captured in future run metadata and activity/replay
  summaries;
- browser code still calls only BFF routes;
- no direct browser-to-Hermes, Gateway, or storage path is introduced.

There must be no fake `Full access` control. `Full access` means configured
policy access, not unrestricted system access.

## Non-Goals

- No production Runs execution.
- No production Runs composer switch.
- No composer Agent access selector UI.
- No approval buttons.
- No BFF approval action route.
- No provider/model switching.
- No direct browser-to-Hermes path.
- No direct browser-to-Brain Memory Gateway path.
- No direct storage access.
- No Brain Memory mutation/admin action.
- No auth/classification implementation.
- No Hermes or Brain Memory source change.

## Next Recommended Slice

Slice 16U: disabled Runs lifecycle route-response fixture and migration gate
checklist.

Reason: Slice 16T defines and checks the no-runtime lifecycle dry run. The
next safe step is to pin route-response fixtures and migration gates before
any experimental-to-production bridge.

## Slice 16S Policy Matrix Update

Slice 16S adds `apps/web/src/data/agentAccessPolicyFixtures.ts` with
contract-only fixtures for `chat_only`, `read_only_tools`,
`ask_before_tools`, `full_access`, and `custom`. Every fixture has
`productionUiEnabled: false` and `enforcementAvailable: false`.

`npm run check:agent-access-policy` verifies all modes are present, disabled,
and unenforced; `Full access` is not unrestricted OS/system access;
`chat_only` blocks tools; `read_only_tools` blocks writes, commands, and
external actions; `ask_before_tools` requires `approval.request` plus BFF
approval enforcement; `custom` remains future-only; and production UI still
has no composer Agent access selector UI or enabled `Full access` copy.

## Slice 16T Lifecycle Dry-Run Update

Slice 16T adds a production Runs BFF lifecycle dry-run plan. Agent access is
represented only as lifecycle metadata: `validate_agent_access_policy` is
planned but not enforced, and the disabled route returns
`lifecycleDryRun.agentAccessMode.posture` as `metadata_only`, `invalid`, or
`omitted`. No composer Agent access selector UI or approval buttons were added.
