# Release Notes Template

Use this template for future Hermes UI / Brain Memory Studio release
candidates. Keep it honest: separate shipped behavior from optional live-service
behavior and deferred work.

## Version

`vX.Y.Z-rc.N`

## Date

YYYY-MM-DD

## Summary

One or two paragraphs describing what this candidate is ready for and what it
is not ready for.

## Highlights

- Highlight 1.
- Highlight 2.
- Highlight 3.

## New Features

- Feature 1.
- Feature 2.

## Fixed Issues

- Fix 1.
- Fix 2.

## Known Limitations

- Limitation 1.
- Limitation 2.

## Deferred Features

- Full auth/classification model.
- Production one-command CLI.
- Durable evidence/supersession storage.
- Memory mutation/admin actions.
- Real stop/cancel streaming through Hermes Runs API where applicable.
- Provider/model selector polish.
- Further UI polish.

## Requirements

- Node.js and npm compatible with the workspace.
- A healthy selected Web UI base URL for browser smokes.
- Hermes API server only when running live Hermes gates.
- Brain Memory Gateway and tenant-bound read key only when running live Brain
  Memory gates.

## Install / Start Instructions

```powershell
npm install
npm run studio:env -- --list
npm run studio:env -- --mode web-ui-with-hermes
npm run studio:web
npm run studio:launch -- --check --base-url http://127.0.0.1:<port>
```

Use `web-ui-only` mode when Hermes is not part of the current run. Use a
selected healthy base URL for browser smokes instead of assuming port `3000`.

## Smoke Checks

Safe source/build/audit gate:

```powershell
npm run check:packaging
npm run release:check
```

Browser checks after selecting a healthy Web UI server:

```powershell
npm run smoke:ui -- --base-url http://127.0.0.1:<port>
npm run smoke:markdown -- --base-url http://127.0.0.1:<port>
npm run smoke:markdown:long -- --base-url http://127.0.0.1:<port>
```

Optional live-service checks:

```powershell
npm run smoke:ui:send -- --base-url http://127.0.0.1:<port>
npm run smoke:ui:stop -- --base-url http://127.0.0.1:<port>
node scripts/mvp-smoke.mjs --require-hermes --base-url http://127.0.0.1:<port>
node scripts/mvp-smoke.mjs --require-brain-memory --base-url http://127.0.0.1:<port>
```

## Upgrade Notes

- Note any required env changes.
- Note whether users must restart the Web UI server.
- Note any local storage compatibility caveats.

## Security / Secrets Notes

- Do not commit `apps/web/.env.local`.
- Do not print or paste API keys into release notes, logs, screenshots, or
  issues.
- Browser code must call only the Web UI BFF.
- Hermes remains the agent runtime.
- Brain Memory Gateway remains the memory authority.

## Compatibility Notes

- Supported local OS/shell notes.
- Known browser notes.
- Known Node/npm version notes.

## Checks Passed

| Check | Result | Notes |
| --- | --- | --- |
| `npm run check:packaging` | Not run |  |
| `npm run release:check` | Not run |  |
| `npm run studio:launch -- --check --base-url <healthy-url>` | Not run |  |
| Browser smokes | Not run |  |
| Hermes live gates | Not run | Optional. |
| Brain Memory live gates | Not run | Optional. |

## Release Decision

- Decision: Pass / Pass with known limitations / Blocked.
- Approver:
- Notes:
