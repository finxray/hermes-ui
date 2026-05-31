# Hermes Runs Disabled Route Validation And Agent Access 16R

Date: 2026-05-31
Base commit before this slice: `c14a041 test: add disabled Runs request validation contract`

## Purpose

Slice 16R connects the disabled production-shaped Runs route to the pure request
validator and documents the future Agent access approval policy. The route can
now parse a request body and return a redacted validation posture, but it still
does not execute, stream, create a run, call Hermes, call Brain Memory Gateway,
read service env values, import the memory scope bridge, or touch storage.

Production chat still uses `/api/hermes/chat/stream`.

## Disabled Route Validation Echo

`POST /api/hermes/runs/chat/stream` still returns disabled JSON:

- HTTP 501
- `ok: false`
- `mode: "disabled"`
- `reason: "production_runs_route_not_enabled"`
- `status: "not_implemented"`
- `sessionStreamDefault: true`
- `sessionStreamRoute: "/api/hermes/chat/stream"`
- `experimentalRoute: "/api/hermes/runs/experimental-chat"`

The response now includes:

```ts
requestValidation: {
  attempted: true;
  ok: boolean;
  errorKinds: string[];
  errors: Array<{ kind: string; path: string }>;
  futureFields: {
    agentAccessMode: "metadata_only";
    model: "inert_until_client_selectable";
    provider: "inert_until_supported";
  };
  rawRequestEchoed: false;
}
```

The response also includes the execution posture:

```ts
execution: {
  hermesRunCreated: false;
  hermesCalled: false;
  brainMemoryCalled: false;
  eventStreamStarted: false;
  approvalCalled: false;
  stopCalled: false;
  storageAccess: false;
}
```

The older flat disabled flags remain for compatibility with existing checks.

## Status Code Choice

The route keeps HTTP 501 for valid and invalid bodies because the route is
disabled regardless of request validity. Validation posture is diagnostic only;
it is not runtime execution readiness.

Invalid bodies report safe error kinds such as `invalid_agent_access_mode`,
`missing_memory_scope`, or `forbidden_credential_field`. The route does not
echo raw message content, oversized text, credentials, bearer values, API keys,
or raw request bodies.

## Route Guard Behavior

`npm run smoke:hermes:runs:route-guard` verifies:

- valid future request returns disabled HTTP 501 and
  `requestValidation.ok: true`;
- invalid future request returns disabled HTTP 501 and validation error kinds;
- forbidden credential field returns disabled HTTP 501 and
  `forbidden_credential_field`;
- no `runId` or `hermesRunId` is returned;
- no `text/event-stream` response is started;
- execution flags stay false;
- the route source has no Hermes/Gateway/storage/env/fetch/memory-bridge path.

Without a base URL, the guard remains source-only.

## Request Validation Posture

The disabled route imports only the pure validator:

- `validateHermesRunsBffRequest`
- request validation types

It does not import:

- Hermes client helpers;
- Brain Memory client helpers;
- memory scope bridge helpers;
- service env secrets;
- browser storage or server storage helpers;
- network fetch calls;
- `/v1/runs` or `/api/sessions` execution paths.

## Agent Access Policy Summary

`docs/architecture/AGENT_ACCESS_APPROVAL_POLICY_16R.md` defines future modes:

| Label | Request value | Summary |
| --- | --- | --- |
| Chat only | `chat_only` | Assistant text only; no tools or memory writes. |
| Read-only tools | `read_only_tools` | Read/search/status/detail only; no writes, commands, mutations, or side effects. |
| Ask before tools | `ask_before_tools` | Tool/action requests require approval through the BFF. |
| Full access | `full_access` | Configured policy access without per-action prompts; not unrestricted system access. |
| Custom | `custom` | Future policy profile. |

The current `agentAccessMode` field is still inert/future metadata. The
disabled route validates the enum but does not enforce policy.

## Enforcement Ownership

| Layer | Future responsibility |
| --- | --- |
| Browser | Display a selected mode only when enforcement exists; never present decorative access UI. |
| Web UI BFF | Validate mode, scope, run ownership, approval choices, and forward enforceable policy to Hermes. |
| Hermes Runs | Enforce run tool/approval behavior and own active approval sessions. |
| Brain Memory Gateway | Enforce memory tenant/project/session/key boundaries and remain the memory authority. |

No UI should claim `Full access`, `Ask before tools`, or any other mode until
BFF/Hermes enforcement exists.

## Files Changed

- `apps/web/src/app/api/hermes/runs/chat/stream/route.ts`
- `scripts/hermes-runs-production-route-guard.mjs`
- `scripts/check-hermes-runs-bff-request.mjs`
- `scripts/check-ui-structure.mjs`
- `docs/architecture/AGENT_ACCESS_APPROVAL_POLICY_16R.md`
- `docs/checkpoints/HERMES_RUNS_DISABLED_ROUTE_VALIDATION_AND_AGENT_ACCESS_16R.md`
- `docs/checkpoints/HERMES_RUNS_REQUEST_VALIDATION_16Q.md`
- `docs/architecture/HERMES_RUNS_BFF_EVENT_CONTRACT_16N.md`
- `docs/architecture/HERMES_RUNS_EXECUTION_STATE_MACHINE_16M.md`
- `docs/product/APPROVALS_UX_13H.md`
- `docs/product/AGENT_ORCHESTRATION_SLICE_PLAN.md`
- `ROADMAP.md`

## Non-Goals

- No production Runs execution.
- No production chat switch to Runs.
- No change to `/api/hermes/chat/stream`.
- No production Runs composer switch.
- No composer Agent access selector UI.
- No approval buttons.
- No Hermes run creation.
- No Hermes API call from the disabled route.
- No Brain Memory Gateway call from the disabled route.
- No memory scope bridge import from the disabled route.
- No service env secret read from the disabled route.
- No event streaming from the disabled route.
- No direct browser-to-Hermes path.
- No direct browser-to-Brain Memory Gateway path.
- No direct storage access.
- No Brain Memory BFF change.
- No memory scope bridge behavior change.
- No project/session stable-key change.
- No tenant-check loosening.
- No provider/model switching.
- No export/import.
- No Hermes or Brain Memory source change.

## Checks Run

Required checks for this slice:

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

Slice 16S: disabled Runs policy fixture matrix and source-only Agent access
rendering guard.

Reason: 16R adds validation echo and the policy contract without runtime
execution or UI selector work. The next safe step is pure policy fixtures that
map each future mode to allowed, blocked, and approval-required capabilities
before any composer UI appears.
