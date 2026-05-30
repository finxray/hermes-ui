# Agent Orchestration UX Contract

Date: 2026-05-30

## Product Identity

Brain Memory Studio / Hermes UI is a local AI workspace, persistent memory
studio, Hermes-native agent cockpit, and orchestration console.

It should feel familiar to users of ChatGPT and Codex, but it is not only a
chat app. It is an agent orchestration studio for agents, tools, commands,
files, memory, providers, and future multi-agent workflows.

## What It Is

Brain Memory Studio / Hermes UI is:

- a ChatGPT-like project/session workspace;
- a Codex-like activity surface for agent work;
- a Hermes-native control plane for sessions, runs, tools, approvals, and
  stop/cancel;
- a transparent Brain Memory Studio for scoped memory search and evidence;
- an orchestration console for local and future packaged agent workflows.

## What It Is Not

It is not:

- a generic OpenAI chat-completion frontend;
- a thin skin over Hermes text streaming;
- a direct Brain Memory database UI;
- a replacement for Hermes as the agent runtime;
- a replacement for Brain Memory Gateway as the memory authority.

## Familiar But Distinct

ChatGPT contributes the familiar shape:

- projects;
- chat sessions;
- persistent conversation history;
- session titles;
- model selector expectations;
- files and exported conversations;
- keyboard-forward daily use.

Codex contributes the agent-work shape:

- visible thinking/progress;
- commands and tool execution;
- stdout/stderr and file diffs;
- approval gates;
- retry/error rows;
- elapsed-time separators;
- collapsed details with expandable raw output;
- run summaries and cancellation status.

Brain Memory Studio / Hermes UI adds the product-specific center:

- Hermes-native sessions/runs/events;
- transparent project/session memory scope;
- Brain Memory evidence and supersession visibility;
- Gateway-mediated memory search/detail;
- orchestration across tools, memory, files, providers, and future agents.

Core product sentence:

```text
This product should feel familiar like ChatGPT/Codex, but it is not only a chat app. It is an agent orchestration studio.
```

## ChatGPT-Like Feature Contract

| Feature | Product role | Current status | Notes |
| --- | --- | --- | --- |
| Persistent sessions | Core product feature | Partially implemented | Local browser persistence exists; server-side Studio persistence deferred. |
| Project-scoped sessions | Core product feature | Partially implemented | Local project/session model exists with explicit memory scope. |
| Session storage model | Core product feature | Partially implemented | Local storage exists; Hermes session reconciliation is weak. |
| Auto session title from first message | Core product feature | Planned next | Key feature, not optional polish. |
| AI-assisted title generation | Quality layer | Future | Should use Hermes once session send/title flow is stable. |
| Rename sessions/projects | Core management | Partially implemented | Local UX exists; Hermes title sync not complete. |
| Archive sessions/projects | Core management | Partially implemented | Local archive behavior exists. |
| Delete sessions/projects | Core management | Planned next | Needs careful local/Hermes/Brain Memory boundary rules. |
| Project context restoration | Core product feature | Partially implemented | Scope is visible; automatic context restoration needs deeper Hermes/Brain Memory integration. |
| Conversation search | Daily-use feature | Future | Should search local/Hermes history and later memory evidence intentionally. |
| Export/import | Portability | Future | Should include project/session/memory-scope metadata. |
| Pinned context | Memory UX | Partially implemented | Data fields exist; editing UX is deferred. |
| Session summaries | Navigation and memory | Future | Should be explicit user-visible summaries, not hidden prompt state. |
| Files/artifacts per project | Workspace UX | Partially implemented | Right rail lists local/mock artifact metadata; real file/artifact API is not present. |
| Memory-aware session switching | Differentiator | Partially implemented | Scope is displayed and sent; richer retrieval timeline is deferred. |
| Model/provider selector | Power-user control | Partially implemented | Disabled server-configured foundation exists; actual Hermes runtime switching needs live verification. |
| Keyboard shortcuts | Daily-use polish | Future | Must not obscure accessibility. |
| Multi-session history | Workspace UX | Partially implemented | Sidebar history exists locally. |

Session storage and auto-titling are key product features. They are not visual
polish. The product will not feel complete until a user can trust session
history, titles, and restoration.

## Codex-Like Activity Contract

Activity components must support real Hermes/agent events, not decorative mock
rows. Each component should have a compact timeline representation and richer
right-rail detail.

