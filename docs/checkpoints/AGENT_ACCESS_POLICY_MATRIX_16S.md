# Agent Access Policy Matrix 16S

Date: 2026-05-31
Base commit before this slice: `795501a test: add disabled Runs validation echo and access policy`

## Purpose

Slice 16S adds deterministic Agent access policy fixtures and a source-only
guard so future UI cannot accidentally expose an enabled Agent access selector
before BFF/Hermes enforcement exists.

This is checks, fixtures, and documentation only. It does not implement the
composer Agent access selector, approval buttons, production Runs execution, or
any runtime policy enforcement.

Production chat still uses `/api/hermes/chat/stream`.

## Files Changed

- `apps/web/src/data/agentAccessPolicyFixtures.ts`
- `scripts/check-agent-access-policy.mjs`
- `scripts/hermes-runs-production-route-guard.mjs`
- `scripts/check-ui-structure.mjs`
- `package.json`
- `docs/checkpoints/AGENT_ACCESS_POLICY_MATRIX_16S.md`
- `docs/architecture/AGENT_ACCESS_APPROVAL_POLICY_16R.md`
- `docs/product/APPROVALS_UX_13H.md`
- `docs/product/AGENT_ORCHESTRATION_SLICE_PLAN.md`
- `ROADMAP.md`

## Policy Fixtures

`apps/web/src/data/agentAccessPolicyFixtures.ts` defines one fixture for each
future mode:

- `chat_only`
- `read_only_tools`
- `ask_before_tools`
- `full_access`
- `custom`

Each fixture includes:

- `mode`
- `displayLabel`
- `intendedMeaning`
- `expectedToolPolicy`
- `expectedApprovalBehavior`
- `brainMemoryReadAllowed`
- `brainMemoryWriteAllowed`
- `commandAllowed`
- `externalActionAllowed`
- `productionUiEnabled: false`
- `enforcementAvailable: false`
- `reasonDisabled`

The fixtures are contract data only. They do not drive UI and do not imply
runtime enforcement.

## Mode Matrix

| Mode | Tool policy | Approval behavior | Brain Memory read | Brain Memory write | Commands | External actions | Production UI | Enforcement |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `chat_only` | `no_tools` | Approval should not occur because tools are disabled. | No | No | No | No | Disabled | Unavailable |
| `read_only_tools` | `read_only_tools_only` | Read approvals may display; write/action requests are blocked or denied. | Yes | No | No | No | Disabled | Unavailable |
| `ask_before_tools` | `approval_required_before_tools` | `approval.request` must pause and BFF approval enforcement must handle decisions. | Yes | No | No | No | Disabled | Unavailable |
| `full_access` | `configured_policy_only` | Configured actions may proceed only after enforceable policy exists; high-risk actions may still require approval. | Yes | No | No | No | Disabled | Unavailable |
| `custom` | `future_custom_policy` | Future inspectable policy profile. | No | No | No | No | Disabled | Unavailable |

`full_access` is explicitly documented as configured policy access, not
unrestricted OS, filesystem, shell, network, admin, storage, or system access.
In short: `full_access` is not unrestricted OS or system access.

## Enforcement Status

All modes currently have:

- `productionUiEnabled: false`
- `enforcementAvailable: false`

The future selector remains unimplemented because the BFF cannot yet enforce
mode-specific tool policy, Hermes Runs is not the production composer path,
approval actions are not wired through a production BFF route, and Brain Memory
read/write behavior is not enforceable per mode from the composer.

## Source-Only Guard

`npm run check:agent-access-policy` verifies:

- all five modes are present;
- all modes are disabled and unenforced;
- `full_access` is not unrestricted system access;
- `read_only_tools` blocks writes, commands, and external actions;
- `chat_only` blocks runtime tools;
- `ask_before_tools` requires `approval.request` plus BFF approval enforcement;
- `custom` is future-only;
- the request validator accepts known modes and rejects unknown modes;
- Composer has no Agent access selector;
- production UI contains no enabled `Full access` selector copy;
- production Composer has no approval buttons;
- disabled Runs route validates `agentAccessMode` as metadata but does not
  execute;
- the route guard covers `chat_only`, `full_access`, and invalid
  `agentAccessMode` cases.

## Disabled Route Behavior

`POST /api/hermes/runs/chat/stream` remains disabled:

- HTTP 501
- `reason: "production_runs_route_not_enabled"`
- `agentAccessSelector: "future-only"`
- `requestValidation.futureFields.agentAccessMode: "metadata_only"`
- `execution.hermesRunCreated: false`
- `execution.hermesCalled: false`
- `execution.brainMemoryCalled: false`
- `execution.eventStreamStarted: false`
- `execution.approvalCalled: false`
- `execution.stopCalled: false`
- `execution.storageAccess: false`

The route guard now includes valid disabled requests for `chat_only` and
`full_access`, plus an invalid `agentAccessMode` request. All remain disabled.

## Safety Boundaries

- No production Runs execution runtime.
- No production chat switch to Runs.
- No change to `/api/hermes/chat/stream`.
- No production Runs composer switch.
- No composer Agent access selector UI.
- No approval buttons.
- No enabled `Full access` production UI.
- No Hermes run creation from the disabled production route.
- No Hermes API call from the disabled production route.
- No Brain Memory Gateway call from the disabled production route.
- No memory scope bridge import from the disabled production route.
- No direct browser-to-Hermes path.
- No direct browser-to-Brain Memory Gateway path.
- No direct storage access.
- No Brain Memory BFF change.
- No project/session stable-key change.
- No tenant-check loosening.
- No provider/model switching.
- No export/import.
- No secrets committed.

## Checks Run

- `npm run check:agent-access-policy`
- `npm run smoke:hermes:runs:route-guard`
- `npm run check:hermes-runs-bff-request`
- `npm run check:hermes-runs-bff-events`
- `npm run check:ui-structure`
- `npm run check:agent-activity`
- `npm run check:agent-activity-rendering`
- `npm run check:workspace-state`
- `npm run check:brain-memory-client`
- `npm run check:tenant-scope`
- `npm run typecheck`
- `npm run build`
- `npm audit --audit-level=moderate`

## Next Recommended Slice

Slice 16T: production Runs BFF lifecycle dry-run contract and no-runtime
source guard.

Reason: Agent access policy fixtures are now guarded without UI exposure. The
next safe step is to specify the disabled production Runs lifecycle dry run for
submit, event stream, terminal reconciliation, stop, and approval without
calling Hermes from the production route.
