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

All stages are deferred:

1. Docs/contract only.
2. Measure current transcript/list performance.
3. Add list limits plus `Show more`.
4. Add run and memory timeline pagination.
5. Add chat transcript virtualization if needed.
6. Add cross-channel session discovery pagination later.

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

Slice 15M does not implement:

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

After the Slice 15N measurement baseline, add non-invasive measurement
reporting for the long-session fixture and then choose the first runtime
scalable-loading slice based on the measured bottleneck.
