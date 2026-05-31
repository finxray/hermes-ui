# Long-Session Performance Measurement Plan 15N

Date: 2026-05-31

This is a measurement checkpoint before scalable loading work. It documents the current render posture, fixture coverage, and first smoke gate for long sessions. It does not implement infinite scroll, virtualization, runtime pagination, context compaction, export/import, or any service integration changes.

## Scope

In scope:

- Measure the current production UI surfaces that may degrade with long sessions.
- Add deterministic local fixture data for long transcript, sidebar, run history, replay, memory, tool, and artifact surfaces.
- Add a design-only route at `/design/long-session-fixture`.
- Add a lightweight browser smoke command, `npm run smoke:long-session`.
- Keep all fixture data local, static, and free of Hermes, Brain Memory, localStorage, direct storage, or service calls.

Out of scope:

- Infinite scroll, virtualization, runtime pagination, list truncation changes, or `Show more`.
- Chat transcript, sidebar, memory timeline, or right-rail runtime behavior changes.
- Hermes streaming logic, Brain Memory BFF logic, memory scope bridge changes, or stable key changes.
- Memory mutation/admin UI, direct browser-to-Gateway calls, direct browser-to-Hermes calls, and storage access.

## Current Surface Audit

| Surface | Current render behavior | Existing bound | Lazy/collapsed behavior | Current risk |
| --- | --- | --- | --- | --- |
| Chat transcript | `ChatTranscript` maps every `activeSession.messages` item to `MessageBubble`. | No transcript-level cap or virtualization. | Message markdown code/table overflow is internally bounded; copy controls are per message. | Highest risk with 100+ rich assistant messages. |
| Live streaming message | `ChatView` buffers stream deltas with `requestAnimationFrame` before state updates. | Sends recent context with `session.messages.slice(-12)`. | Markdown highlighting is avoided while streaming. | Good current streaming posture, but long completed transcripts still render in full. |
| Live activity block | `AgentActivityBlock` groups all supplied `activityEvents`. | Live run activity in `ChatView` is capped to the last 80 events. | Activity details are collapsed by default and JSON previews are truncated. | Moderate risk if grouped summaries grow or caps are bypassed. |
| Sidebar projects/sessions | `Sidebar` renders all projects and all visible sessions under each project. | Recent chats section is capped to 2; project/session list has no cap. | No lazy loading. | Moderate risk for many projects/sessions. |
| Run history | `ContextRail` sorts run records and renders `.slice(0, 8)`. | Workspace reducer normalizes `runRecords` to 24. | Selected run detail renders one run; persisted replay list renders `.slice(-8)`. | Low current risk; future backend run history needs pagination. |
| Persisted replay | `PersistedActivityEvent[]` normalizes to `.slice(-40)` per run. | Right rail selected-run replay renders `.slice(-8)`. | Detail previews are bounded/redacted. | Low current risk. |
| Export preview | Context rail builds a local preview from the active session. | Persisted replay is bounded by the current local model; transcript preview includes all messages. | Preview JSON is inside collapsed `<details>`. | Moderate risk if the collapsed JSON string becomes large enough to affect render. |
| Memory console search/detail | Search limit is 8 for Gateway results; mock search maps matching fixture evidence. | Timeline uses `.slice(-12)`; detail `safeJson` truncates long JSON. | Detail/evidence/supersession/audit areas are collapsed or bounded. | Low current risk for MVP; future real evidence/audit pagination still needed. |
| Tools tab | Command activity filters live command events and renders `.slice(-8)`; legacy `toolEvents` map all items. | Live commands are bounded to 8; legacy tool list has no explicit UI cap. | Command previews are visually bounded. | Low to moderate risk for legacy/local tool events. |
| Files tab | Renders all `activeSession.artifacts`. | No explicit UI cap. | Download/preview controls are disabled; rows are compact. | Moderate risk with many artifacts. |

## Fixture Coverage

`apps/web/src/data/longSessionFixture.ts` provides static deterministic data:

- 5 projects.
- 100 visible sidebar sessions.
- 120 transcript messages.
- 80 activity events.
- 24 run records.
- 10 persisted replay events per run.
- 16 memory evidence rows.
- 20 legacy tool events.
- 18 artifact rows.

`/design/long-session-fixture` renders existing `Sidebar`, `ChatTranscript`, and `ContextRail` components with that fixture data. The route does not read or write localStorage and does not call Hermes, Brain Memory, Web UI BFF APIs, or storage backends.

## Smoke Gate

Command:

```powershell
npm run smoke:long-session -- --base-url http://127.0.0.1:3002
```

Default behavior uses the shared smoke base-url selector when no `--base-url` is passed.

The smoke checks:

- route loads,
- static Next chunks are fresh,
- existing sidebar, transcript, and right rail render,
- 120 transcript message articles render,
- 100 sidebar session rows render,
- collapsible details exist and are closed by default,
- transcript scroll responds within one animation frame budget check,
- document has no horizontal overflow,
- route makes no `/api/*`, Hermes, Brain Memory Gateway, or storage-service requests,
- no browser console, page, or relevant network errors are captured.

These checks are a measurement baseline. They do not prove production readiness for unlimited data.

## Measurement Targets For Future Slices

Initial targets before implementing scalable loading:

- 100+ message transcript remains usable on a 1440 x 900 viewport.
- No page-level horizontal overflow at desktop and narrow widths.
- Long code blocks and wide tables scroll inside message containers.
- Collapsed details stay collapsed by default for replay, activity, diagnostics, export preview, and memory detail JSON.
- Completed transcript render should avoid visible lockups during basic scroll checks.
- Streaming should continue using requestAnimationFrame batching and must not update React state once per token.
- Rich markdown should avoid expensive eager syntax highlighting while streaming.
- Large lists should show explicit "more available" states before data is hidden or truncated.
- Future pagination/windowing must preserve keyboard navigation, accessible labels, active selection, and visible loading state.

## Known Remaining Issues

- Chat transcript still renders every active message.
- Sidebar still renders every visible project session.
- Files tab renders all artifact rows.
- Legacy tool event rows render all `activeSession.toolEvents`.
- Export preview builds full local preview JSON even though it is collapsed.
- The long-session smoke uses a synthetic static fixture, not live user history.
- No performance trace, heap snapshot, or CI budget enforcement exists yet.

## Deferred Features

- Runtime transcript virtualization/windowing.
- Runtime sidebar pagination or "Show more".
- Runtime run-history or memory-timeline pagination.
- Context compaction runtime.
- Backend export/import.
- Durable evidence/supersession/audit storage.
- Memory mutation/admin actions.
- Full auth/classification model.
- Production one-command CLI.

## Next Recommended Slice

Slice 15O: add non-invasive long-session measurement reporting around the fixture and existing UI surfaces, then decide whether the first runtime scalable-loading slice should be sidebar `Show more`, transcript windowing, or export preview bounding.
