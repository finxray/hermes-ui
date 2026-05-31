# Scalable Loading Decision 15S

Date: 2026-05-31

Current commit: `ee01dbf`

Status: MVP decision checkpoint. No runtime scalable-loading behavior was
implemented.

## Purpose

Slices 15N through 15R created a measurement track because Brain Memory Studio
is expected to accumulate long sessions, large sidebars, memory timelines,
artifacts/tools history, and future cross-channel sessions. The track also
responds to the explicit product concern that performance should remain stable
before adding more runtime complexity.

The measurement work covered:

- long chat transcripts;
- large project/session sidebars;
- Brain Memory timelines and evidence-style rows;
- artifacts, files, command previews, and legacy tool rows;
- future cross-channel session pressure from CLI, API, Telegram, or other
  agent surfaces;
- user concern about avoiding UI jank as the Studio grows.

This checkpoint consolidates those measurements and decides whether runtime
Show More, pagination, or virtualization is needed now.

Guardrail summary: no runtime Show More, no runtime pagination, no infinite
scroll, no virtualization, no context compaction runtime, no backend feature,
no Hermes streaming change, no Brain Memory BFF change, no direct
browser-to-service path, no direct storage access, and no memory mutation/admin
action were added.

## Architecture Summary

The measured UI still follows the current Hermes UI boundaries:

- Browser code renders local React components and calls only Web UI/BFF routes
  for service behavior.
- Hermes remains the agent runtime.
- Brain Memory Gateway remains the memory authority.
- Brain Memory read surfaces stay Gateway-mediated through the Web UI BFF.
- Large fixture routes are static local measurement routes and do not call
  Hermes, Brain Memory, BFF APIs, localStorage, or storage backends.

## Measurement Summary

| Surface | Fixture size | Key metrics | Result | Decision |
| --- | --- | --- | --- | --- |
| Transcript | 120 messages in `/design/long-session-fixture` | 59,992 px transcript scroll height; scroll down/up 16 ms / 10 ms; 0 px overflow | Acceptable for MVP-scale fixture | Defer transcript virtualization |
| Sidebar | 25 projects, 1,000 sessions, 1,027 visible project/session/recent rows | Route load 452 ms; scroll down/up 1 ms / 7 ms; active selection 73 ms; 0 px overflow | Acceptable for measured large-sidebar fixture | Defer Sidebar Show More and pagination |
| Export preview | 494,133-character local export JSON after opening `Preview JSON` | Before open: 0 JSON chars and not built; after open: build 3 ms, click-to-visible 329 ms; 0 service calls | Hidden eager cost fixed by lazy construction | Keep lazy preview; no backend export/import |
| Files/artifacts | 500 artifact rows in `/design/artifacts-tools-large-fixture` | Files tab switch 280 ms; right-rail scroll included in 6 ms / 13 ms; 0 px overflow | Acceptable for measured fixture | Defer Files/artifacts Show More and pagination |
| Legacy tool rows | 500 legacy tool-event rows | Tools tab switch 288 ms; 500 rows rendered; 0 service calls | Acceptable for measured fixture | Defer legacy tool pagination |
| Activity details | 500 collapsed activity details, 100 command activity groups | 502 total details; 0 open by default; bounded previews | Acceptable while collapsed | Defer deeper lazy collapsed-detail rendering |
| Memory timeline | 16 memory evidence/timeline-style rows in long-session fixture | Covered in right-rail tab switches; Memory tab switch 287 ms; 0 service calls | Acceptable for current MVP evidence scale | Defer right rail memory timeline pagination |
| Command previews | 8 recent command rows, 100 command activity groups, bounded stdout/stderr/output previews | Recent command rows capped to 8; command details collapsed; 0 open details by default | Acceptable for current command preview model | Defer command preview pagination/fetch handles |

Measurement reports:

- `docs/performance/LONG_SESSION_PERFORMANCE_PLAN_15N.md`
- `docs/performance/LONG_SESSION_MEASUREMENT_15O.md`
- `docs/performance/LAZY_EXPORT_PREVIEW_15P.md`
- `docs/performance/SIDEBAR_LARGE_MEASUREMENT_15Q.md`
- `docs/performance/ARTIFACTS_TOOLS_LARGE_MEASUREMENT_15R.md`

## Decision

Decision: **do not implement runtime Show More, pagination, infinite scroll, or
virtualization yet.**

The existing bounded and collapsed design is acceptable for the MVP-scale
fixtures measured so far. The one measured hidden cost, eager construction of
the local export preview JSON, was already fixed in Slice 15P by lazy preview
construction.

Keep the measurement smokes in place and use them as regression gates. Revisit
runtime scalable loading when real user data exceeds the measured thresholds or
when the smoke scripts begin warning on ordinary local runs.

## Revisit Triggers

Reopen runtime scalable-loading work if any of these become true:

- transcript count above 500 messages becomes slow;
- sidebar above 2,000 visible rows becomes slow;
- Files/artifacts above 1,000 rows becomes slow;
- right rail tab switch exceeds 500 ms;
- scroll action exceeds 100 ms;
- page-level horizontal overflow appears;
- export preview becomes eager again;
- live users report jank.

## Future Implementation Order

If measurement later justifies runtime scalable loading, implement the smallest
specific fix first:

1. List-level Show More for the specific failing surface.
2. Pagination or load-more behavior for that surface.
3. Virtualization/windowing for genuinely large local lists.
4. Deeper architectural changes only after surface-specific fixes are
   insufficient.

Do not add generic virtualization or pagination before a measured surface needs
it.

## Deferred

- Context compaction runtime.
- Cross-channel session pagination.
- Transcript virtualization.
- Sidebar Show More.
- Right rail timeline pagination.
- Files/artifacts pagination.
- Legacy tool-event pagination.
- Command output fetch handles.
- Backend export/import.

## Regression Position

Keep these checks available:

- `npm run smoke:long-session`
- `npm run smoke:sidebar:large`
- `npm run smoke:artifacts-tools:large`
- `npm run check:ui-structure`

The smokes remain measurement gates and fixture regression coverage. They are
not release claims that the Studio supports unlimited transcript, sidebar,
artifact, memory timeline, or command history sizes.

## Next Recommended Slice

Slice 16A: Hermes Runs API migration assessment.

Reason: the scalable-loading track has a clear MVP decision, while the next
architecture risk is moving from the current session-stream path toward a
Hermes `/v1/runs` control plane for richer event streaming, approvals, stop,
and future cross-channel run/session discovery.
