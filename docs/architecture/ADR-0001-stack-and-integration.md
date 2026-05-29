# ADR-0001: Stack And Integration

Status: Accepted for initial planning
Date: 2026-05-29

## Context

Hermes UI / Brain Memory Studio is a local, ChatGPT-like workspace for Hermes Agent with a dedicated Brain Memory console. It must support multiple projects, titled sessions, project-scoped context, streamed agent responses, memory evidence, and later controlled memory administration.

The governing boundary is:

```text
Browser UI -> Web UI BFF -> Hermes Agent -> Brain Memory MCP/skill -> Brain Memory Gateway -> storage
Browser UI -> Web UI BFF -> Brain Memory Gateway UI API -> controlled read/admin endpoints -> storage
```

The UI must not read or write Postgres, Redis, Qdrant, RAGLight, or any Brain Memory storage layer directly. It must also not duplicate Hermes' agent runtime, state machine, tools, or approval logic.

Hermes discovery on 2026-05-29 verified a rich API surface beyond plain chat completions: `/v1/responses`, `/api/sessions`, `/v1/runs`, run events, approval response, stop, capabilities, skills, toolsets, health, and session/memory scoping headers.

## Decision

Use a TypeScript monorepo with a Next.js web app and small typed client packages:

```text
hermes-ui/
  apps/
    web/                    # future Next.js/React app and BFF route handlers
  packages/
    hermes-client/           # typed Hermes API client
    brain-memory-client/     # typed Brain Memory Gateway UI client
    ui/                      # shared UI primitives when useful
  docs/
  scripts/
```

Do not scaffold the app during Slice 00. Create the structure later when Slice 01 asks for the static design shell.

## Frontend Stack

Recommended initial stack:

- Next.js App Router with React and TypeScript.
- Server route handlers used as the local BFF.
- CSS variables plus a small component layer for the OpenAI-inspired dark theme.
- TanStack Query or equivalent server-state cache once real API calls begin.
- Zustand or a small context/store for local UI state such as active project, active session, open panels, composer draft, and streaming display state.
- Virtualized transcript and memory result lists once real data can grow large.

Reasoning:

- Next.js gives one local app with browser UI and server-side BFF routes, which keeps secrets server-side without adding a separate API service too early.
- React is strong for chat UI, split panes, drawers, keyboard flows, and incremental rendering.
- TypeScript client packages keep Hermes and Brain Memory contracts out of presentation components.
- The monorepo leaves room for packaging, tests, and future BFF extraction without forcing that complexity now.

## Backend/BFF Approach

The browser should call only the Web UI BFF. The BFF should:

- attach Hermes and Brain Memory API keys server-side;
- enforce active `project_id`, `session_id`, `tenant_id`, and memory-scope metadata;
- normalize errors into UI-safe envelopes;
- expose a browser-friendly stream from Hermes without per-token React state churn;
- proxy Brain Memory Gateway UI endpoints without exposing raw storage internals;
- combine Hermes and Brain Memory health into one UI status surface;
- apply local auth and origin policy before forwarding requests to powerful agent endpoints.

The BFF can start as Next.js route handlers. A separate API server is only justified later if packaging, long-running connection handling, or non-Next clients require it.

## Why Not Browser To Hermes Directly

Browser-to-Hermes direct access is not preferred because Hermes controls a real agent runtime with terminal/file/web tools. The official Hermes API server requires bearer auth and disables browser CORS by default unless explicit origins are configured. Direct browser access would put Hermes API keys in browser JavaScript or local storage, widen the blast radius of XSS, and make it harder to enforce project/session/memory scope consistently.

Browser -> BFF -> Hermes/Brain Memory is preferred because the BFF can keep keys private, apply per-project scope, translate stream formats, hide internal endpoints, and present one stable contract to the UI as Hermes evolves.

## Project And Session Mapping

Use explicit Studio-owned entities and map them to Hermes and Brain Memory metadata:

```text
Project
  id
  tenant_id
  name
  description
  memory_scope_key
  default_model
  created_at
  updated_at

ChatSession
  id
  project_id
  hermes_session_id
  hermes_response_id?
  title
  summary
  model
  created_at
  updated_at
  archived_at?
```

Project context:

- `project.id` is the UI grouping key.
- `project.tenant_id` scopes user/workspace ownership.
- `project.memory_scope_key` becomes the stable Brain Memory/Hermes memory-scope value.
- Send `X-Hermes-Session-Key` as a stable scope such as `studio:{tenant_id}:project:{project_id}` or another Gateway-approved format.

Session context:

- `chat_session.id` is the Studio UI session id.
- `chat_session.hermes_session_id` should map to Hermes' transcript/session id.
- Send `X-Hermes-Session-Id` or `session_id` when using Hermes APIs that support it.
- For Responses, track `previous_response_id` or named `conversation` when using server-side response chaining.

Brain Memory context:

- UI memory calls must include `tenant_id` and `project_id`.
- Session-specific inspection calls may include `session_id` and `hermes_session_id`.
- The Gateway decides how those map to memory layers and storage.

## Hermes Session Strategy

Use a wrapped native-session model:

