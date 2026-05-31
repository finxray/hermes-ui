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
```

Optional live-service gate:

```powershell
npm run smoke:ui:send -- --base-url http://127.0.0.1:<port>
npm run smoke:ui:stop -- --base-url http://127.0.0.1:<port>
node scripts/mvp-smoke.mjs --require-hermes --base-url http://127.0.0.1:<port>
node scripts/mvp-smoke.mjs --require-brain-memory --base-url http://127.0.0.1:<port>
```

## Recommended Release Decision

Treat the current state as RC-ready only after:

- the safe release gate passes;
- one healthy selected Web UI server is verified;
- browser smokes pass against that selected base URL;
- optional live-service failures are classified as unconfigured rather than
  silently claimed as passing.

The current refreshed decision is recorded in
`docs/release/RELEASE_DECISION_14P.md`: pass with known limitations for the
local Web UI + Hermes MVP path, with live Brain Memory Gateway still
optional/deferred unless explicitly configured and checked.
