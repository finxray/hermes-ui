# Slice 15F: Tenant Scope Diagnostics

Date: 2026-05-31

Base commit before this slice: `10fd053 fix: align Brain Memory tenant scope for live UI`

Selected Web UI base URL: `http://127.0.0.1:3002`

## Result

Added a read-only tenant/scope diagnostics baseline for the MVP shell.

The Context rail now exposes a collapsed "Tenant / scope diagnostics" readout
that compares the active Web UI tenant, project stable key, session stable key,
Hermes status, Brain Memory BFF status, and redacted server-side key posture.
The developer check `npm run check:tenant-scope` verifies the same model,
legacy `tenant-local` normalization, redaction, and source boundaries.

No tenant checks were loosened. No Brain Memory mutation/admin UI was added. No
direct browser-to-Gateway, browser-to-Hermes, or storage path was added. No env
files or secrets were committed.

## Diagnostics Model

The shared model is implemented in `apps/web/src/lib/tenantScopeDiagnostics.ts`.
It is pure local shape logic with no `fetch`.

Inputs:

- active project and session memory scope from browser workspace state;
- normalized Hermes status from the existing BFF-backed status hook;
- normalized Brain Memory status from the existing BFF-backed status hook;
- optional redacted posture from `/api/tenant-scope/diagnostics`.

Checks:

- Web UI tenant equals canonical local MVP tenant `local-dev`;
- project stable key contains the active tenant segment;
- session stable key contains the active tenant segment when a session exists;
- Brain Memory BFF does not report real mode while unreachable;
- Hermes memory-scope instruction bridge status is surfaced as a warning when
  inactive or still loading.

The model reports `aligned`, `watch`, or `drift` in the UI based on warnings
and errors. It does not change runtime behavior.

## UI Readout Behavior

The readout appears in the Context tab of the right rail and is collapsed by
default under a native `details` disclosure.

Displayed fields:

- Tenant;
- Project key;
- Session key;
- Hermes session;
- Brain Memory BFF mode/reachability;
- Hermes reachability;
- Scope bridge state;
- Gateway memory key state;
- Allowed tenants summary.

The readout is display-only. It does not include actions, memory mutations,
admin operations, direct service links, or storage access.

## Redaction Behavior

The browser receives only redacted posture:

- `gatewayMemoryKeySet`: boolean;
- `uiApiKeySet`: boolean;
- `mcpApiKeySet`: boolean;
- `allowedTenantsSummary`: compact summary such as `wildcard`.

The BFF route reads only Web UI process env and returns `Cache-Control:
no-store`. It does not expose API keys, raw `GATEWAY_MEMORY_API_KEYS`, raw MCP
env, or Gateway storage data.

Live route probe on this slice returned:

```json
{
  "redactedPosture": {
    "allowedTenantsSummary": "wildcard",
    "gatewayMemoryKeySet": true,
    "mcpApiKeySet": false,
    "uiApiKeySet": false
  }
}
```

`mcpApiKeySet` was `false` in the Web UI route because the temporary Web UI
process did not receive `BRAIN_MEMORY_MCP_API_KEY_SET=true`. The developer
check separately observes the live WSL Hermes MCP posture when available and
asserts the MCP tenant is `local-dev` without printing the key.

## Developer Check Behavior

`npm run check:tenant-scope` verifies:

- default Web UI tenant is `local-dev`;
- exact legacy local `tenant-local` stable keys normalize to `local-dev`;
- custom tenant stable keys are preserved;
- diagnostics model is green for the live MVP shape;
- memory-scope bridge instruction includes context tenant/project/session;
- redacted posture never serializes supplied secret strings;
- diagnostics source has no direct fetch;
- diagnostics BFF route does not read raw `GATEWAY_MEMORY_API_KEYS`;
- UI live smoke still asserts strict same-tenant Brain Memory search/detail;
- optional observable live posture has Hermes MCP tenant `local-dev` and a
  Gateway local-dev read-capable key posture.

The script prints only:

```text
Tenant scope diagnostics checks passed.
```

## Live Service Matrix

| Service | URL | Result |
| --- | --- | --- |
| Hermes direct health | `http://127.0.0.1:8642/health` | HTTP 200, `status=ok`, `platform=hermes-agent` |
| Brain Memory Gateway health | `http://127.0.0.1:8080/health` | HTTP 200, `status=ok`, version `0.1.0-rc.1`, Postgres `ok` |
| Hermes BFF status | `http://127.0.0.1:3002/api/hermes/status` | HTTP 200, `mode=real`, `reachable=true`, `configured=true` |
| Brain Memory BFF status | `http://127.0.0.1:3002/api/brain-memory/status` | HTTP 200, `mode=real`, `reachable=true`, `configured=true` |
| Tenant diagnostics BFF | `http://127.0.0.1:3002/api/tenant-scope/diagnostics` | HTTP 200, redacted booleans/summary only |

