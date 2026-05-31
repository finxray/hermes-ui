# Scalable UI Loading Roadmap

Date: 2026-05-31

Status: Deferred product contract. Not implemented.

## Scope

Scalable UI loading is the future ability for Brain Memory Studio to handle
long-lived sessions and large operational lists without rendering huge arrays
all at once or making the interface feel slow.

This is a roadmap note only. Slice 15M does not implement infinite scroll,
virtualization, pagination, progressive loading, runtime list limits, or UI
behavior changes.

Slice 15N adds the first measurement baseline in
`docs/performance/LONG_SESSION_PERFORMANCE_PLAN_15N.md`, plus the static
`/design/long-session-fixture` route and `npm run smoke:long-session`. That
fixture measures current long-session behavior before this roadmap changes any
runtime loading behavior.

Slice 15O added the first measured report in
`docs/performance/LONG_SESSION_MEASUREMENT_15O.md`. The fixture currently
renders and scrolls 120 transcript messages and 100 sidebar sessions
acceptably, while the collapsed export preview still constructs about 494 KB
of JSON on the default Context tab. The first recommended runtime target is
lazy construction of export preview JSON, not transcript virtualization.

Slice 15P implemented that first target in
`docs/performance/LAZY_EXPORT_PREVIEW_15P.md`. The Context rail now keeps the
local export summary visible while constructing the large preview JSON only
after the `Preview JSON` disclosure opens. The slice stayed local-only and did
not add backend export, import, pagination, infinite scroll, or virtualization.

Slice 15Q added the larger sidebar measurement in
`docs/performance/SIDEBAR_LARGE_MEASUREMENT_15Q.md`. The
`/design/sidebar-large-fixture` route renders 25 projects and 1,000 sessions
through the real Sidebar and the smoke recorded acceptable route load, scroll,
active-row selection, 0 service calls, and 0 px overflow. Based on that
evidence, Sidebar Show More and transcript virtualization are both deferred for
now.

Slice 15R added the large Files/artifacts and legacy tool-event measurement in
`docs/performance/ARTIFACTS_TOOLS_LARGE_MEASUREMENT_15R.md`. The
`/design/artifacts-tools-large-fixture` route renders 500 artifacts, 500 legacy
tool rows, and 500 collapsed activity detail groups through existing
components. The smoke recorded acceptable Files/Tools tab switches, right-rail
scroll timing, 0 service calls, and 0 px overflow. Based on that evidence,
Files/artifacts Show More, legacy tool-event pagination, and command-detail
lazy rendering are deferred for now.

## Why It Matters

Brain Memory Studio is expected to accumulate:

- long chat transcripts;
- many projects and sessions;
- recent chats;
- run history;
- live and persisted activity events;
- Brain Memory timelines;
- command logs and stdout/stderr previews;
- files and artifacts;
- future cross-channel sessions from CLI, API, Telegram, or other agents.

Without bounded rendering and progressive loading, large local workspaces can
become expensive to render, hard to navigate, and fragile under fast streams.

## Target Surfaces

| Surface | Future loading need |
| --- | --- |
| Chat transcript | Long transcript windowing, scroll restoration, and jump-to-latest behavior. |
| Left sidebar project/session list | Bounded project/session rows, `Show more`, and search/filter later. |
| Recent chats | Progressive loading and clear "more available" state. |
| Run history | Pagination or visible row limits before backend history exists. |
| Activity timeline | Batching, capped visible rows, and lazy details. |
| Memory timeline | Progressive session timeline loading and Gateway-backed pagination later. |
| Command stdout/stderr | Lazy expansion, truncation, and optional fetch handles for full output later. |
| Files/artifacts | Paged artifact lists and lazy previews/download metadata later. |
| Future cross-channel sessions | Server/Gateway-backed pagination and source-channel filters. |

## Desired UX

Future UX should support:

- `Show more` actions for panels where explicit loading is clearest;
- load more on scroll when the interaction is predictable;
- smooth scrolling with no visible jank;
- scroll restoration when switching sessions, projects, or tabs;
- bounded rendering for large lists;
- clear "more available" and loading states;
- stable focus and keyboard navigation;
- accessible controls for loading more content;
- lazy details rendering for raw JSON, command output, memory evidence, and
  large markdown/code blocks.

The UI should never silently hide important work. If more content exists, the
user should be able to see that more content is available.

## Technical Strategy

Preferred future strategy:

- pagination first where a backend or BFF can provide stable cursors;
- `Show more` controls for sidebars, run history, memory timeline, and recent
  chats before automatic infinite scroll;
- virtualization/windowing for genuinely large local lists;
- batching activity updates so fast streams do not rerender entire timelines;
- avoid per-token full transcript rerender;
- cap visible rows in activity, memory, command, and file panels;
- lazy-render expanded details only when opened;
- preserve keyboard and screen-reader access;
- preserve selected row, focus, and scroll position across updates.

This must stay compatible with the existing fast-stream rule: assistant text
streaming should be buffered and flushed in batches, not by one React update per
token.

## Staged Implementation

Most stages are deferred:

1. Docs/contract only.
2. Measure current transcript/list performance.
3. Lazily construct collapsed raw preview/details content.
4. Add list limits plus `Show more`.
5. Add run and memory timeline pagination.
6. Add chat transcript virtualization if needed.
7. Add cross-channel session discovery pagination later.

Each stage should include targeted checks or browser smokes before being used
as a release claim.

## Safety Requirements

Future scalable loading must preserve trust:

- no data loss;
- no hidden filtering;
- no silent event dropping;
- user-visible "more available" state;
- stable ordering for loaded items;
- explicit loading and error states;
- no direct browser-to-Hermes calls;
- no direct browser-to-Gateway calls;
- no direct storage access;
- no memory mutation/admin behavior.

Large raw payloads should remain redacted and collapsed by default. Loading more
must not bypass existing redaction, tenant/project/session scope, or BFF
boundaries.

## Not Implemented

Slices 15M through 15R do not implement:

- infinite scroll;
- virtualization/windowing;
- pagination;
- `Show more` runtime controls;
- scroll restoration changes;
- backend cursors;
- export/import;
- context compaction runtime;
- memory mutation/admin UI.

## Next Recommended Slice

After the Slice 15R Files/artifacts and legacy tool-event measurement, create a
scalable-loading decision checkpoint that consolidates 15N through 15R
measurements and chooses the first runtime implementation only if the evidence
now justifies one.
