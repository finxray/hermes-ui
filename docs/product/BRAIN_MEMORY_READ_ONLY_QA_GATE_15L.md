# Brain Memory Read-Only QA Gate 15L

Date: 2026-05-31

Status: MVP read-only launch gate

## Purpose

This gate defines what must pass before claiming the Brain Memory Studio MVP
read-only surfaces are launch-ready. It complements the regression index in
`docs/product/BRAIN_MEMORY_REGRESSION_INDEX_15K.md`.

The gate is for read-only Brain Memory behavior only. It does not approve
memory mutation/admin actions, project-level writes, durable evidence storage,
durable supersession storage, durable audit trails, export/import, or automatic
context compaction.

## Required Default Checks

These checks do not require live Hermes or live Brain Memory Gateway:

| Check | Purpose |
| --- | --- |
| `npm run check:brain-memory-client` | Brain Memory client normalization, safe errors, not implemented payloads, and secret redaction. |
| `npm run check:brain-memory-regression-index` | Regression index, QA gate, compaction roadmap, read-only guardrails, and deferred claims. |
| `npm run check:tenant-scope` | Tenant/project/session scope alignment and redacted diagnostics. |
| `npm run check:workspace-state` | Local project/session state and stable key behavior. |
| `npm run check:ui-structure` | Memory detail labels, fixture route registration, and no forbidden detail controls. |
| `npm run typecheck` | TypeScript contract health. |
| `npm run build` | Production build health. |
| `npm audit --audit-level=moderate` | Dependency vulnerability gate. |

All required default checks must pass before claiming the read-only Brain
Memory MVP baseline is intact.

## Optional Browser And Fixture Checks

These checks require a healthy selected Web UI base URL:

| Check | Purpose |
| --- | --- |
| `npm run smoke:ui -- --base-url http://127.0.0.1:<port>` | Shell, rails, Memory tab, diagnostics, composer, and overflow smoke. |
| `npm run smoke:memory-detail -- --base-url http://127.0.0.1:<port>` | Non-live Memory detail/evidence/supersession/audit fixture smoke. |
| `npm run smoke:mvp -- --base-url http://127.0.0.1:<port>` | Root route and BFF route smoke in mock/unconfigured or live mode. |

`smoke:memory-detail` is non-live by design. It must not call Hermes, Brain
Memory Gateway, localStorage, or storage.

## Optional Live Checks

Run these only when Hermes and Brain Memory Gateway are intentionally live and
configured:

| Check | Purpose |
| --- | --- |
| `npm run smoke:ui:memory-live -- --base-url http://127.0.0.1:<port>` | UI-driven Hermes -> Brain Memory store, right-rail timeline, BFF search/inspect, and detail rendering. |
| `npm run smoke:ui:memory-scope -- --base-url http://127.0.0.1:<port>` | Multi-project/session scope isolation and project-only read semantics. |
| `node scripts/mvp-smoke.mjs --require-hermes --require-brain-memory --base-url http://127.0.0.1:<port>` | Route/BFF live Hermes and Brain Memory gate. |
| Live search/inspect through `/api/brain-memory/search` and `/api/brain-memory/memory/inspect` | Targeted manual verification for known memories when needed. |

Do not fake live success. If Hermes or Brain Memory Gateway is absent, document
mock/unconfigured state.

## Surfaces Covered

The gate covers:

- BFF Brain Memory status/search/inspect routes;
- Memory Console status/search/results/detail;
- evidence `not_implemented` rendering;
- supersession `not_implemented` rendering;
- audit metadata-only rendering;
- Memory timeline and live activity blocks;
- tenant/scope diagnostics;
- project/session scope behavior;
- project-only read behavior;
- non-live detail fixture;
- Brain Memory client normalization.

## Default Mock Mode

Allowed in default mock/unconfigured mode:

- Brain Memory status reports mock, unconfigured, disabled, or error state.
- Memory search falls back to local mock evidence/results.
- Memory detail labels Gateway detail as unavailable in mock mode.
- The Memory timeline can show no activity or only events available in current
  session state.
- Required source/build/audit checks still pass.

Default mock mode is valid for local Web UI development, but it is not evidence
that live Gateway search/inspect works.

## Live Gateway Requirements

Live Brain Memory claims require:

- a healthy selected Web UI server;
- Hermes reachable through the Web UI BFF when exercising the agent memory
  path;
- Brain Memory Gateway reachable through the Web UI BFF;
- tenant-bound read key configured without printing secrets;
- BFF search returning normalized `mode=real`;
- BFF inspect returning real detail or safe scoped errors;
- same-session scope success and different-session/project isolation;
- project-only read behavior documented as project-broad read, not a
  project-level write.

## Must Pass Before Claiming Read-Only Brain Memory MVP

Before a release note or checkpoint claims the Brain Memory read-only MVP is
ready:

1. Required default checks pass.
2. Any browser claim names the exact selected base URL used.
3. Any live claim names whether Hermes and Brain Memory Gateway were real and
   reachable through the BFF.
4. Mock/unconfigured state is explicitly described when live services are not
   running.
5. No secrets appear in logs, docs, screenshots, or committed files.
6. No mutation/admin controls are visible or claimed.
7. No direct browser-to-Gateway, browser-to-Hermes, or direct storage path is
   added or claimed.

## Deferred And Non-Goals

The following remain deferred and are not approved by this gate:

- memory mutation/admin UI;
- delete/supersede/pin/mark-stale controls;
- project-level writes;
- durable evidence storage;
- durable supersession storage;
- durable audit trail;
- full auth/classification;
- export/import;
- production one-command CLI;
- automatic context compaction;
- manual context compaction;
- compacted summary writes.

## Next Recommended Slice

Slice 15M: refresh the release/RC notes to point at this read-only QA gate and
separate default, browser, and live Brain Memory claims.
