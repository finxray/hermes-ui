# Launch Runbook 12F

Date: 2026-05-30

## Summary

Slice 12F added a practical local launch runbook for MVP development and demo
use. This is documentation-only work, apart from no script changes: the existing
`studio:doctor`, `smoke:mvp`, and `smoke:ui` commands already cover the useful
launch checklist shape.

## Files Changed

- `docs/runbooks/MVP_LOCAL_LAUNCH_RUNBOOK.md`
- `docs/checkpoints/LAUNCH_RUNBOOK_12F.md`
- `docs/packaging/LOCAL_STARTUP_GUIDE.md`
- `README.md`
- `ROADMAP.md`

## Runbook Summary

The runbook documents:

- known local URLs for Web UI, Hermes API, and Brain Memory Gateway;
- command inventory for env setup, doctor, dev server, browser open, and smoke
  tests;
- quick start for Web UI + Hermes;
- standalone/mock mode expectations;
- live Hermes verification;
- live Brain Memory Gateway verification;
- 401 versus 403 Brain Memory auth/tenant behavior;
- smoke-test matrix;
- browser zoom/scaling troubleshooting;
- Playwright Chromium install recovery;
- stale Next/dev-server symptoms and safe recovery;
- WSL/Windows notes;
- secrets safety;
- known deferred features.

## Commands Verified

```text
npm run studio:doctor
npm run smoke:mvp
npm run smoke:ui
npm run check:workspace-state
npm run check:brain-memory-client
npm run check:ui-structure
npm run typecheck
npm run build
npm audit --audit-level=moderate
```

## Script Decision

No new `launch-checklist` script was added. `npm run studio:doctor` already
checks repo shape, env presence, redacted env status, Hermes direct health, Web
UI BFF Hermes status, Web UI BFF Brain Memory status, and direct Gateway probes
when live Gateway mode is enabled.

## Remaining Launch Gaps

- Production one-command CLI remains deferred.
- Real Brain Memory Gateway launch still depends on the Brain Memory project
  and tenant-bound key configuration.
- Default browser smoke does not click Send unless `--send-test` is provided.
- Real stop/cancel streaming remains deferred.
- Full auth/classification remains deferred.

## Next Recommended Slice

Slice 12G: optional live-send browser smoke gate. Add a clearly opt-in browser
send path that requires Hermes live mode, records assistant response evidence,
and remains disabled in default `smoke:ui`.
