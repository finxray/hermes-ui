# Long-Session Measurement Report 15O

Date: 2026-05-31

Status: Measurement and decision checkpoint. No runtime scalable-loading behavior was implemented in 15O. Slice 15P completed the first targeted follow-up.

## Scope

Slice 15O extends the long-session fixture smoke with stable measurement reporting and records the first scalable-loading implementation decision. The measurements are local/test-only and use `/design/long-session-fixture`.

This slice does not implement infinite scroll, virtualization, runtime pagination, production transcript changes, production sidebar changes, Memory timeline changes, context compaction runtime, export/import, Hermes streaming changes, Brain Memory BFF changes, direct browser-to-service calls, or memory mutation/admin UI.

## Fixture Size

The measured fixture contains:

- 5 projects.
- 100 sidebar sessions.
- 120 transcript messages.
- 80 activity events.
- 24 run records.
- 10 persisted replay events per run.
- 16 retrieved memory evidence rows.
- 20 legacy tool events.
- 18 artifact rows.

## Metrics Collected

`npm run smoke:long-session` now reports:

- `routeLoadMs`
- browser navigation timing: DOMContentLoaded, load event, response end, transfer size
- `renderedMessageCount`
- transcript `clientHeight`, `scrollHeight`, and `scrollTop`
- `renderedSidebarProjectCount`, `renderedSidebarSessionCount`, and total sidebar rows
- `renderedDetailsCount` and `openDetailsCount`
- Context rail counts for run rows, persisted replay rows, retrieved memory rows, collapsed export state, and export preview JSON size
- 15P follow-up metrics for lazy export preview construction before and after opening the JSON disclosure
- horizontal overflow in pixels
- transcript scroll down/up timing
- right rail tab switch timing for Memory, Tools, Files, and Context
- browser console/page/network error counts
- forbidden service-call count
- total smoke duration

Supported modes:

- `--json` prints the full report as stable JSON.
- `--verbose` prints the metric summary in console mode.
- `--budget-strict` turns timing budget warnings into failures. It is not the default.

## Current Measurement Results

Measured locally against `http://127.0.0.1:3003` on 2026-05-31 with a temporary Web UI server:

| Metric | Result |
| --- | ---: |
| Static chunks checked | 8 |
| Route load | 447 ms |
| DOMContentLoaded | 357 ms |
| Load event | 444 ms |
| Rendered transcript messages | 120 |
| Transcript viewport height | 768 px |
| Transcript scroll height | 59,992 px |
| Rendered sidebar rows | 105 |
| Collapsible details | 82 |
| Open details by default | 0 |
| Run rows visible on Context tab | 8 |
| Persisted replay rows visible | 8 |
| Retrieved memory rows visible | 16 |
| Export preview JSON size before 15P | 494,133 characters |
| Export preview details open | false |
| Scroll down/up | 16 ms / 10 ms |
| Memory tab switch | 287 ms |
| Tools tab switch | 73 ms |
| Files tab switch | 71 ms |
| Context tab switch | 81 ms |
| Horizontal overflow | 0 px |
| Service calls | 0 |
| Browser/network errors | 0 |
| Total smoke duration | 1,895 ms |

The matching smoke summary was 31 passed, 0 warnings, 0 failures.

These values are approximate browser-smoke measurements, not hard cross-machine performance benchmarks.

## Thresholds

Failures:

- Fixture route fails to load.
- Static chunks are stale or missing.
- Required fixture sections are missing.
- Rendered transcript message count is not 120.
- Rendered sidebar session count is not 100.
- Horizontal overflow exceeds 1 px.
- Collapsible details are all expanded by default, or expected collapsed details are missing.
- Transcript scroll action cannot complete.
- Any `/api/*`, Hermes, Brain Memory Gateway, or storage-service request is made.
- Serious browser console, page, or non-ignored network errors are captured.

Warnings in default mode:

- Route load exceeds 5,000 ms.
- Transcript scroll action exceeds 100 ms.
- Right rail tab switch exceeds 500 ms.
- Optional timing data is unavailable.

`--budget-strict` converts timing warnings into failures for local investigation, but the default smoke remains tolerant to normal machine variance.

## Decision

First runtime scalable-loading target: **Export preview lazy construction**.

Reasoning:

- The 120-message transcript rendered and scrolled acceptably in the fixture, so transcript virtualization is not the first runtime slice.
- The 100-session sidebar rendered acceptably in the fixture, so sidebar `Show more` can wait until a larger sidebar fixture or real workspace shows friction.
- Run history, persisted replay, memory timeline, command previews, and details are already visibly bounded or collapsed.
- The largest measured hidden work is the collapsed export preview JSON: 494,133 characters are built on the default Context tab even though the JSON is inside a closed `<details>`.
- Lazy construction of export preview JSON is narrower and lower-risk than transcript windowing, while directly reducing hidden work that scales with transcript and replay size.

Slice 15P implemented this target by deferring export-preview JSON construction until the user opens the preview detail. It did not add download/export/import behavior, backend export, storage access, runtime pagination, infinite scroll, or virtualization.

## 15P Follow-Up Result

Slice 15P added `docs/performance/LAZY_EXPORT_PREVIEW_15P.md` and updated the
long-session smoke to assert the lazy behavior.

Measured locally against `http://127.0.0.1:3003` on 2026-05-31:

| Metric | Result |
| --- | ---: |
| Export preview JSON before opening details | 0 characters |
| Export preview built before opening details | false |
| Export preview JSON after opening details | 494,133 characters |
| Export preview build time after opening details | 3 ms |
| Smoke summary | 35 passed, 0 warnings, 0 failures |

## Deferred

- Chat transcript windowing or virtualization.
- Sidebar project/session `Show more`.
- Run history and memory timeline pagination.
- Files/artifacts pagination.
- Command/detail fetch handles for full output.
- Cross-channel session pagination.
- Context compaction runtime.
- Backend export/import.

## Next Recommended Slice

Slice 15Q: add a larger sidebar/session-list measurement variant and decide whether sidebar `Show more` is needed before transcript virtualization.
