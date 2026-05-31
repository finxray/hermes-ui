# Memory Detail Fixture Smoke 15J

Date: 2026-05-31

Status: Non-live fixture coverage

## Scope

Slice 15J adds deterministic, non-live browser coverage for the read-only Memory
detail contract defined in Slice 15I.

The fixture route does not call Hermes, Brain Memory Gateway, localStorage, or
storage. It renders the existing `MemoryDetailPanel` with static typed fixture
data so the detail/evidence/supersession/audit UI can be checked without live
services.

Architecture remains:

```text
Browser UI
  -> Next.js BFF
    -> Hermes API server
    -> Brain Memory Gateway UI API
```

No BFF behavior changed in this slice.

## Files Changed

- `apps/web/src/components/memory/MemoryDetailPanel.tsx`
- `apps/web/src/data/memoryDetailFixture.ts`
- `apps/web/src/app/design/memory-detail-fixture/page.tsx`
- `apps/web/src/app/design/memory-detail-fixture/page.module.css`
- `scripts/memory-detail-fixture-smoke.mjs`
- `scripts/check-ui-structure.mjs`
- `scripts/mvp-smoke.mjs`
- `package.json`
- `docs/product/MEMORY_DETAIL_CONTRACT_15I.md`
- `docs/product/MEMORY_DETAIL_FIXTURE_SMOKE_15J.md`
- `docs/product/BRAIN_MEMORY_EVENT_TIMELINE_13K.md`
- `ROADMAP.md`

## Fixture Cases

`apps/web/src/data/memoryDetailFixture.ts` defines:

- `fullScopedMemoryDetailFixture`
  - full content and snippet;
  - layer/source;
  - project and session keys;
  - `scopeStatus=matching-session`;
  - `supersessionStatus=active`;
  - `evidenceCount=0`;
  - deterministic created/updated timestamps;
  - metadata-only audit fields;
  - secret-like metadata sentinels for redaction verification.
- `evidence`
  - `status=not_implemented`;
  - `evidence=[]`.
- `supersession`
  - `status=not_implemented`;
  - `chain=[]`.
- `wrongScopeMemoryDetailFixture`
  - safe normalized scoped 404-style error;
  - no detail/evidence/supersession payload.

## Design Route

Route:

```text
/design/memory-detail-fixture
```

The route renders:

- a Gateway-backed read-only detail fixture;
- not implemented evidence state;
- not implemented supersession-chain state;
- metadata-only audit disclosure;
- wrong-scope error fixture.

It is not linked from production navigation.

## Browser Smoke

Command:

```powershell
npm run smoke:memory-detail -- --base-url http://127.0.0.1:3002
```

The smoke verifies:

- route loads;
- `Read-only detail` is visible;
- `Scoped result` is visible;
- evidence not implemented copy is visible;
- supersession-chain not implemented copy is visible;
- audit metadata-only copy is visible;
- wrong-scope error copy is visible;
- no delete/supersede/pin/mark-stale/edit controls are visible;
- raw secret-like fixture sentinels are not visible;
- redacted metadata is visible after opening the audit disclosure;
- no API, Gateway, Hermes, or storage route calls are made by the fixture;
- no horizontal overflow;
- no browser console/page/network errors.

The smoke defaults to `http://127.0.0.1:3000` and supports `--base-url`.

## UI Safety Fix

`MemoryDetailPanel` now redacts secret-like metadata keys and bearer/token-like
strings before rendering audit metadata JSON. This is a narrow display safety
fix for the existing read-only metadata disclosure.

The detail panel still exposes no mutation/admin controls.

## Source-Level Checks

`npm run check:ui-structure` now verifies:

- fixture data file exists;
- fixture route exists;
- fixture route CSS exists;
- fixture data includes full scoped, wrong-scope, not implemented, and redaction
  sentinel cases;
- `MemoryDetailPanel` includes honest read-only/detail labels;
- `MemoryDetailPanel` does not include forbidden mutation/admin labels;
- `package.json` registers `smoke:memory-detail`.

`node scripts/mvp-smoke.mjs` source checks also include the fixture route and
script registration.

## Live Vs Non-Live

Live Memory detail behavior remains covered by `npm run smoke:ui:memory-live`.

The new `smoke:memory-detail` fixture is intentionally non-live:

- no live Hermes requirement;
- no live Brain Memory Gateway requirement;
- no memory writes;
- no BFF read calls;
- no localStorage mutation.

## Limitations

- The fixture does not prove live Gateway payload compatibility; Slice 15I live
  smoke covers that path.
- Evidence and supersession remain rendered as `not_implemented` until Gateway
  returns durable records.
- Audit remains metadata-only; no durable audit endpoint exists in the current
  UI read contract.

## Next Recommended Slice

Slice 15K: add an MVP read-only memory search/detail regression index that maps
each Brain Memory UI surface to its source check, browser smoke, live smoke,
and deferred production capability.

## Slice 15K Follow-Up

The regression index now lives at
`docs/product/BRAIN_MEMORY_REGRESSION_INDEX_15K.md` and maps the fixture to
source, browser, live, and deferred-capability coverage.