- Studio owns project and UI metadata.
- Hermes remains authoritative for agent transcript execution and agent-side memory behavior.
- Prefer Hermes `/api/sessions` for persisted session records, titles, message history, forks, and session chat when the capability endpoint advertises support.
- Mirror only the metadata needed for fast navigation and stable UI ids.
- Do not duplicate Hermes messages as the authoritative agent state. A BFF cache may store previews, titles, selected ids, and reconciliation markers.

For a rich UI, `/v1/chat/completions` alone is not enough. It is useful as a compatibility fallback, but the first real integration should prefer:

- `/v1/capabilities` to discover supported features;
- `/api/sessions` for session lifecycle and message history;
- `/api/sessions/{id}/chat/stream` for simple persisted-session streaming;
- `/v1/runs` plus `/v1/runs/{id}/events` for long-running runs, approvals, cancellation, and reconnect-friendly status;
- `/v1/responses` when OpenAI Responses semantics and `previous_response_id` chaining fit better than session-chat.

## Initial API Client Structure

Future package boundaries:

```text
packages/hermes-client/
  src/client.ts
  src/types.ts
  src/sse.ts
  src/capabilities.ts
  src/sessions.ts
  src/runs.ts
  src/responses.ts

packages/brain-memory-client/
  src/client.ts
  src/types.ts
  src/projects.ts
  src/sessions.ts
  src/memory.ts
  src/audit.ts
```

The browser should not import these server-side clients directly if they attach secrets. Browser-facing functions should call `/api/studio/*` BFF routes.

## State Management

Recommended split:

- Server state: TanStack Query for projects, sessions, messages, health, capabilities, memory search, audit, and evidence.
- UI state: lightweight Zustand/context store for active ids, panel visibility, filters, composer draft, optimistic title edits, and streaming display buffers.
- Stream state: stream parser writes into an append-only external buffer; React reads batched snapshots on `requestAnimationFrame` or coarser intervals.
- Transcript rendering: virtualize long transcripts and memory results, and avoid rerendering the full page on every stream chunk.

## Security Rules

- Do not expose Hermes, Brain Memory, model provider, or database credentials to browser JavaScript.
- Keep Hermes bound to `127.0.0.1` by default.
- Do not require Hermes CORS for the normal app path because the BFF calls Hermes server-to-server.
- If CORS is ever enabled for direct debugging, use explicit localhost origins only, never `*` for a powerful local agent.
- Require a Hermes `API_SERVER_KEY` even on loopback.
- Treat Hermes as high privilege because it can run tools, terminal commands, file operations, and external calls depending on configuration.
- Add Studio auth before exposing beyond localhost or local desktop packaging.
- Validate and bound all session ids, project ids, memory ids, and headers before forwarding.
- Use idempotency keys for message send/retry when Hermes supports them.
- Do not expose raw Brain Memory storage identifiers beyond Gateway-approved public ids.

## Streaming Strategy

Normal-speed providers:

- Consume SSE in the BFF or browser-facing route.
- Parse events into typed envelopes: text deltas, tool start/complete, approval request/responded, run lifecycle, error, completion.
- Batch UI updates with `requestAnimationFrame`, a short interval, or a streaming external store.

Very-fast providers:

- Design now for providers around hundreds to about 1,000 output tokens/sec.
- Never call React state setters once per token.
- Accumulate deltas in mutable buffers keyed by message/run id.
- Flush rendered text at frame or chunk boundaries.
- Virtualize long transcripts.
- Keep tool/event panes separate from assistant text so structured events do not force transcript rerenders.
- Capture throughput metrics later in dev mode.

Do not implement fast-provider mode in Slice 00 or Slice 01.

## Brain Memory UI Endpoint Assumptions

The UI will call only Gateway-controlled endpoints. The initial proposal is documented in `docs/architecture/BRAIN_MEMORY_UI_ENDPOINTS_PROPOSAL.md`.

Assumptions:

- Gateway owns project/session/memory authorization.
- Read-only endpoints come first: health, projects, sessions, messages, memory search, memory detail, evidence, supersession chain, and audit.
- Mutating admin endpoints are future-only and must be explicit, audited, and policy-controlled.
- Gateway may internally read Postgres, Redis, Qdrant, RAGLight, or other storage, but the UI and BFF must not.

## Consequences

Positive:

- Preserves Hermes and Brain Memory ownership boundaries.
- Gives a polished web app without leaking credentials.
- Supports rich sessions, runs, approvals, stop/cancel, and memory evidence.
- Leaves room for high-throughput streaming.

Tradeoffs:

- A BFF adds one integration layer.
- Studio will need reconciliation between UI metadata and Hermes sessions.
- Real capabilities must be feature-detected at runtime because Hermes is moving quickly.

## Open Questions

- Which Brain Memory Gateway endpoints already exist, and which must be added?
- Should Studio persist its project/session metadata in a local file, SQLite, or a Gateway-backed store?
- Which Hermes path should Slice 04 use first: `/api/sessions/{id}/chat/stream`, `/v1/runs`, or `/v1/responses`?
- How should project memory scopes be named to align with Brain Memory tenant/project/session semantics?
- What local auth model is required before exposing the UI beyond loopback?
- How long does Hermes retain completed run status and events in practice?
- Are Hermes run approval event payloads stable enough for first-class UI, or should approval UI remain capability-gated?