## Browser Smoke

Full Playwright live smoke:

```powershell
npm run smoke:ui:memory-live -- --base-url http://127.0.0.1:3002
```

Result:

- Passed: `84`
- Warnings: `0`
- Failed: `0`

Observed:

- app loaded;
- old green UI markers absent;
- project/session sidebar visible;
- composer visible;
- right rail and settings popover usable;
- tenant/scope diagnostics visible in Context tab;
- diagnostics showed `local-dev`;
- diagnostics showed no tenant mismatch/drift warning;
- live Brain Memory marker was stored, found through BFF search, and inspected
  in the matching project/session scope;
- different-project search returned `0` results;
- no horizontal overflow;
- no browser console errors.

In-app browser spot check at a narrow viewport hydrated the production root,
showed local `local-dev` scope text, preserved old-green-UI removal, and had no
horizontal overflow. The full right-rail diagnostics behavior was verified by
the scripted 1440px browser smoke above.

## Check Matrix

| Check | Result |
| --- | --- |
| `npm run check:tenant-scope` | Pass |
| `node --check scripts/check-tenant-scope-diagnostics.mjs` | Pass |
| `node --check scripts/ui-interaction-smoke.mjs` | Pass |
| `node --check scripts/mvp-smoke.mjs` | Pass |
| `npm run smoke:ui:memory-live -- --base-url http://127.0.0.1:3002` | Pass, 84 passed |
| `node scripts/mvp-smoke.mjs --require-hermes --require-brain-memory --base-url http://127.0.0.1:3002` | Pass, 40 passed |
| `npm run check:workspace-state` | Pass |
| `npm run check:brain-memory-client` | Pass |
| `npm run check:agent-activity` | Pass, 26 checks |
| `npm run check:agent-activity-rendering` | Pass, 34 checks |
| `STUDIO_WEB_UI_URL=http://127.0.0.1:3002 npm run studio:doctor` | Pass; BFF Hermes and Brain Memory connected |
| `npm run check:ui-structure` | Pass |
| `npm run typecheck` | Pass |
| `npm run build` | Pass |
| `npm audit --audit-level=moderate` | Pass, 0 vulnerabilities |

One parallel MVP smoke run timed out on the Hermes stream while the heavier
live browser smoke was sending a live memory message. The same MVP command was
rerun by itself and passed with `40` checks, so the final recorded result is
pass.

## Files Changed

- `apps/web/src/app/api/tenant-scope/diagnostics/route.ts`
- `apps/web/src/components/shell/AppShell.tsx`
- `apps/web/src/components/shell/ContextRail.module.css`
- `apps/web/src/components/shell/ContextRail.tsx`
- `apps/web/src/hooks/useTenantScopeDiagnosticsPosture.ts`
- `apps/web/src/lib/tenantScopeDiagnostics.ts`
- `scripts/check-tenant-scope-diagnostics.mjs`
- `scripts/mvp-smoke.mjs`
- `scripts/ui-interaction-smoke.mjs`
- `package.json`
- `docs/checkpoints/TENANT_SCOPE_DIAGNOSTICS_15F.md`
- `docs/checkpoints/BRAIN_MEMORY_TENANT_ALIGNMENT_15E.md`
- `docs/runbooks/MVP_LOCAL_LAUNCH_RUNBOOK.md`
- `ROADMAP.md`

## Cleanup

The temporary Web UI process on `3002` should be stopped after commit. Hermes
on `8642` and Brain Memory Gateway on `8080` are live services and should be
left running.

## Remaining Limitations

- The diagnostics route can only expose MCP key posture when the Web UI process
  is explicitly given a redacted boolean such as
  `BRAIN_MEMORY_MCP_API_KEY_SET=true`.
- Gateway local development still uses a wildcard tenant allowance in the
  sibling Brain Memory env; product code does not rely on wildcard fallback.
- Studio workspace state remains browser localStorage for MVP.
- Full auth/classification, durable evidence/supersession storage, memory
  mutation/admin actions, real stop/cancel streaming, provider/model selector
  polish, export/import, and production one-command packaging remain deferred.

## Next Recommended Slice

Slice 15G: broaden the read-only regression suite to cover multi-session memory
scope isolation and session switching without adding mutation/admin actions.
