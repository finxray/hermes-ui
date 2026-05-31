# Artifacts Tools Large Measurement 15R

Date: 2026-05-31

Status: Measurement and decision checkpoint. No runtime loading behavior was
implemented.

## Scope

Slice 15R adds a deterministic local measurement fixture for the Files/artifacts
panel, legacy tool-event rows, and representative collapsed agent activity
details before choosing a scalable-loading runtime implementation.

This slice does not implement Show More, infinite scroll, virtualization,
runtime pagination, production Files/artifacts behavior changes, production
tool-event behavior changes, context compaction runtime, export/import, Hermes
streaming changes, Brain Memory BFF changes, direct browser-to-service calls,
direct storage access, or memory mutation/admin UI.

Guardrail summary: no runtime Show More, no pagination, and no virtualization
were added.

## Current Surface Audit

The production Files and Tools surfaces currently behave as follows:

- Files tab maps every `activeSession.artifacts` row.
- Files/artifacts rows are not capped, paginated, virtualized, or lazy-loaded.
- Artifact previews/downloads are disabled and no details drawer is rendered.
- Artifact metadata is compact text only: title, summary, kind, source, status,
  date, size, and path.
- Tools tab caps Recent commands to the latest 8 normalized command events.
- Legacy `activeSession.toolEvents` rows are not capped, paginated, virtualized,
  or lazy-loaded.
- Legacy tool rows render compact name/status/detail/time text only.
- `AgentActivityBlock` renders native `details` collapsed by default.
- Command stdout/stderr/output preview blocks are inside collapsed details and
  visually bounded.
- `AgentActivityBlock` currently creates a capped `safeJson` details preview
  during render even while details are collapsed; the string is capped at 5,000
  characters per activity group.

This audit is descriptive only. No runtime behavior was changed.

## Fixture Size

`apps/web/src/data/largeArtifactsToolsFixture.ts` generates:

- 500 artifacts.
- 500 legacy tool-event rows.
- 500 normalized `AgentActivityEvent` rows.
- 100 command activity groups.
- Mixed activity types: command, memory, tool, error, and status.
- Mixed artifact kinds: file-like document, code, log, report, data, and
  unknown.
- Bounded stdout/stderr/output previews and bounded metadata.
- No raw payload blobs and no secret sentinel values.

The route `/design/artifacts-tools-large-fixture` renders the real production
`ContextRail` and `AgentActivityBlock` components with local fixture data. It
does not read or write localStorage and does not call Hermes, Brain Memory, Web
UI BFF APIs, or storage backends.

## Metrics Collected

`npm run smoke:artifacts-tools:large` reports:

- `routeLoadMs`
- browser navigation timing: DOMContentLoaded, load event, response end,
  transfer size
- `renderedArtifactCount`
- `renderedToolEventCount`
- `renderedCommandCount`
- `renderedDetailsCount`
- `openDetailsCount`
- `activityDetailsCount`
- `activityCommandDetailsCount`
- `filesTabSwitchMs`
- `toolsTabSwitchMs`
- right-rail scroll down/up timing
- horizontal overflow in pixels
- browser console/page/network error counts
- forbidden service-call count
- total smoke duration

Supported modes:

- `--json` prints the full report as stable JSON.
- `--verbose` prints the metric summary in console mode.
- `--budget-strict` turns timing budget warnings into failures. It is not the
  default.

## Measurement Result

Measured locally against `http://127.0.0.1:3003` on 2026-05-31 with a temporary
Web UI dev server.

| Metric | Result |
| --- | ---: |
| Static chunks checked | 8 |
| Route load | 476 ms |
| DOMContentLoaded | 343 ms |
| Load event | 471 ms |
| Rendered activity details | 500 |
| Rendered command activity details | 100 |
| Total details | 502 |
| Open details by default | 0 |
| Tools tab switch | 288 ms |
| Recent command rows | 8 |
| Legacy tool-event rows | 500 |
| Files tab switch | 280 ms |
| Artifact rows | 500 |
| Right rail viewport height | 601 px |
| Right rail scroll height | 116,190 px |
| Right rail scroll down/up | 6 ms / 13 ms |
| Horizontal overflow | 0 px |
| Service calls | 0 |
| Browser/network errors | 0 |
| Total smoke duration | 1,809 ms |

The matching smoke summary was 23 passed, 0 warnings, 0 failures.

The first verbose run measured route load at 1,020 ms, Tools tab switch at
306 ms, Files tab switch at 227 ms, right-rail scroll at 11 ms / 11 ms, and the
same rendered counts. The JSON run above is used as the recorded structured
result.

These values are approximate browser-smoke measurements, not hard cross-machine
performance benchmarks.

## Decision

Decision: **Files/artifacts and legacy tool rows remain acceptable for the
measured local fixture; defer runtime Show More, pagination, and virtualization
for these surfaces.**

Reasoning:

- 500 artifact rows render and switch into view below the 500 ms tab-switch
  warning threshold.
- 500 legacy tool-event rows render and switch into view below the 500 ms
  tab-switch warning threshold.
- Right-rail scroll remains comfortably below the 100 ms warning threshold.
- No horizontal overflow, service calls, browser errors, or network errors were
  captured.
- Recent command rows are already capped to 8.
- Command activity details remain collapsed by default, and output previews are
  bounded.

The very large right-rail scroll height confirms a future navigation/UX reason
for Show More or pagination, especially if real artifact/tool histories grow
beyond this fixture. The current measurement does not make Files/artifacts or
legacy tool rows the next required runtime performance slice.

Command details do not need more lazy rendering next based on this measurement.
However, the audit found that `AgentActivityBlock` still builds capped JSON
detail previews while collapsed. That remains a watch item for a future lazy
collapsed-details slice if heavier activity payloads become measurable.

## Thresholds

Failures:

- Fixture route fails to load.
- Static chunks are stale or missing.
- Required fixture sections are missing.
- Rendered artifact count is not 500.
- Rendered legacy tool-event count is not 500.
- Rendered recent command count is not 8.
- Rendered activity detail count is not 500.
- Any details are open by default.
- Horizontal overflow exceeds 1 px.
- Right-rail scroll action cannot complete.
- Any `/api/*`, Hermes, Brain Memory Gateway, or storage-service request is
  made.
- Serious browser console, page, or non-ignored network errors are captured.

Warnings in default mode:

- Route load exceeds 5,000 ms.
- Files or Tools tab switch exceeds 500 ms.
- Right-rail scroll action exceeds 100 ms.
- Optional timing data is unavailable.

`--budget-strict` converts timing warnings into failures for local
investigation, but the default smoke remains tolerant to normal machine
variance.

## Deferred

- Runtime Files/artifacts Show More.
- Runtime Files/artifacts pagination.
- Runtime legacy tool-event Show More.
- Runtime legacy tool-event pagination.
- Runtime virtualization.
- Lazy collapsed activity JSON details.
- Command output fetch handles for full output.
- Context compaction runtime.
- Backend export/import.

## Next Recommended Slice

Slice 15S: create a scalable-loading decision checkpoint that consolidates
15N through 15R measurements and chooses the first runtime implementation only
if the evidence now justifies one.
