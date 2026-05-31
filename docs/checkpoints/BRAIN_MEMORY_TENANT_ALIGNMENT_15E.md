# Slice 15E: Brain Memory Tenant Alignment

Date: 2026-05-31

Base commit before this slice: `94ef24e test: add UI live Brain Memory timeline smoke`

Selected Web UI base URL: `http://127.0.0.1:3002`

## Result

Strict live tenant alignment passed.

The live UI-driven Brain Memory timeline smoke now uses the same local tenant
from browser workspace state, Hermes MCP, and Gateway read/search/inspect:
`local-dev`.

No Brain Memory mutation/admin UI was added. No direct browser-to-Gateway,
browser-to-Hermes, or direct storage access was added. No tenant checks were
loosened, no wildcard assumption was added to product code, and no env files or
secrets were committed.

## Root Cause

Slice 15D exposed a local tenant mismatch:

- Web UI mock/local workspace defaults used `tenant-local`.
- Hermes Brain Memory MCP was running with
  `BRAIN_MEMORY_DEFAULT_TENANT_ID=local-dev`.
- Brain Memory Gateway local key posture included caller `local-dev` and a
  wildcard tenant allowlist for local development.

Because the project/session stable keys were already passed through the
memory-scope bridge, the stored memory had the right project/session keys but
landed under the Hermes MCP tenant, `local-dev`, not the Web UI tenant,
`tenant-local`.

## Canonical Local Tenant

`local-dev` is the canonical local MVP tenant.

Evidence:

- Earlier live Brain Memory slices used `local-dev` for deterministic
  project/session E2E checks.
- `scripts/mvp-smoke.mjs` and Brain Memory client checks already use
  `local-dev`.
- The running Hermes MCP process exposes
  `BRAIN_MEMORY_DEFAULT_TENANT_ID=local-dev`.
- The sibling Brain Memory Gateway env key posture is caller `local-dev` with
  read/write operations and local wildcard tenant allowance.

The Web UI was aligned to this existing local contract instead of changing
Hermes MCP.

## Files Changed

- `apps/web/src/data/mockWorkspace.ts`
- `apps/web/src/lib/workspaceStore.ts`
- `apps/web/src/app/design/codex-shell/page.tsx`
- `scripts/ui-interaction-smoke.mjs`
- `scripts/check-workspace-state.mjs`
- `scripts/check-agent-activity-events.mjs`
- `docs/checkpoints/BRAIN_MEMORY_TENANT_ALIGNMENT_15E.md`
- `docs/checkpoints/UI_MEMORY_TIMELINE_LIVE_SMOKE_15D.md`
- `docs/architecture/PROJECT_SESSION_MEMORY_SCOPE.md`
- `docs/product/SESSION_HISTORY_CONTRACT_13B.md`
- `docs/runbooks/MVP_LOCAL_LAUNCH_RUNBOOK.md`
- `ROADMAP.md`

## Migration And Normalization

The localStorage key and version remain unchanged:

```text
hermes-ui.workspace.v1
version: 1
```

Normalization now migrates only the legacy local default tenant:

- `tenant-local` project memory scopes normalize to `local-dev`.
- Legacy project stable keys of the exact form
  `studio:tenant-local:project:{projectId}` normalize to
  `studio:local-dev:project:{projectId}`.
- Legacy session stable keys of the exact form
  `studio:tenant-local:project:{projectId}:session:{sessionId}` normalize to
  `studio:local-dev:project:{projectId}:session:{sessionId}`.
- Project ids, session ids, display titles, title metadata, timestamps, and
  Hermes session ids are preserved.
- Non-legacy custom tenants or custom stable keys are not rewritten.

This is intentionally a narrow compatibility migration for the old local mock
tenant, not a general tenant rewrite.

## Stable Key Preservation

Project/session stable-key behavior is preserved with one intentional local
tenant segment migration:

- Stable keys remain deterministic and based on project/session ids.
- Display title changes still do not alter stable keys.
- Manual titles and first-message titles are unaffected.
- Hermes session ids are unchanged.
- New projects/sessions now receive `local-dev` stable keys from the start.

## Smoke Strictness

`npm run smoke:ui:memory-live` no longer retries under `local-dev` when the UI
tenant differs.

The strict smoke now asserts:

