# MVP RC Notes

Date: 2026-05-31

These notes summarize the current MVP release-candidate posture for Hermes UI /
Brain Memory Studio. This is a local MVP/demo candidate, not a production
installer and not the final one-command GitHub distribution.

## Current MVP Summary

The Studio now has a Codex-style production shell, stable local
project/session state, Hermes streaming through the Web UI BFF, read-only Brain
Memory inspection paths through the BFF, rich assistant rendering, activity
timeline foundations, local run replay, launcher diagnostics, and a safe
release gate.

The app remains intentionally local-first. Browser code calls the Web UI BFF;
the BFF calls Hermes and Brain Memory Gateway where configured. Hermes remains
the agent runtime. Brain Memory Gateway remains the memory authority.

## Claim Levels

### Default Local MVP Claims

The default local MVP claim is valid after the safe non-live gate passes:

- the Web UI can run locally;
- Hermes is optional unless a live Hermes gate is run;
- Brain Memory can be mock, disabled, or unconfigured;
- read-only Brain Memory UI surfaces are safe in mock/unconfigured mode;
- browser code calls only the Web UI BFF;
- no direct storage access is used.

Default mode does not prove live Hermes streaming or live Brain Memory Gateway
search/inspect.

### Browser Smoke Claims

Browser smoke claims are valid only against a healthy selected base URL. Use the
same selected URL for all browser checks.

```powershell
npm run smoke:ui -- --base-url http://127.0.0.1:<port>
npm run smoke:markdown -- --base-url http://127.0.0.1:<port>
npm run smoke:markdown:long -- --base-url http://127.0.0.1:<port>
npm run smoke:memory-detail -- --base-url http://127.0.0.1:<port>
```

`smoke:memory-detail` is deterministic and non-live. It verifies the read-only
detail fixture without requiring Hermes or Brain Memory Gateway.

### Live Hermes Claims

Live Hermes claims require Hermes to be real/reachable through the Web UI BFF:

```powershell
npm run smoke:ui:send -- --base-url http://127.0.0.1:<port>
npm run smoke:ui:stop -- --base-url http://127.0.0.1:<port>
node scripts/mvp-smoke.mjs --require-hermes --base-url http://127.0.0.1:<port>
```

If Hermes is absent, record that state as unconfigured or not running. Do not
claim live Hermes behavior.

### Live Brain Memory Claims

Live Brain Memory claims require Hermes, Brain Memory Gateway, and the
tenant-bound memory read key to be intentionally configured. They are covered
by `docs/product/BRAIN_MEMORY_READ_ONLY_QA_GATE_15L.md`.

```powershell
npm run smoke:ui:memory-live -- --base-url http://127.0.0.1:<port>
npm run smoke:ui:memory-scope -- --base-url http://127.0.0.1:<port>
node scripts/mvp-smoke.mjs --require-hermes --require-brain-memory --base-url http://127.0.0.1:<port>
```

Live Brain Memory claims must name the selected base URL and whether Hermes and
Brain Memory Gateway were real/reachable through the BFF.

## Highlights

- Codex-style Hermes UI shell replaces the old green UI.
- Hermes chat/status flow remains behind the Web UI BFF.
- Session-stream stop/cancel is supported through client/BFF abort, with an
  honest cancelled activity row.
- `AgentActivityEvent` foundations power Codex-like orchestration blocks.
- Thinking and elapsed-time UX provide live progress without exposing private
  reasoning labels.
- Approval events are display-only and do not add approve/deny actions.
- Files/Artifacts panel foundation is read-only and local/mock where needed.
- Brain Memory event timeline derives read-only memory activity from normalized
  events.
- Command execution details render collapsed, redacted previews.
- Run history, session replay, persisted activity replay, and local export
  preview foundations are present.
- Rich markdown renderer covers GFM, code blocks, tables, links, copy actions,
  and long-message performance fixtures.
- Launcher diagnostics cover selected base URLs, stale servers, static chunks,
  recovery guidance, Web UI-only start checks, and safety boundaries.
- Packaging readiness and release gates are documented.

## Current Feature Status

| Area | Status | Notes |
| --- | --- | --- |
| Web UI shell | MVP ready | Production root uses the current Codex-style shell. |
| Project/session state | MVP ready | Local stable keys and session replay foundations are present. |
| Hermes status and streaming | MVP ready when Hermes is running | Browser calls only BFF routes. |
| Stop/cancel | Partial MVP | Aborts current session-stream path; does not claim server-side Runs API stop. |
| Agent activity timeline | MVP foundation | Normalized display model with redacted details. |
| Approvals | Display-only | No approve/deny route or mutation controls. |
| Files/Artifacts | Foundation only | Read-only/local mock preview; no real upload/download. |
| Brain Memory status/search/detail | Optional/read-only | Mock/unconfigured mode is valid when Gateway is absent. |
| Brain Memory timeline | MVP foundation | Derived from read-only event/activity surfaces. |
| Rich markdown rendering | MVP ready | Fixture and long-fixture smokes cover the renderer. |
| Launcher diagnostics | MVP ready | Safe, non-destructive local diagnostics and Web UI-only start wrapper. |
| Release gate | MVP ready | Safe non-browser checks under `npm run release:check`. |

