# Sidebar Large Measurement 15Q

Date: 2026-05-31

Status: Measurement and decision checkpoint. No runtime loading behavior was
implemented.

## Scope

Slice 15Q adds a deterministic large-sidebar measurement fixture and smoke gate
to decide whether Sidebar Show More should happen before transcript
virtualization.

This slice does not implement Show More, infinite scroll, virtualization,
runtime pagination, production sidebar behavior changes, production transcript
behavior changes, context compaction runtime, export/import, Hermes streaming
changes, Brain Memory BFF changes, direct browser-to-service calls, direct
storage access, or memory mutation/admin UI.

Guardrail summary: no runtime Show More, no pagination, and no virtualization
were added.

## Current Sidebar Audit

The production Sidebar currently:

- renders all projects and all non-archived sessions under each project;
- filters and sorts sessions per project during render via `getProjectSessions`;
- renders child session rows for every project group immediately;
- caps Recent chats to 2 rows, which duplicate sessions already present in the
  project tree;
- has no search/filter UI;
- has no runtime Show More, pagination, virtualization, or hidden project-group
  expansion state;
- does not memoize `Sidebar` or `SidebarRow`;
- rerenders after active row selection because the active project/session state
  changes.

This audit is descriptive only. No runtime behavior was changed.

## Fixture Size

`apps/web/src/data/largeSidebarFixture.ts` generates:

- 25 projects.
- 40 sessions per project.
- 1,000 sessions total.
- 2 Recent chats, matching the production Sidebar cap.
- Empty transcript/run/memory/artifact arrays so the route measures Sidebar
  scale without unrelated transcript or right-rail work.

The route `/design/sidebar-large-fixture` renders the real production
`Sidebar` component plus a small local measurement panel. It does not read or
write localStorage and does not call Hermes, Brain Memory, Web UI BFF APIs, or
storage backends.

## Metrics Collected

`npm run smoke:sidebar:large` reports:

- `routeLoadMs`
- browser navigation timing: DOMContentLoaded, load event, response end,
  transfer size
- `renderedProjectCount`
- `renderedSessionCount`
- `renderedRecentChatCount`
- `renderedSidebarRowCount`
- Sidebar `clientHeight`, `scrollHeight`, and `scrollTop`
- Sidebar scroll down/up timing
- active row selection timing for the final session row
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
| Route load | 452 ms |
| DOMContentLoaded | 346 ms |
| Load event | 444 ms |
| Rendered projects | 25 |
| Rendered sessions | 1,000 |
| Rendered recent chats | 2 |
| Rendered project/session/recent rows | 1,027 |
| Sidebar viewport height | 768 px |
| Sidebar scroll height | 61,601 px |
| Sidebar scroll down/up | 1 ms / 7 ms |
| Active row selection | 73 ms |
| Horizontal overflow | 0 px |
| Service calls | 0 |
| Browser/network errors | 0 |
| Total smoke duration | 1,274 ms |

The matching smoke summary was 19 passed, 0 warnings, 0 failures.

The first verbose run measured route load at 368 ms, scroll at 5 ms / 3 ms,
active row selection at 65 ms, and the same row counts. The JSON run above is
used as the recorded structured result.

These values are approximate browser-smoke measurements, not hard cross-machine
performance benchmarks.

## Decision

Decision: **Sidebar remains acceptable for MVP-scale local measurement; defer
Sidebar Show More and transcript virtualization for now.**

Reasoning:

- 1,000 visible session rows render without horizontal overflow or service
  calls.
- Sidebar scroll and active row selection stay comfortably below warning
  thresholds in this local smoke.
- The route isolates sidebar work, so the measurement does not hide behind
  transcript or right-rail complexity.
- The large scroll height confirms a future navigation/UX reason for Show More,
  but the current evidence does not make it the next required performance
  runtime slice.
- Transcript virtualization is premature because the existing 120-message
  transcript fixture remains acceptable and the first measured hidden bottleneck
  was already fixed by Slice 15P.

Show More remains useful for future UX polish and for very large real
workspaces, but it is not recommended as the immediate next runtime change based
on this measurement alone.

## Thresholds

Failures:

- Fixture route fails to load.
- Static chunks are stale or missing.
- Required fixture sections are missing.
- Rendered project count is not 25.
- Rendered session count is not 1,000.
- Rendered recent chat count is not 2.
- Horizontal overflow exceeds 1 px.
- Sidebar scroll action cannot complete.
- Active row selection cannot update the fixture panel.
- Any `/api/*`, Hermes, Brain Memory Gateway, or storage-service request is
  made.
- Serious browser console, page, or non-ignored network errors are captured.

Warnings in default mode:

- Route load exceeds 5,000 ms.
- Sidebar scroll action exceeds 100 ms.
- Active row selection exceeds 750 ms.
- Project/session/recent row count exceeds 1,500.
- Optional timing data is unavailable.

`--budget-strict` converts timing warnings into failures for local
investigation, but the default smoke remains tolerant to normal machine
variance.

## Deferred

- Runtime Sidebar Show More.
- Runtime sidebar pagination.
- Runtime sidebar virtualization.
- Chat transcript windowing or virtualization.
- Search/filter for the sidebar.
- Scroll restoration changes.
- Backend cursors.
- Context compaction runtime.
- Backend export/import.

## Next Recommended Slice

Slice 15R: measure large Files/artifacts and legacy tool-event panels before
choosing the next scalable-loading runtime implementation.