- the UI workspace tenant is the tenant used for BFF search;
- BFF search finds the marker in the current UI context;
- search scope tenant matches the UI tenant when the Gateway exposes it;
- search result project/session keys match the UI stable keys;
- inspect detail project/session keys match the UI stable keys;
- inspect detail scope is `matching-session`;
- inspect detail tenant matches the UI tenant when exposed;
- different-project search returns zero results.

If Gateway detail ever omits tenant, the smoke does not fake a tenant field; it
continues to verify same-context success and scope isolation through the BFF.

## Live E2E

Strict live memory smoke:

```powershell
npm run smoke:ui:memory-live -- --base-url http://127.0.0.1:3002
```

Result:

- Passed: `78`
- Warnings: `0`
- Failed: `0`

Marker:

```text
BM_UI_MEMORY_TIMELINE_15E_20260531084856_CLI24Y
```

Observed scope:

- Tenant: `local-dev`
- Project key: `studio:local-dev:project:project-brain-memory`
- Session key:
  `studio:local-dev:project:project-brain-memory:session:session-56b5f785-730a-49e9-81ec-7ebd6c8400e3`
- Inspect detail id: `7bb06f82-6f8f-4c6c-b9b9-12bbd663c6f9`
- Scope status: `matching-session`
- Different project search: `0` results

Browser result:

- App loaded.
- Old green UI markers were absent.
- Project/session sidebar, composer, settings popover, and right rail were
  visible/usable.
- Chat activity block showed Brain Memory activity.
- Right-rail Memory timeline showed the memory item.
- No horizontal overflow was detected.
- No browser console errors were captured.
- No credential-like values were visible in smoke output.

## Live Service Matrix

| Service | URL | Result |
| --- | --- | --- |
| Hermes direct health | `http://127.0.0.1:8642/health` | HTTP 200, `status=ok`, `platform=hermes-agent` |
| Hermes BFF status | `http://127.0.0.1:3002/api/hermes/status` | HTTP 200, `mode=real`, `reachable=true` |
| Brain Memory Gateway health | `http://127.0.0.1:8080/health` | HTTP 200, `status=ok`, version `0.1.0-rc.1`, Postgres `ok` |
| Brain Memory BFF status | `http://127.0.0.1:3002/api/brain-memory/status` | HTTP 200, `mode=real`, `reachable=true` |

## Check Matrix

| Check | Result |
| --- | --- |
| `npm run smoke:ui:memory-live -- --base-url http://127.0.0.1:3002` | Pass, 78 passed, 0 warnings |
| `node scripts/mvp-smoke.mjs --require-hermes --require-brain-memory --base-url http://127.0.0.1:3002` | Pass, 39 passed |
| `npm run smoke:ui:send -- --base-url http://127.0.0.1:3002` | Pass, 64 passed |
| `npm run smoke:ui:stop -- --base-url http://127.0.0.1:3002` | Pass, 67 passed |
| `npm run check:workspace-state` | Pass |
| `npm run check:brain-memory-client` | Pass |
| `npm run check:agent-activity` | Pass, 26 checks |
| `npm run check:agent-activity-rendering` | Pass, 34 checks |
| `STUDIO_WEB_UI_URL=http://127.0.0.1:3002 npm run studio:doctor` | Pass; BFF Hermes and Brain Memory connected |
| `npm run check:ui-structure` | Pass |
| `npm run typecheck` | Pass |
| `npm run build` | Pass |
| `npm audit --audit-level=moderate` | Pass, 0 vulnerabilities |

## Cleanup

The temporary Web UI process on `3002` should be stopped after commit. Hermes
on `8642` and Brain Memory Gateway on `8080` are live services and should be
left running.

## Remaining Limitations

- Gateway local development still has a wildcard tenant allowance in the
  sibling Brain Memory env, but the Web UI and smoke no longer rely on fallback
  tenant behavior.
- Studio workspace state is still browser localStorage for MVP.
- Full auth/classification, durable evidence/supersession storage, memory
  mutation/admin actions, export/import, and production one-command packaging
  remain deferred.

## Follow-up

Slice 15F added the read-only tenant/scope diagnostics readout and developer
check recommended here. See
`docs/checkpoints/TENANT_SCOPE_DIAGNOSTICS_15F.md`.
