# Memory Detail Contract 15I

Date: 2026-05-31

Status: MVP read-only contract

## Scope

This document defines the current read-only Memory detail contract for
Gateway-backed Brain Memory results in Brain Memory Studio.

The architecture remains:

```text
Browser UI
  -> Next.js BFF
    -> Hermes API server
    -> Brain Memory Gateway UI API
```

The browser does not call Brain Memory Gateway, Hermes, or storage directly. No
memory mutation/admin controls are part of this contract.

## Implemented Read Path

The browser calls:

```text
POST /api/brain-memory/search
POST /api/brain-memory/memory/inspect
```

The BFF/client then calls Gateway-owned read endpoints:

```text
POST /ui/memory/search
GET /ui/memory/{memory_id}
GET /ui/memory/{memory_id}/evidence
GET /ui/memory/{memory_id}/supersession-chain
```

The direct Gateway OpenAPI currently lists these UI read endpoints. The current
`/ui/capabilities` endpoint requires authorization and the BFF status route may
therefore expose `capabilities=null`; UI behavior must not depend on capability
claims until the status contract is explicit.

## Search Result Contract

Search results are normalized as `NormalizedMemoryResult`.

The UI can trust these fields when present:

- `id`
- `content`
- `snippet`
- `layer`
- `score`
- `source`
- `projectKey`
- `sessionKey`
- `scopeStatus`
- `supersessionStatus`
- `evidenceCount`
- `createdAt`
- `updatedAt`
- `metadata`

Optionality:

- `content` and `id` are required for a result to be displayed.
- Scope fields are optional in the type but expected for live scoped Gateway
  results.
- `evidenceCount` can be `0` even when evidence storage is not implemented.
- `metadata` is opaque read-only diagnostic data and must stay collapsed by
  default in compact UI surfaces.

Live observed shape for Slice 15I:

- `layer=canonical`
- `source=brain-memory`
- `scopeStatus=matching-session`
- `supersessionStatus=active`
- `evidenceCount=0`
- `createdAt` and `updatedAt` populated
- `metadata` populated

## Memory Detail Contract

Memory detail is normalized as `NormalizedMemoryDetail`.

Implemented now:

- full `content`;
- optional `snippet`;
- `layer` and `source`;
- `projectKey` and `sessionKey`;
- `scopeStatus`;
- `supersessionStatus`;
- `evidenceCount`;
- `createdAt` and `updatedAt`;
- opaque `metadata`;
- normalized request/response `scope`.

The detail panel labels Gateway-backed details as `Read-only detail` and
`Scoped result`.

Scope behavior:

- same project + same session detail should return `mode=real` and
  `scopeStatus=matching-session`;
- wrong project/session detail should return a safe normalized error with no
  detail, evidence, or supersession payload;
- tenant remains part of the request scope and, when exposed by Gateway, should
  match the UI tenant.

Wrong-scope live behavior observed in Slice 15I:

```text
mode=error
error.kind=http_error
error.message=Memory is not available in the current project/session scope (HTTP 404).
detail=null
evidence=null
supersession=null
```

## Evidence Contract

Evidence is normalized as `NormalizedMemoryEvidence`:

```ts
type NormalizedMemoryEvidence = {
  memoryId: string;
  evidence: unknown[];
  status?: string;
};
```

Current live status:

- Gateway returns `status=not_implemented`;
- `evidence=[]`;
- the UI shows `Evidence: not implemented by Gateway yet.`;
- no evidence item viewer is claimed until Gateway returns durable evidence.

Future expected shape:

- evidence items should be read-only records owned by Gateway;
- each item should carry enough source/layer/timestamp metadata to explain why
  a memory exists;
- evidence item shape must be documented before the UI renders it as durable
  evidence;
- evidence must remain scoped by tenant/project/session and mediated by the
  BFF.

## Supersession Chain Contract

Supersession chain is normalized as `NormalizedMemorySupersessionChain`:

```ts
type NormalizedMemorySupersessionChain = {
  memoryId: string;
  chain: unknown[];
  status?: string;
};
```

