# Brain Memory Regression Index 15K

Date: 2026-05-31

Status: MVP read-only regression index

## Scope

This index maps the current read-only Brain Memory Studio surfaces to the
checks that protect them. It is a launch-readiness reference for future slices:
new work should update this file when it changes Brain Memory read behavior,
adds coverage, or intentionally moves a deferred capability into scope.

Slice 15L adds the read-only launch gate in
`docs/product/BRAIN_MEMORY_READ_ONLY_QA_GATE_15L.md`.

The architecture remains:

```text
Browser UI
  -> Next.js BFF
    -> Hermes API server
    -> Brain Memory Gateway UI API
```

The browser does not call Brain Memory Gateway, Hermes, or storage directly.
No memory mutation/admin controls are part of the MVP read-only contract.

## Coverage Commands

Source checks:

- `npm run check:brain-memory-client`
- `npm run check:tenant-scope`
- `npm run check:workspace-state`
- `npm run check:agent-activity`
- `npm run check:agent-activity-rendering`
- `npm run check:ui-structure`
- `npm run check:brain-memory-regression-index`
- `npm run typecheck`
- `npm run build`
- `npm audit --audit-level=moderate`

Route/BFF smoke:

- `npm run smoke:mvp`
- `npm run smoke:mvp:live`

Browser smokes:

- `npm run smoke:ui`
- `npm run smoke:memory-detail`

Opt-in live smokes:

- `npm run smoke:ui:memory-live`
- `npm run smoke:ui:memory-scope`

## Regression Matrix

