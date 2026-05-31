# Hermes Runs Request Validation 16Q

Date: 2026-05-31
Base commit before this slice: `804215e test: add disabled Runs route guard`

## Purpose

Slice 16Q defines and checks the future request validation contract for
`POST /api/hermes/runs/chat/stream` while keeping the production-shaped route
disabled. This is a contract/check slice only. It does not execute Runs, call
Hermes, call Brain Memory Gateway, stream events, or switch the composer.

Production chat still uses `/api/hermes/chat/stream`.

## Future Request Schema

`apps/web/src/types/hermesRunsBffRequest.ts` defines:

- `HermesRunsBffRequest`
- `HermesRunsBffMemoryScope`
- `HermesRunsBffRequestOptions`
- `HermesRunsBffAgentAccessMode`
- `HermesRunsBffRequestValidationResult`
- `HermesRunsBffRequestValidationError`

The future request shape requires:

- `projectId: string`
- `sessionId: string`
- `message: string`
- `memoryScope.tenantId`
- `memoryScope.stableProjectKey`
- `memoryScope.stableSessionKey`
- `memoryScope.includeProjectContext`
- `memoryScope.includeSessionContext`

Future-only fields are typed but not executable:

- `agentAccessMode`: `chat_only`, `read_only_tools`, `ask_before_tools`,
  `full_access`, or `custom`
- `provider`
- `model`
- `options.stream`
- `options.includeActivity`
- `options.includeReplayPreview`
- `options.timeoutMs`

The `agentAccessMode` field is metadata only. provider/model are accepted as
inert future metadata and do not imply runtime switching.

## Validation Helper

`apps/web/src/lib/hermesRunsBffRequestValidation.ts` adds
`validateHermesRunsBffRequest`.

The helper validates shape only:

- body must be an object;
- project id, session id, and message are required;
- message length is bounded by `HERMES_RUNS_BFF_MAX_MESSAGE_CHARS`;
- `memoryScope` is required;
- tenant id, stable project key, and stable session key are required;
- `includeProjectContext` and `includeSessionContext` must be booleans;
- `agentAccessMode` must be one of the known future enum values;
- `timeoutMs` must be inside the dry-run bounds;
- credential-like fields are rejected with `forbidden_credential_field`;
- provider/model are normalized as inert future metadata.

The helper returns either `ok: true` with a normalized request or `ok: false`
with safe validation errors. It has no network calls, no env reads, no Hermes
client import, no Brain Memory client import, no storage access, no memory
scope bridge import, and no side effects.

## Fixtures And Checks

`apps/web/src/data/hermesRunsBffRequestFixtures.ts` adds
`hermesRunsBffValidMinimalRequest` plus invalid fixture cases for:

- valid minimal request;
- valid request with future `agentAccessMode`;
- valid provider/model future-field request;
- `missing_project_id`;
- `missing_memory_scope`;
- `invalid_agent_access_mode`;
- `message_too_large`;
- forbidden credential field;
- out-of-range timeout;
- invalid memory scope flags.

`npm run check:hermes-runs-bff-request` verifies:

- valid fixtures pass validation;
- invalid fixtures fail with expected error kinds;
- forbidden credential-like fields are rejected;
- provider/model are accepted as inert future metadata;
- validation source has no network/service/env/storage/route/bridge code;
- the disabled route still returns HTTP 501 and does not call the validator,
  Hermes, Gateway, env, storage, or memory scope bridge;
- production session stream remains present;
- no production Runs composer switch exists;
- composer Agent access selector was not implemented yet.

## Disabled Route Behavior

`POST /api/hermes/runs/chat/stream` still returns the Slice 16P disabled
contract response:

- HTTP 501
- `ok: false`
- `mode: "disabled"`
- `reason: "production_runs_route_not_enabled"`
- `status: "not_implemented"`
- `sessionStreamDefault: true`
- `hermesRunCreated: false`
- `hermesCalled: false`
- `brainMemoryCalled: false`
- `eventStreamStarted: false`
- `approvalCalled: false`
- `stopCalled: false`
- `composerRunsSwitch: false`
- direct browser service paths remain false
- direct storage access remains false

The route does not parse, validate, or execute the request in this slice. That
keeps disabled behavior stable while the validator is tested separately.

## Route Guard Behavior

`npm run smoke:hermes:runs:route-guard` now sends a valid future request body
when a `--base-url` is supplied, including `memoryScope`, future
`agentAccessMode`, provider/model, and options. The expected result remains the
same disabled HTTP 501 JSON. The guard also verifies no run id, Hermes run id,
event stream, validation result, or validation errors are returned by the
disabled route.

Without a base URL, the route guard remains source-only and does not fake a
live Web UI result.

## Non-Goals

- No production Runs execution.
- No Hermes run creation.
- No Hermes API call from the disabled route.
- No Brain Memory Gateway call from the disabled route.
- No memory scope bridge import from the disabled route.
- No service env secret read from the disabled route.
- No SSE/event stream from the disabled route.
- No change to `/api/hermes/chat/stream`.
- No production Runs composer switch.
- No production composer Runs selector.
- No composer Agent access selector.
- No approval buttons.
- No provider/model switching.
- No direct browser-to-Hermes path.
- No direct browser-to-Brain Memory Gateway path.
- No direct storage access.
- No Brain Memory BFF change.
- No memory scope bridge behavior change.
- No project/session stable-key change.
- No tenant-check loosening.
- No memory mutation/admin action.
- No Hermes or Brain Memory source change.

## Files Changed

- `apps/web/src/types/hermesRunsBffRequest.ts`
- `apps/web/src/lib/hermesRunsBffRequestValidation.ts`
- `apps/web/src/data/hermesRunsBffRequestFixtures.ts`
- `scripts/check-hermes-runs-bff-request.mjs`
- `scripts/hermes-runs-production-route-guard.mjs`
- `scripts/check-ui-structure.mjs`
- `package.json`
- `docs/checkpoints/HERMES_RUNS_REQUEST_VALIDATION_16Q.md`
- `docs/checkpoints/HERMES_RUNS_DISABLED_ROUTE_GUARD_16P.md`
- `docs/architecture/HERMES_RUNS_BFF_EVENT_CONTRACT_16N.md`
- `docs/architecture/HERMES_RUNS_EXECUTION_STATE_MACHINE_16M.md`
- `docs/product/AGENT_ORCHESTRATION_SLICE_PLAN.md`
- `ROADMAP.md`

## Next Recommended Slice

Slice 16R: disabled route validation echo contract, still HTTP 501 and no
execution.

Reason: the pure validator is now covered without changing disabled route
behavior. The next safe step is to let the disabled route parse the body and
return a redacted validation summary while still returning HTTP 501, creating
no run, calling no services, and preserving the session stream default.
