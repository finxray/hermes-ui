# Hermes UI — MVP Checkpoint (2026-06-02)

## Current State

Stable MVP with session history, full markdown rendering, Brain Memory read-only console, and streaming chat. Experimental Runs infrastructure pruned. 0 npm audit vulnerabilities.

## Commits

| Hash | Description |
|------|-------------|
| `93e32d9` | fix: stabilize check-ui-structure after Runs prune, remove duplicate CSS |
| `ec0cef5` | feat: Brain Memory console polish — markdown details, pagination, loading skeletons, evidence timeline |
| `fbaafea` | fix: harden markdown rendering — update stale check assertions, fix narrow-layout CSS |
| `deaa4d5` | feat: ChatGPT-style markdown rendering with syntax-highlighted code blocks and copy button |
| `fc367bc` | chore: prune experimental Runs infrastructure |
| `b8bcb7f` | feat: add Hermes session history and workspace persistence |

## BFF Routes

**Production routes (10):**

| Route | Method(s) | Purpose |
|-------|-----------|---------|
| `POST /api/hermes/chat/stream` | POST | Streaming chat via Hermes |
| `GET /api/hermes/sessions` | GET, POST | Session list + create |
| `GET /api/hermes/sessions/[id]` | GET, DELETE | Session fetch/delete |
| `GET /api/hermes/sessions/[id]/messages` | GET | Session message history |
| `GET /api/hermes/status` | GET | Hermes health/models |
| `POST /api/hermes/model/select` | POST | Model selection (BFF stub) |
| `GET /api/brain-memory/status` | GET | Brain Memory health/config |
| `GET /api/brain-memory/search` | GET | Memory search |
| `GET /api/brain-memory/memory/inspect` | GET | Memory detail + evidence |
| `GET /api/tenant-scope/diagnostics` | GET | Tenant scope diagnostics |

**Design fixture pages (6):**

`/design/markdown-fixture`, `/design/markdown-long-fixture`, `/design/long-session-fixture`, `/design/memory-detail-fixture`, `/design/sidebar-large-fixture`, `/design/artifacts-tools-large-fixture`

## What Works

- Session history sidebar with restore/delete (Hermes API sessions CRUD, BFF-proxied)
- Workspace persistence (active session survives page reload)
- Markdown rendering: GFM tables, lists, headings, inline code, blockquotes
- Syntax-highlighted code blocks with copy button (rehype-prism-plus)
- Streaming-safe rendering: prism disabled mid-stream, remark-gfm active throughout
- Message-level copy button
- Brain Memory read-only console: search, inspect drawer, evidence timeline
- Brain Memory search pagination ("show more")
- Brain Memory timeline with visual connectors and loading skeletons
- Brain Memory status panel (mode, configuration, capabilities)
- Production chat via `/api/hermes/chat/stream`
- Model selector visible in composer (display-only; real session-level switching deferred)
- 6 design fixtures for visual regression reference

## What Was Pruned

Experimental Runs infrastructure removed in `fc367bc`:

- 8 BFF routes (`/api/hermes/runs/*`)
- 5 lib files (runs client, event normalizer, run record helpers)
- 2 type files (runs types, approval types)
- 5 fixture/data files (run event fixtures, approval fixtures)
- 11 check/smoke scripts for Runs
- ContextRail Runs integration
- Runs-related `package.json` scripts
- `check-agent-access-policy.mjs` (type merged inline into `agentAccessPolicyFixtures.ts`)

## Safety Invariants

- No `dangerouslySetInnerHTML`, `eval`, or `new Function` in UI code
- `skipHtml: true` on `react-markdown` (no raw HTML injection)
- `safeHref` validation for all markdown-rendered links
- Secret/credential redaction in memory metadata display
- Brain Memory console is read-only (no delete, supersede, pin, or admin controls)
- All BFF calls proxied through Next.js API routes (no browser-to-Hermes direct calls)
- No browser-to-storage path; no Brain Memory storage bypass
- Chat transport unchanged (`/api/hermes/chat/stream`)
- Session history uses Hermes API sessions CRUD (no localStorage bypass)
- 0 npm audit vulnerabilities

## Checks

**Check scripts (13):**

```
check:agent-activity              check-agent-activity-events.mjs
check:agent-activity-rendering    check-agent-activity-rendering.mjs
check:brain-memory-client         check-brain-memory-client-shapes.mjs
check:brain-memory-regression-index  check-brain-memory-regression-index.mjs
check-message-rendering           check-message-rendering.mjs
check:packaging                   check-packaging-readiness.mjs
check:studio-launch               check-studio-launch-contract.mjs
check:tenant-scope                check-tenant-scope-diagnostics.mjs
check:ui-structure                check-ui-structure.mjs
check:workspace-state             check-workspace-state.mjs
check:hermes-model-capabilities   check-hermes-model-capabilities.mjs
typecheck                         tsc --noEmit
build                             next build
```

**Smoke scripts (8, fixtures only — no live Hermes required):**

```
smoke:mvp                         mvp-smoke.mjs
smoke:markdown                    markdown-fixture-smoke.mjs
smoke:markdown:long               markdown-long-fixture-smoke.mjs
smoke:long-session                long-session-performance-smoke.mjs
smoke:memory-detail               memory-detail-fixture-smoke.mjs
smoke:sidebar:large               sidebar-large-smoke.mjs
smoke:artifacts-tools:large       artifacts-tools-large-smoke.mjs
smoke:ui                          ui-interaction-smoke.mjs (Playwright, headless)
```

**Release gate:** `npm run release:check` (runs packaging + studio-launch + workspace-state + brain-memory-client + brain-memory-regression-index + agent-activity + agent-activity-rendering + message-rendering + ui-structure + typecheck + build + audit)

## Deferred

| Item | Notes |
|------|-------|
| Web UI model switching | Needs Hermes API session-level model override endpoint; BFF stub exists |
| Runs re-architecture | Pruned; not removed from roadmap docs |
| Export contracts | Session export as JSON/markdown with redaction |
| Brain Memory write/curate/RAGLight rebuild | Explicitly out of scope |
| Full mobile responsive layout audit | ContextRail sidebar on narrow viewports |
| Virtualization for large transcripts | React-virtuoso or similar for 1000+ message sessions |

## Recommended Next Blocks

1. **Real model switching** — Implement Hermes API session-level model override endpoint, add BFF route, enable composer selector with live switching feedback.
2. **Export contracts** — Session export as JSON/markdown with credential redaction; BFF route + download UI.
3. **Mobile/responsive layout pass** — Audit ContextRail sidebar at 360px+, ensure chat view is usable on narrow viewports.