| Surface | Files | What It Verifies | Source Check | Browser Smoke | Live Smoke | Fixture Smoke | Default/Mock Behavior | Live Behavior | Deferred Capability | Known Limitations |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| BFF status route | `apps/web/src/app/api/brain-memory/status/route.ts`, `packages/brain-memory-client/src/index.ts` | Server-side Gateway status normalization without exposing keys to the browser. | `check:brain-memory-client`, `studio:doctor`, `smoke:mvp` source/route checks | `smoke:ui` observes status-dependent Memory panel state. | `smoke:mvp:live`, `smoke:ui:memory-live`, `smoke:ui:memory-scope` require real/reachable status. | Not covered by fixture. | Returns mock/unconfigured/error status when real Gateway is disabled or unavailable. | Returns `mode=real`, `reachable=true` when Gateway is configured and healthy. | Full auth/classification model. | `/ui/capabilities` may require authorization, so UI must tolerate `capabilities=null`. |
| BFF search route | `apps/web/src/app/api/brain-memory/search/route.ts`, `packages/brain-memory-client/src/index.ts`, `apps/web/src/lib/brainMemoryClient.ts` | Validates structured scope, bounds body/query size, calls Gateway search through server-side client, normalizes search response and scope fields. | `check:brain-memory-client`, `check:tenant-scope`, `smoke:mvp` | `smoke:ui` covers Memory tab/search surface without requiring live memory writes. | `smoke:mvp:live`, `smoke:ui:memory-live`, `smoke:ui:memory-scope` verify live search, scope isolation, and project-only reads. | Not covered by detail fixture. | Uses local mock evidence/results when BFF search is not real. | Finds scoped Gateway memories through `/api/brain-memory/search`. | Search ranking/filter polish, durable evidence links, export/import. | Project-only reads are project-broad and can return session-scoped memories from the same project. |
| BFF inspect/detail route | `apps/web/src/app/api/brain-memory/memory/inspect/route.ts`, `packages/brain-memory-client/src/index.ts`, `apps/web/src/lib/brainMemoryClient.ts` | Validates memory id and structured scope, calls Gateway detail/evidence/supersession endpoints through server-side client, normalizes safe scoped errors. | `check:brain-memory-client`, `check:ui-structure`, `smoke:mvp` | Detail opening is covered by live UI smoke when services are real; default `smoke:ui` covers no broken browser shell state. | `smoke:ui:memory-live`, `smoke:ui:memory-scope`, `smoke:mvp:live` | `smoke:memory-detail` covers detail rendering without service calls. | Mock detail uses local evidence only and labels Gateway detail unavailable. | Returns scoped detail, metadata, evidence status, supersession status, and safe wrong-scope 404 normalization. | Durable evidence storage, durable supersession storage, durable audit persistence. | Detail depends on a memory id from search/timeline; nonexistent ids produce safe normalized errors. |
| Memory Console status panel | `apps/web/src/components/memory/BrainMemoryStatusPanel.tsx`, `apps/web/src/components/memory/BrainMemoryConsole.tsx` | Shows Gateway mode/reachability without exposing credentials. | `check:ui-structure`, `smoke:mvp`, `studio:doctor` | `smoke:ui` opens Memory tab and validates the shell. | `smoke:ui:memory-live`, `smoke:ui:memory-scope` require real status before live checks. | Not covered by fixture. | Shows prepared/mock/unconfigured posture. | Shows connected real Gateway posture. | Auth/classification and richer capability policy display. | Capability details may be null until Gateway status contract is explicit. |
| Memory search UI | `apps/web/src/components/memory/BrainMemoryConsole.tsx`, `apps/web/src/hooks/useBrainMemorySearch.ts`, `apps/web/src/lib/brainMemoryClient.ts` | Search input, active project/session context, BFF-only browser call, normalized response handling. | `smoke:mvp` source checks, `check:tenant-scope`, `check:ui-structure` | `smoke:ui` verifies Memory tab and no browser errors. | `smoke:ui:memory-live`, `smoke:ui:memory-scope` | Not covered by fixture. | Filters local mock evidence when Gateway search is not real. | Sends scoped query through `/api/brain-memory/search`. | Advanced filters, export/import, memory mutation/admin actions. | Search submit is read-only; no direct Gateway browser calls are allowed. |
| Memory result cards | `apps/web/src/components/memory/BrainMemoryConsole.tsx` | Renders mock/local cards or Gateway result cards with source, score, evidence count, project/session, and supersession labels. | `smoke:mvp`, `check:ui-structure` | `smoke:ui` covers Memory tab shell. | `smoke:ui:memory-live`, `smoke:ui:memory-scope` validate live result scope. | Not covered by fixture. | Shows local mock evidence cards. | Shows Gateway cards from normalized search results. | Richer layer/source labels and result grouping. | Empty results are expected for scopes without matching memory. |
| Memory detail panel | `apps/web/src/components/memory/MemoryDetailPanel.tsx`, `apps/web/src/hooks/useMemoryInspection.ts` | Read-only detail label, scoped result label, detail fields, metadata redaction, safe close action. | `check:brain-memory-client`, `check:ui-structure`, `smoke:mvp` | `smoke:memory-detail`; live detail also covered by opt-in live smoke. | `smoke:ui:memory-live` opens live detail for the stored marker. | `smoke:memory-detail` | Mock detail explicitly says Gateway detail is unavailable in mock mode. | Shows Gateway-backed scoped detail and metadata-only audit. | Durable evidence/supersession/audit, memory mutation/admin controls. | Metadata is opaque diagnostics and redacted before display. |
| Evidence not_implemented state | `apps/web/src/components/memory/MemoryDetailPanel.tsx`, `packages/brain-memory-client/src/index.ts` | Normalizes `status=not_implemented`, empty evidence arrays, and honest UI copy. | `check:brain-memory-client`, `check:ui-structure` | `smoke:memory-detail` | `smoke:ui:memory-live` | `smoke:memory-detail` | Shows `Evidence: not implemented by Gateway yet.` | Shows the same not implemented state for current live Gateway responses. | Durable evidence storage and evidence item viewer. | No durable evidence item shape is claimed yet. |
| Supersession not_implemented state | `apps/web/src/components/memory/MemoryDetailPanel.tsx`, `packages/brain-memory-client/src/index.ts` | Normalizes `status=not_implemented`, empty chain arrays, and honest UI copy. | `check:brain-memory-client`, `check:ui-structure` | `smoke:memory-detail` | `smoke:ui:memory-live` | `smoke:memory-detail` | Shows `Supersession chain: not implemented by Gateway yet.` | Shows the same not implemented state for current live Gateway responses. | Durable supersession storage and read-only chain viewer. | No stale/supersede/admin action is exposed. |
| Audit metadata-only section | `apps/web/src/components/memory/MemoryDetailPanel.tsx`, `apps/web/src/data/memoryDetailFixture.ts` | Labels audit as metadata-only and redacts secret-like metadata keys/strings. | `check:ui-structure`, `smoke:mvp` | `smoke:memory-detail` | `smoke:ui:memory-live` checks metadata-only copy. | `smoke:memory-detail` | Disclosure is absent or metadata-only in mock/fixture contexts. | Shows opaque metadata only; no durable audit endpoint is claimed. | Durable audit persistence and Gateway audit endpoint. | No actor/caller history or mutation trail exists in current UI read contract. |
| Memory timeline | `apps/web/src/lib/memoryTimeline.ts`, `apps/web/src/components/memory/BrainMemoryConsole.tsx`, `apps/web/src/components/chat/AgentActivityBlock.tsx` | Derives compact read-only memory activity from normalized agent activity events, redacts details, hides inspect action unless Gateway is real/reachable. | `check:agent-activity`, `check:agent-activity-rendering`, `smoke:mvp` | `smoke:ui` checks empty state and rail behavior. | `smoke:ui:memory-live` verifies live memory activity in chat and right rail. | Not covered by fixture. | Shows honest empty state when no memory activity exists. | Shows live store/search/retrieve style activity when Hermes emits memory events. | Durable run history, durable memory event replay, richer evidence links. | Timeline is session React state, not durable memory history. |
| Tenant/scope diagnostics | `apps/web/src/components/shell/ContextRail.tsx`, `apps/web/src/lib/tenantScopeDiagnostics.ts`, `apps/web/src/app/api/tenant-scope/diagnostics/route.ts` | Verifies local tenant, stable key alignment, redacted key posture, and no secret printing. | `check:tenant-scope`, `check:workspace-state`, `smoke:mvp` | `smoke:ui` checks diagnostics presence in Context tab. | `smoke:ui:memory-live`, `smoke:ui:memory-scope` assert tenant/scope behavior. | Not covered by fixture. | Shows read-only diagnostics with redacted posture. | Shows aligned `local-dev` scope when live services are configured. | Full auth/classification model and production tenancy UI. | Local Gateway may still allow wildcard tenant posture in development, but product checks do not rely on fallback behavior. |
| Live memory activity blocks | `apps/web/src/components/chat/AgentActivityBlock.tsx`, `apps/web/src/types/agentActivity.ts`, `apps/web/src/lib/agentActivityEvents.ts` | Renders Brain Memory tool activity in chat without exposing raw secrets or requiring mutation controls. | `check:agent-activity`, `check:agent-activity-rendering`, `smoke:mvp` | `smoke:ui` covers block infrastructure; live memory block requires opt-in. | `smoke:ui:memory-live` | Not covered by fixture. | No block is shown until an activity event exists. | Shows Brain Memory activity from live Hermes stream events. | Durable activity replay across all channels. | Dependent on Hermes emitting normalized memory/tool events. |
| Project/session scope behavior | `docs/architecture/PROJECT_SESSION_MEMORY_SCOPE.md`, `apps/web/src/lib/workspaceStore.ts`, `apps/web/src/lib/memoryScopeBridge.ts`, `scripts/ui-interaction-smoke.mjs` | Stable tenant/project/session keys, session-scoped writes, same-session and different-session reads. | `check:tenant-scope`, `check:workspace-state`, `smoke:mvp` | `smoke:ui` covers stable local workspace shell behavior. | `smoke:ui:memory-scope`, `smoke:ui:memory-live` | Not covered by fixture. | Local state normalizes legacy `tenant-local` to `local-dev` for old defaults. | Live smoke verifies same session finds marker and different session/project do not. | Gateway-backed project/session persistence and auth. | Studio workspace state is still localStorage for MVP. |
| Project-only read behavior | `docs/checkpoints/PROJECT_ONLY_READ_SEMANTICS_15H.md`, `docs/architecture/PROJECT_SESSION_MEMORY_SCOPE.md`, `scripts/ui-interaction-smoke.mjs` | Separates project-only reads from future project-level writes. | `check:tenant-scope`, `smoke:mvp` | Not covered by default browser smoke. | `smoke:ui:memory-scope` | Not covered by fixture. | No memory write path omits session context. | Project-only search can find same-project session-scoped memories and reports `matching-project`. | Future project-level writes. | Project-only read is project-broad; this is read behavior only. |
| Non-live memory detail fixture | `apps/web/src/data/memoryDetailFixture.ts`, `apps/web/src/app/design/memory-detail-fixture/page.tsx`, `scripts/memory-detail-fixture-smoke.mjs` | Deterministic detail/evidence/supersession/audit rendering without service calls. | `check:ui-structure`, `smoke:mvp`, `check:brain-memory-regression-index` | `smoke:memory-detail` | Not live by design. | `smoke:memory-detail` | Static typed fixture only. | None; live compatibility is covered separately. | Durable evidence/supersession/audit. | Design route is not production navigation and does not prove Gateway payload compatibility. |
| Brain Memory client normalization | `packages/brain-memory-client/src/index.ts`, `scripts/check-brain-memory-client-shapes.mjs` | Normalizes status/search/inspect, safe scoped errors, not implemented payloads, missing arrays, scope counters, and no secret leakage. | `check:brain-memory-client` | Indirectly used by `smoke:mvp`, `smoke:ui:memory-live`, `smoke:ui:memory-scope`. | `smoke:mvp:live`, `smoke:ui:memory-live`, `smoke:ui:memory-scope` | Indirectly aligned with fixture contract. | Returns mock/unconfigured/error responses without leaking secrets. | Returns normalized real Gateway responses. | Export/import, auth/classification, mutation/admin. | Shape checks use mocked fetch cases and live behavior is covered by opt-in smokes. |

