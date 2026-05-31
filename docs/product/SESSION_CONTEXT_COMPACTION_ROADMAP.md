# Session Context Compaction Roadmap

Date: 2026-05-31

Status: Deferred product contract. Not implemented.

## Scope

Session Context Compaction is a future Brain Memory Studio capability for long
sessions. It means turning older, user-visible conversation and tool context
into compact summaries that can help Hermes and future agents continue work
without forcing the full transcript and activity history back into every
prompt.

This is a roadmap note only. Slice 15L does not add automatic compaction,
manual compaction, runtime summarization, compacted memory writes, UI controls,
routes, or storage behavior.

## Why It Matters

Long agent sessions accumulate:

- decisions and constraints;
- files touched;
- commands and tool activity;
- memory search/store events;
- errors and recoveries;
- open tasks and next steps.

Without a transparent compaction model, a long-running workspace can become
hard to resume, expensive to send to models, and easy to distort. The future
feature should preserve the user-visible facts that matter while making clear
what was summarized and when.

## Difference From ChatGPT/Codex Internal Compaction

ChatGPT/Codex may internally compact conversation context to keep a thread
usable. Brain Memory Studio should not treat that hidden platform behavior as a
product feature.

Future Studio compaction should be:

- user-visible;
- scoped to the active tenant, project, and session;
- inspectable in the UI;
- auditable through Gateway-approved metadata;
- explicit about what message/run range was covered;
- free of hidden chain-of-thought;
- safe to include or exclude from future Hermes context.

Internal platform compaction is outside this repo and cannot be inspected or
controlled by the Studio. Session Context Compaction would be a future Studio
feature with its own contract and regression checks.

## Desired Studio Behavior

Future Brain Memory-backed behavior should start with manual compaction and
only later add automatic thresholds.

Desired user-facing flow:

1. The Studio detects that a session is long or the user chooses to compact.
2. The Studio summarizes older user-visible conversation, assistant output, and
   redacted activity metadata.
3. The summary is stored through the approved Brain Memory path with explicit
   project/session scope.
4. The transcript shows `Context compacted`.
5. The user can inspect the summary.
6. The user can decide whether compacted context is included for future turns.
7. Future Hermes prompts can receive compacted summaries as visible context,
   not as hidden reasoning.

The agent memory path must remain:

```text
UI -> Hermes -> Brain Memory MCP/skill -> Brain Memory Gateway
```

Any read/inspection path must remain:

```text
UI -> Web UI BFF -> Brain Memory Gateway UI/Admin API
```

## Data Model Ideas

Future compacted summary records may need:

| Field | Purpose |
| --- | --- |
| `compactedSummaryId` | Stable Gateway-owned id for the compacted summary. |
| `projectKey` | Project memory scope key. |
| `sessionKey` | Session memory scope key. |
| `sourceRunIds` | Run ids included in the compacted range. |
| `coveredMessageRange` | First/last message ids or timestamps covered. |
| `decisions` | Durable user-visible decisions made in the range. |
| `constraints` | Requirements, non-goals, safety boundaries, and project rules. |
| `openTasks` | Remaining work and unresolved questions. |
| `filesTouched` | Paths or artifact ids touched, with redacted summaries. |
| `toolActivitySummary` | Redacted summary of commands/tools/memory activity. |
| `memoryLinks` | Related Brain Memory ids or search/detail references. |
| `createdAt` | Summary creation timestamp. |
| `createdBy` | User, agent, or system actor label without secrets. |

These are ideas, not an implemented schema.

## UI Ideas

Future UI could include:

- `Context compacted` transcript/timeline marker;
- `View summary`;
- include/exclude compacted context toggle;
- compaction timeline in the Context or Memory rail;
- message/run range display;
- links to related memories, files, and run records;
- warning state when a summary is stale or excluded.

No UI controls are implemented in Slice 15L.

## Safety Requirements

Future compaction must follow these boundaries:

- no hidden chain-of-thought;
- user-visible summaries only;
- redaction before display, storage, and export;
- no silent fact changes;
- no silent mutation of session or memory state;
- tenant/project/session scope on every write and read;
- Gateway-mediated storage and inspection;
- no direct browser-to-Gateway calls;
- no direct browser-to-Hermes calls;
- no direct storage access;
- audit metadata for who/what created the summary and why;
- clear distinction between summary facts, inferred next steps, and model
  suggestions.

## Staged Implementation

All stages are deferred:

1. Docs/contract only.
2. Manual compact session action.
3. Store compacted summary in Brain Memory.
4. Retrieve compacted summary for future prompts.
5. Automatic compaction threshold.
6. Compaction audit trail.

Each implementation stage needs its own slice, contract update, regression
checks, and explicit confirmation that no hidden chain-of-thought is exposed.

## Not Implemented

Slice 15L does not implement:

- automatic compaction;
- manual compaction;
- summarizing live sessions;
- compacted memory writes;
- compaction routes;
- compaction scripts;
- compaction UI controls;
- memory mutation/admin UI;
- export/import.

## Next Recommended Slice

When the team is ready to begin this feature, start with a docs-only manual
compaction contract slice that defines the exact user-visible summary format
and approval flow before adding runtime behavior.
