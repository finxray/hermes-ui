# Lazy Export Preview 15P

Date: 2026-05-31

Status: Runtime scalable-loading slice complete.

## Scope

Slice 15P lazily constructs the Context rail local export preview JSON only
when the user opens the `Preview JSON` disclosure. The summary counts remain
visible immediately, but the large JSON string is not built or inserted into
the DOM while the disclosure is closed.

This slice is local-only and read-only. It does not add download, copy, import,
backend export, filesystem writes, direct storage access, context compaction,
runtime pagination, infinite scroll, virtualization, Hermes streaming changes,
Brain Memory BFF changes, memory-scope bridge changes, or memory mutation/admin
actions.

Guardrail summary: no download, no import, and no backend export behavior was
added.

## Eager Behavior Found

Before 15P, `ExportPreviewSection` called
`createSessionExportPreview(activeSession, activeSession.updatedAt)` and
`JSON.stringify(preview, null, 2)` during normal Context rail render. The JSON
was inside a closed `<details>` element, but the full preview was still built
and present in the DOM.

The Slice 15O fixture measured that hidden work at 494,133 characters for the
static long-session fixture.

## Implementation

The Context rail now:

- computes visible metrics directly from the active session;
- keeps the excluded-field list as static local UI metadata matching the export
  helper;
- tracks `isExportPreviewOpen` from the `details` `onToggle` event;
- builds `createSessionExportPreview(...)` only after the disclosure is open;
- memoizes the generated JSON in `exportPreviewCache` by a session cache key;
- renders a small local placeholder while the open-triggered build completes.

The expensive path still uses the existing `createSessionExportPreview` helper.
No new export shape or export action was introduced.

## Redaction And Bounding

The redaction and bounding contract is preserved because the opened JSON preview still flows
through `apps/web/src/lib/persistedActivityReplay.ts`:

- secret-like keys are redacted;
- bearer-like values are redacted;
- command/stdout/stderr/output previews remain capped;
- details previews and persisted replay metadata remain bounded;
- raw Hermes payloads, full command output, binaries, credentials, and direct
  service URLs with secrets remain excluded.

## Measurement

Measured locally against `http://127.0.0.1:3003` on 2026-05-31 with a temporary
Web UI dev server.

| Metric | Before 15P | After 15P |
| --- | ---: | ---: |
| Hidden export JSON before opening details | 494,133 chars | 0 chars |
| Export preview built before opening details | yes | no |
| Export preview details open by default | false | false |
| Export preview JSON after opening details | 494,133 chars | 494,133 chars |
| Open-triggered preview build time | not measured | 3 ms |
| Click-to-visible preview time | not measured | 329 ms |
| Service calls from fixture route | 0 | 0 |
| Horizontal overflow | 0 px | 0 px |
| Smoke summary | 31 passed, 0 warnings, 0 failed | 35 passed, 0 warnings, 0 failed |

The after measurement came from:

```text
npm run smoke:long-session -- --base-url http://127.0.0.1:3003 --json
```

Relevant JSON metrics:

```json
{
  "contextRail": {
    "exportJsonCharsBeforeOpen": 0,
    "exportPreviewBuiltBeforeOpen": false,
    "exportPreviewDetailsOpen": false
  },
  "exportPreview": {
    "builtAfterOpen": true,
    "exportPreviewBuildMs": 3,
    "jsonSize": 494133
  }
}
```

These are browser-smoke measurements for the local fixture, not hard
cross-machine performance benchmarks.

## Regression Coverage

`npm run smoke:long-session` now verifies:

- the export preview disclosure starts closed;
- no preview JSON is rendered before open;
- opening the disclosure renders the JSON;
- the opened JSON remains the same bounded/redacted local preview shape;
- no `/api/*`, Hermes, Brain Memory Gateway, or direct storage calls occur;
- horizontal overflow remains absent.

`npm run check:ui-structure` now source-checks the lazy preview contract and
guards against the old eager `JSON.stringify` line returning.

## Deferred

- Export download.
- Export import.
- Backend export.
- Copy-to-clipboard.
- Durable backup/sync.
- Runtime transcript virtualization.
- Runtime pagination or infinite scroll.
- Context compaction runtime.

## Next Recommended Slice

Slice 15Q: add a larger sidebar/session-list measurement variant and decide
whether sidebar `Show more` is needed before transcript virtualization.