## Coverage Map

| Coverage Type | Primary Commands | Surfaces Protected |
| --- | --- | --- |
| Source contract | `check:brain-memory-client`, `check:tenant-scope`, `check:agent-activity`, `check:agent-activity-rendering`, `check:ui-structure`, `check:brain-memory-regression-index` | Client normalization, scope/tenant alignment, timeline/activity rendering, detail labels, fixture registration, this index. |
| Route/BFF smoke | `smoke:mvp`, `smoke:mvp:live`, `studio:doctor` | Root route, BFF status/search/inspect, Hermes stream route, live/mock service posture. |
| Browser smoke | `smoke:ui`, `smoke:memory-detail` | Shell Memory tab, diagnostics, rail behavior, non-live detail/evidence/supersession/audit fixture, no overflow/errors. |
| Live smoke | `smoke:ui:memory-live`, `smoke:ui:memory-scope` | Hermes -> Brain Memory store path, Gateway-mediated BFF search/inspect, timeline/activity blocks, tenant/scope isolation, project-only reads. |
| Fixture smoke | `smoke:memory-detail` | Memory detail panel rendering, not implemented evidence/supersession, metadata-only audit, metadata redaction, no service calls. |

## Deferred Capabilities

The following remain deferred and must not be implied by current read-only UI:

- full auth/classification model;
- production one-command CLI/bundle;
- durable evidence storage;
- durable supersession storage;
- durable audit persistence;
- memory mutation/admin actions;
- delete/supersede/pin/mark-stale controls;
- future project-level memory writes;
- export/import;
- automatic context compaction;
- manual context compaction;
- real stop/cancel streaming beyond current UI/BFF abort posture;
- provider/model selector polish.

## Guardrails

Confirmed read-only boundaries for Slice 15K:

- no memory mutation/admin UI was added;
- no delete, supersede, pin, mark-stale, edit, export/import, or admin controls
  are claimed by this index;
- no direct browser-to-Gateway path is added or claimed;
- no direct browser-to-Hermes path is added or claimed;
- no direct storage path is added or claimed;
- Brain Memory reads remain BFF-mediated and Gateway-authorized;
- the agent memory path remains UI -> Hermes -> Brain Memory MCP/skill ->
  Brain Memory Gateway.

## Next Recommended Slice

Slice 15M: refresh the release/RC notes to point at the read-only QA gate and
separate default, browser, and live Brain Memory claims.