Current live status:

- Gateway returns `status=not_implemented`;
- `chain=[]`;
- the UI shows `Supersession chain: not implemented by Gateway yet.`;
- no stale/supersede/admin action is exposed.

Future expected shape:

- chain items should describe predecessor/successor memory ids and statuses;
- Gateway should expose active/superseded relationships and timestamps;
- UI rendering must remain read-only unless a later explicit admin slice adds
  audited mutation controls;
- chain data must stay tenant/project/session scoped through Gateway.

## Audit Contract

Current read-only audit posture:

- there is no dedicated Gateway audit endpoint in the current UI read contract;
- OpenAPI does not expose a `/ui/memory/{memory_id}/audit` route;
- detail/search expose metadata, created timestamps, updated timestamps,
  source, layer, scope, supersession status, and evidence count;
- the UI labels this as `Audit: Metadata only` and provides an `Audit metadata`
  disclosure when metadata exists.

Unavailable now:

- durable audit trail entries;
- actor/caller history beyond metadata fields already returned by Gateway;
- mutation logs;
- supersession decision history;
- evidence provenance records beyond the future evidence endpoint.

Future audit endpoint requirements:

- Gateway-owned read endpoint;
- tenant/project/session authorization;
- actor/caller labels without secrets;
- operation type, timestamp, memory id, and reason/evidence links;
- redacted payload previews only;
- explicit regression checks before surfacing in UI.

## Safety Boundaries

This contract is read-only.

Forbidden in this slice:

- delete, supersede, pin, mark-stale, or mutation/admin controls;
- direct browser-to-Gateway calls;
- direct browser-to-Hermes calls;
- direct storage access;
- committed secrets or printed API keys;
- loosened tenant checks;
- project/session stable-key changes.

## Regression Coverage

Slice 15I adds or strengthens coverage for:

- normalized not_implemented evidence payloads;
- normalized not_implemented supersession-chain payloads;
- missing evidence/supersession arrays normalizing to empty arrays;
- wrong-scope detail returning safe normalized 404 behavior;
- Memory detail panel wording for read-only detail, scoped result,
  not_implemented evidence, not_implemented supersession, and metadata-only
  audit;
- absence of mutation/admin labels in the detail UI.

## Live Observation

Live services observed on 2026-05-31:

- Hermes: `http://127.0.0.1:8642`, healthy;
- Brain Memory Gateway: `http://127.0.0.1:8080`, healthy and ready;
- Web UI BFF on temporary `http://127.0.0.1:3002`, real/reachable for Hermes
  and Brain Memory.

Live marker inspected:

```text
BM_SCOPE_A1_20260531092617_JSUCDH
```

Observed normalized inspect summary:

- detail id `a15507cd-4273-42a3-bb6d-17d71a36833e`;
- tenant `local-dev`;
- project key `studio:local-dev:project:project-scope-a`;
- session key `studio:local-dev:project:project-scope-a:session:session-scope-a1`;
- `scopeStatus=matching-session`;
- `supersessionStatus=active`;
- `evidence.status=not_implemented`;
- `evidence.length=0`;
- `supersession.status=not_implemented`;
- `supersession.chain.length=0`.

## Next Slice

Slice 15J: add a read-only Memory detail fixture and non-live browser smoke for
detail/evidence/supersession/audit UI states, so not_implemented rendering can
be checked without live Hermes or Brain Memory services.

## Slice 15J Follow-Up

Slice 15J added `/design/memory-detail-fixture` and `npm run smoke:memory-detail`
for deterministic non-live coverage of this contract. The fixture renders the
existing `MemoryDetailPanel` with static full-detail, not implemented evidence,
not implemented supersession-chain, metadata-only audit, wrong-scope error, and
metadata redaction sentinel cases. The production BFF contract is unchanged.

## Slice 15K Follow-Up

The MVP read-only Brain Memory regression coverage map is indexed in
`docs/product/BRAIN_MEMORY_REGRESSION_INDEX_15K.md`.
