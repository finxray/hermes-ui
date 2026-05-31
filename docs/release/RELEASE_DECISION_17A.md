# Release Decision 17A - MVP Completion Audit

Candidate: Hermes UI / Brain Memory Studio local MVP/demo RC
Decision date: 2026-05-31
Decision commit at audit start: `6ecea07 test: add disabled Runs response fixtures`

## Decision

Conditionally complete.

The current product is MVP-complete for a local/demo RC after the safe non-live
gate passes. Browser and live-service claims remain conditional on a healthy
selected Web UI base URL and intentionally running Hermes/Brain Memory services.

This is not a production public release, not a production installer, and not a
final one-command GitHub bundle.

## Current MVP Execution Path

Production chat still uses the session stream:

```text
Browser -> Web UI BFF /api/hermes/chat/stream -> Hermes session stream
```

Runs production implementation remains deferred/post-MVP. The production-shaped
Runs route remains disabled HTTP 501 and guarded by Slice 16U fixtures and the
migration gate.

## MVP Includes

- Local Web UI shell and project/session workspace.
- Hermes session-stream chat through the BFF when Hermes is running.
- Stop/cancel through current client/BFF stream abort.
- Rich markdown/code rendering.
- Agent activity blocks and command/tool/memory event rendering.
- Read-only Brain Memory status/search/detail/timeline through BFF routes.
- Tenant/project/session scope diagnostics and checks.
- Local run history and persisted replay summaries.
- Launcher, doctor, stale-server recovery, packaging, and RC docs.
- Scalable-loading measurement decision.
- Runs guardrail track safely parked.

## MVP Defers

- Production Runs default or production Runs route implementation.
- Agent access selector UI.
- Approval buttons and approval action routes.
- Memory mutation/admin UI.
- Export/import.
- Provider/model runtime switching.
- Artifact upload/download.
- Automatic/manual context compaction runtime.
- Cross-channel discovery.
- Production installer and one-command GitHub bundle.

## Required Decision Gates

Default source/build/audit gate:

```powershell
npm run release:check
npm run check:packaging
npm run check:brain-memory-regression-index
npm run check:hermes-runs-bff-request
npm run check:hermes-runs-bff-events
npm run check:hermes-runs-lifecycle
npm run check:agent-access-policy
npm run typecheck
npm run build
npm audit --audit-level=moderate
```

Browser/live gates are listed in
`docs/release/FINAL_MVP_LIVE_SMOKE_CHECKLIST_17A.md`.

## 17A Gate Result

The default source/build/audit gate passed on 2026-05-31.

Live and browser gates were not claimable in this run because no Web UI server
was reachable on ports 3000-3007. Hermes direct `/health` was reachable, but
Hermes BFF status/chat and Brain Memory BFF status/search/inspect require a
healthy Web UI server. Brain Memory real Gateway mode and tenant read keys were
not configured.

## Known Limitations

- Live Hermes evidence is unavailable unless Hermes is running and reachable
  through the Web UI BFF.
- Live Brain Memory evidence is unavailable unless Gateway and tenant read keys
  are configured.
- Brain Memory mock/unconfigured mode is acceptable for default local MVP, but
  it is not live Gateway proof.
- Stop/cancel is not server-side Runs stop in the production chat path.
- Approval UI is display-only.
- Export preview is local display-only and not durable export/import.

## Next Recommended Slice

Slice 17B: final RC browser/live smoke run and decision record.

Reason: 17A establishes the MVP completion audit and final checklist. The next
step should be an environment-specific smoke pass and decision record, not new
runtime feature work.