| Component | Purpose | Data required | Hermes event source if known | Visual behavior | Current status | Future slice |
| --- | --- | --- | --- | --- | --- | --- |
| Thinking shimmer | Show active reasoning/progress before useful text exists. | run/session id, status, startedAt. | `message.started`, `run.started`, `tool.progress` with `_thinking` or `reasoning.available`. | Subtle row while active; collapses after real content arrives. | Planned | 13F |
| Reasoning chunk | Show model/agent reasoning when exposed safely. | title, summary, text/deltas, privacy flag. | `tool.progress` reasoning payloads or future reasoning events. | Collapsed by default unless short and safe. | Planned | 13F |
| Command execution block | Show shell or command tool execution. | command, cwd, status, stdout/stderr preview, exit code, duration. | Tool events from Hermes/MCP tools when payload identifies command execution. | Compact row, expandable stdout/stderr. | Future | 13L |
| Tool execution row | Show tool lifecycle. | toolName, args preview, status, startedAt/completedAt, payload. | `tool.started`, `tool.completed`, `tool.failed`, run tool events. | Status icon and short summary; raw args hidden. | Partially implemented | 13E |
| Memory event row | Show retrieval/store/update activity. | memory id, action, scope, result count, layer/source. | Hermes Brain Memory tool events and Brain Memory Gateway responses. | Visible scope and outcome; details expandable. | Partially implemented | 13K |
| File/artifact event row | Show file creation/update/read artifacts. | file id/path, kind, action, status, preview. | Tool events or future Hermes file/artifact API. | Files rail can show mapped artifact metadata; preview/download deferred. | Partially implemented | 13I |
| Approval request | Block on user permission. | runId, approval id/session key, action, risk, choices. | `approval.request`. | Display-only waiting row on session stream; choices deferred until run-backed BFF route. | Partially implemented | 13H |
| Retry/error row | Explain failures and retry state. | error kind, message, retryable, source, raw payload. | `error`, `run.failed`, tool failed events. | Red/amber row with details collapsed. | Partially implemented | 13E |
| Elapsed time separator | Explain long-running work duration. | startedAt, completedAt, durationMs. | UI derived from run/tool events. | Text separator such as `Worked for 2m 13s`. | Future | 13F |
| Collapsed-by-default details | Prevent noisy timelines. | details payload, sensitive flag, default state. | All event types. | Details disclosure closed by default for raw payloads. | Planned | 13D |
| Expandable raw details | Debug and audit support. | raw event payload, source, ids. | All event types. | Monospace JSON/details panel. | Planned | 13D |
| Stdout/stderr preview | Show command output safely. | stdout, stderr, truncation, exit code. | Command/tool event payloads. | First lines inline; full output expanded. | Future | 13L |
| Run summary | Summarize completed work. | runId, status, output, usage, counts, duration. | `run.completed`, polled run status. | Final row or right-rail summary. | Future | 13M |
| Streaming status | Show active generation. | active run/message id, delta state, connection state. | session stream or run events. | Live status in composer/header. | Partially implemented | 13F |
| Cancellation status | Confirm real stop/cancel result. | runId, requestedAt, completedAt, final status. | `/v1/runs/{id}/stop`, `run.cancelled`, polled run status. | Clear stopped/stopping/cancelled state. | Partially implemented | 13G |

## Orchestration Tools Surface

The right rail and future orchestration surfaces must accommodate agents
interacting with many tools, not only one chat response.

Required surfaces:

- active agent status;
- current Hermes session;
- current Hermes run;
- current model/provider;
- capabilities and endpoint availability;
- tool registry from `/v1/skills` and `/v1/toolsets`;
- running tools;
- command history;
- memory retrieval events;
- memory store events;
- recent Brain Memory event timeline;
- files/artifacts;
- approval requests;
- environment/status;
- logs;
- retries/failures;
- future multi-agent view;
- Cerebras/Kimi fast-streaming considerations.

## Right-Rail Contract

The right rail should remain an operational console, not a decorative sidebar.

Suggested panels:

- `Context`: project/session scope, Hermes session/run ids, model/provider,
  status, capability summary.
- `Memory`: Brain Memory search/detail/evidence/scope state.
- `Activity`: tools, commands, approvals, run events, errors, elapsed time.
- `Files`: artifacts and generated/read files when a real source exists.
- `Environment`: health, logs, retries, provider state, future multi-agent
  status.

## Fast-Streaming Considerations

Hermes UI must stay ready for very fast providers.

Contract:

- Do not update React state once per token.
- Buffer stream deltas.
- Flush text with `requestAnimationFrame` or bounded intervals.
- Virtualize long transcripts before high-volume use.
- Keep raw event payload rendering collapsed and lazy.
- Track duration and throughput in dev/test surfaces before optimizing blindly.

## Commercial-Grade UX Bar

The product should eventually answer these questions without the user guessing:

- What is Hermes doing right now?
- Which session and run is active?
- Which model/provider is actually being used?
- Which tools ran?
- What did the tools read/write/execute?
- Which memory scope was used?
- Which memories were retrieved or stored?
- Is the agent waiting for approval?
- Can this run be stopped for real?
- What failed, and where can I see details?
- What files/artifacts came out of the work?
