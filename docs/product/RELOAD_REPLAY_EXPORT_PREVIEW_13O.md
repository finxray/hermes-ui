# Reload Replay Smoke And Export Preview 13O

Date: 2026-05-31

## Purpose

Slice 13O proves that local run/activity replay survives a browser reload and
exposes the existing safe session export shape as a collapsed, local-only
preview in the Context rail.

This slice does not add backend persistence, cloud backup, import, copy,
download, command rerun, agent re-execution, direct browser-to-Hermes calls,
direct browser-to-Brain Memory calls, or storage access.

The architecture remains:

```text
Browser UI -> Next.js BFF -> Hermes API server / Brain Memory Gateway UI API
```

## Files Changed

- `apps/web/src/lib/persistedActivityReplay.ts`
- `apps/web/src/components/shell/ContextRail.tsx`
- `apps/web/src/components/shell/ContextRail.module.css`
- `scripts/ui-interaction-smoke.mjs`
- `scripts/check-workspace-state.mjs`
- `scripts/check-agent-activity-events.mjs`
- `scripts/check-agent-activity-rendering.mjs`
- `package.json`
- `docs/product/RELOAD_REPLAY_EXPORT_PREVIEW_13O.md`
- `docs/product/PERSISTED_ACTIVITY_REPLAY_13N.md`
- `docs/product/AGENT_ORCHESTRATION_SLICE_PLAN.md`
- `ROADMAP.md`

## Reload Replay Smoke

`npm run smoke:ui:replay` runs:

```text
node scripts/ui-interaction-smoke.mjs --replay-test --require-hermes
```

Behavior:

- uses an isolated Playwright browser context;
- requires `/api/hermes/status` to report `mode=real` and `reachable=true`;
- sends one unique `UI_SMOKE_REPLAY_*` message through the normal composer;
- waits for a non-empty assistant response from the existing BFF streaming
  path;
- verifies run history shows a completed Web UI run;
- verifies persisted replay is visible before reload;
- reloads the page in the same browser context;
- verifies the selected session still shows the unique user message;
- verifies run history and persisted replay are still present after hydration;
- verifies the replay is not empty when activity exists;
- verifies the local export preview remains visible;
- checks for horizontal overflow before and after reload;
- checks that credential-like visible strings are not present.

The default `npm run smoke:ui` remains non-mutating and does not send a
message. Live send and stop smokes keep their existing opt-in behavior.

## Export Preview UI

The Context tab now includes an `Export preview` section under `Run history`.

Behavior:

- shows `Local preview only`;
- displays active session title and updated timestamp;
- displays message count, run count, persisted replay event count, and excluded
  field count;
- lists the excluded field classes;
- renders a collapsed `Preview JSON` details block by default;
- uses the session `updatedAt` value as the visible preview timestamp so
  server-rendered and hydrated markup stay stable;
- reads only the active in-memory/local workspace session state;
- performs no backend call;
- performs no filesystem write;
- starts no copy/download flow.

## Export Includes

The preview uses `createSessionExportPreview(activeSession)` and includes:

- export version and generated timestamp;
- active session id, project id, Hermes session id, title, summary, created
  timestamp, and updated timestamp;
- active session memory scope;
- session messages;
- run records;
- bounded persisted activity replay snapshots for each run;
- explicit excluded-field labels.

## Export Excludes

The preview excludes or redacts:

- API keys and credentials;
- full raw Hermes payloads;
- full stdout/stderr/output beyond bounded previews;
- binary/blob data;
- direct service URLs with secrets.

The preview helper now redacts bearer strings and common inline secret
assignments such as `token=...`, `api_key=...`, `password=...`, and
`secret=...` across the generated preview object.

## Copy And Download

No copy button, download button, automatic download, blob URL, filesystem write,
or backend export endpoint was added in this slice. The JSON is inspectable
inside a collapsed native details block only.

## Safety

- Persisted replay remains display-only.
- Run history selection does not call Hermes or Brain Memory.
- The replay smoke sends only through the existing Web UI composer and BFF
  stream route.
- The browser still does not call Hermes or Brain Memory Gateway directly.
- The UI still does not read or write direct storage backends.
- No mutation/admin memory action was added.
- No command execution or rerun behavior was added.

## Regression Coverage

Added or extended coverage:

- workspace-state check verifies export preview shape, replay count, excluded
  labels, and redaction;
- agent activity checks verify stronger persisted replay redaction;
- rendering checks verify the Context rail export preview is display-only and
  lacks copy/download/network/execution behavior;
- UI smoke verifies the export preview exists and JSON is collapsed by default;
- replay smoke verifies live-send replay survives reload in an isolated browser
  context.

## Known Remaining Issues

- The export preview is not a backup format or import contract.
- There is no copy/download action yet.
- The replay smoke requires live Hermes; it does not fake success when Hermes is
  unavailable.
- Existing pre-13N runs can show run metadata with empty persisted replay.
- Cross-channel run discovery remains deferred.

## Deferred Features

- full auth/classification model;
- production one-command CLI;
- durable evidence/supersession storage;
- memory mutation/admin actions;
- provider/model selector polish;
- further UI polish;
- safe export copy/download and import validation.

## Next Recommended Slice

Slice 13P - Local Export Download And Import Validation Contract.

Reason: Slice 13O makes the local export shape visible and reload-tested. The
next useful step is to define and validate a safe local file export/import
contract before adding any durable backup, cloud sync, or backend persistence.