## Known Limitations

- Brain Memory Gateway live mode is optional and may be mock/unconfigured in a
  default local run.
- Production installer is not implemented.
- Final one-command GitHub bundle is not implemented.
- Export/import is deferred.
- Real artifact upload/download is deferred.
- Provider/model runtime switching is deferred.
- Full auth/classification is deferred.
- Memory admin/mutation UI is deferred.
- Context compaction runtime is deferred.
- Scalable infinite/progressive loading runtime is deferred.
- Cross-channel Telegram/CLI run discovery is deferred.
- Hermes Runs API migration is not done.
- Real server-side run stop is not implemented for the current session-stream
  chat path.

## Not Claimable In This RC

- Production installer.
- Managed Hermes installer.
- Managed Brain Memory installer.
- Docker/systemd service manager.
- Final one-command GitHub distribution.
- Durable export/import.
- Memory mutation/admin controls.
- Context compaction runtime.
- Scalable infinite/progressive loading runtime.
- Direct browser-to-Hermes or browser-to-Brain-Memory access.
- Direct storage access.

## Requirements

- `npm install` completed in the workspace.
- Healthy selected Web UI server for browser smokes.
- Hermes already running for live Hermes gates.
- Brain Memory Gateway already running and configured for live Brain Memory
  gates.
- No committed secrets in `apps/web/.env.local` or screenshots/logs.

## Recommended Checks

Safe release gate:

```powershell
npm run check:packaging
npm run release:check
```

Manual RC/browser gate:

```powershell
npm run studio:launch -- --check --base-url http://127.0.0.1:<port>
npm run smoke:ui -- --base-url http://127.0.0.1:<port>
npm run smoke:markdown -- --base-url http://127.0.0.1:<port>
npm run smoke:markdown:long -- --base-url http://127.0.0.1:<port>
npm run smoke:memory-detail -- --base-url http://127.0.0.1:<port>
```

Optional live-service gate:

```powershell
npm run smoke:ui:send -- --base-url http://127.0.0.1:<port>
npm run smoke:ui:stop -- --base-url http://127.0.0.1:<port>
node scripts/mvp-smoke.mjs --require-hermes --base-url http://127.0.0.1:<port>
npm run smoke:ui:memory-live -- --base-url http://127.0.0.1:<port>
npm run smoke:ui:memory-scope -- --base-url http://127.0.0.1:<port>
node scripts/mvp-smoke.mjs --require-hermes --require-brain-memory --base-url http://127.0.0.1:<port>
```

## Recommended Release Decision

Slice 17B records the final RC browser/live smoke decision:

- `docs/release/RELEASE_DECISION_17B.md`

The 17B decision is **MVP complete with known limitations** for the local/demo
RC. The selected Web UI server was `http://127.0.0.1:3002`; non-live checks,
browser smokes, and live Hermes send/stop checks passed. Live Brain Memory
Gateway claims remain unavailable in the recorded shell because the Web UI BFF
was configured for mock/unconfigured Brain Memory mode.

Slice 17A adds the current completion audit and final live smoke checklist:

- `docs/release/MVP_COMPLETION_AUDIT_17A.md`
- `docs/release/FINAL_MVP_LIVE_SMOKE_CHECKLIST_17A.md`
- `docs/release/RELEASE_DECISION_17A.md`

The 17A recommendation is **conditionally complete** for a local/demo MVP RC
after the safe non-live gate passes. Browser and live-service claims still
require one healthy selected Web UI base URL and intentionally running services.

Runs production implementation is deferred/post-MVP. Session stream remains the
MVP production execution path. Brain Memory is read-only in MVP; mutation/admin,
export/import, provider/model runtime switching, artifact upload/download, and
production installer work remain deferred.

Treat the current state as RC-ready only after:

- the safe release gate passes;
- one healthy selected Web UI server is verified;
- browser smokes pass against that selected base URL;
- live Brain Memory claims, when made, pass the read-only QA gate in
  `docs/product/BRAIN_MEMORY_READ_ONLY_QA_GATE_15L.md`;
- optional live-service failures are classified as unconfigured rather than
  silently claimed as passing.

The current refreshed decision is recorded in
`docs/release/RELEASE_DECISION_14P.md`: pass with known limitations for the
local Web UI + Hermes MVP path, with live Brain Memory Gateway still
optional/deferred unless explicitly configured and checked.
