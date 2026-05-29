# Brain Memory UI Endpoints Proposal

Status: Draft contract proposal
Date: 2026-05-29

This document proposes Gateway-controlled endpoints for the Brain Memory Studio UI. It is not a storage schema. The UI and BFF must never talk directly to Postgres, Redis, Qdrant, RAGLight, filesystem memory internals, or any other storage layer.

All endpoints require auth unless explicitly stated otherwise. Auth can be local desktop auth in development and a stronger user/session model before network exposure. All mutating endpoints must be audited by the Brain Memory Gateway.

## Common Types

```ts
type ISODateTime = string;

type Scope = {
  tenant_id: string;
  project_id?: string;
  session_id?: string;
  hermes_session_id?: string;
};

type Project = {
  id: string;
  tenant_id: string;
  name: string;
  description?: string;
  memory_scope_key: string;
  default_model?: string;
  created_at: ISODateTime;
  updated_at: ISODateTime;
};

type Session = {
  id: string;
  project_id: string;
  hermes_session_id?: string;
  title: string;
  summary?: string;
  model?: string;
  message_count?: number;
  last_active_at?: ISODateTime;
  created_at: ISODateTime;
  updated_at: ISODateTime;
  archived_at?: ISODateTime;
};

type MemorySummary = {
  id: string;
  tenant_id: string;
  project_id?: string;
  session_id?: string;
  layer: "canonical" | "semantic" | "hot" | "curated" | "raglight" | string;
  title?: string;
  content_preview: string;
  score?: number;
  trust_level?: "low" | "medium" | "high" | string;
  created_at: ISODateTime;
  updated_at?: ISODateTime;
  superseded_by?: string;
  evidence_count?: number;
};
```

## GET /health

Purpose: Report Gateway UI API health and dependency status.

Auth: Optional for local liveness; required for dependency details.

Mode: Read-only.

Request:

```http
GET /health?include_dependencies=false
```

Response:

```ts
type HealthResponse = {
  status: "ok" | "degraded" | "down";
  service: "brain-memory-gateway";
  version?: string;
  dependencies?: Array<{
    name: "postgres" | "redis" | "qdrant" | "raglight" | string;
    status: "ok" | "degraded" | "down" | "unknown";
    checked_at: ISODateTime;
  }>;
};
```

## GET /ui/projects

Purpose: List projects visible to the current user/workspace.

Auth: Required.

Mode: Read-only.

Request:

```http
GET /ui/projects?tenant_id=tenant_123&limit=50&cursor=
```

Response:

```ts
type ProjectsResponse = {
  object: "list";
  data: Project[];
  next_cursor?: string;
};
```

## POST /ui/projects

Purpose: Create a project and its Gateway-approved memory scope.

Auth: Required.

Mode: Mutating.

Request:

```ts
type CreateProjectRequest = {
  tenant_id: string;
  name: string;
  description?: string;
  default_model?: string;
  memory_scope_key?: string;
};
```

Response:

```ts
type CreateProjectResponse = {
  object: "brain_memory.project";
  project: Project;
};
```

Audit: Required.

## GET /ui/projects/{project_id}

Purpose: Read project metadata, memory scope, and optional context summary.

Auth: Required.

Mode: Read-only.

Request:

```http
GET /ui/projects/{project_id}?tenant_id=tenant_123&include_context=true
```

Response:

```ts
type ProjectResponse = {
  object: "brain_memory.project";
  project: Project;
  context?: {
    summary?: string;
    active_memory_count?: number;
    stale_memory_count?: number;
    pinned_memory_count?: number;
    updated_at?: ISODateTime;
  };
};
```

## GET /ui/projects/{project_id}/sessions

Purpose: List sessions for a project, including mapped Hermes session ids when known.

Auth: Required.

Mode: Read-only.

Request:

```http
GET /ui/projects/{project_id}/sessions?tenant_id=tenant_123&limit=50&cursor=&include_archived=false
```

Response:

```ts
type SessionsResponse = {
  object: "list";
  project_id: string;
  data: Session[];
  next_cursor?: string;
};
```

## POST /ui/projects/{project_id}/sessions

Purpose: Create a UI/Gateway session record and optionally reserve or attach a Hermes session id.

Auth: Required.

Mode: Mutating.

Request:

```ts
type CreateSessionRequest = {
  tenant_id: string;
  title?: string;
  hermes_session_id?: string;
  model?: string;
};
```

Response:

```ts
type CreateSessionResponse = {
  object: "brain_memory.session";
  session: Session;
};
```

Audit: Required.

## GET /ui/sessions/{session_id}/messages

Purpose: Return Gateway-approved message/event history or cached previews for the UI. The Gateway may proxy or reconcile with Hermes, but the UI does not read Hermes internals directly.

Auth: Required.

Mode: Read-only.

Request:

```http
GET /ui/sessions/{session_id}/messages?tenant_id=tenant_123&project_id=project_123&limit=100&cursor=
```

Response:

```ts
type SessionMessagesResponse = {
  object: "list";
  session_id: string;
  hermes_session_id?: string;
  data: Array<{
    id: string;
    session_id: string;
    role: "system" | "user" | "assistant" | "tool" | string;
    content: string | Array<unknown>;
    event_type?: string;
    created_at: ISODateTime;
    hermes_response_id?: string;
    run_id?: string;
    memory_refs?: string[];
  }>;
  next_cursor?: string;
};
```

## POST /ui/memory/search

Purpose: Search memory through Gateway policy, with tenant/project/session filters and retrieval evidence metadata.

Auth: Required.

Mode: Read-only in effect, though POST is used for complex search criteria.

Request:

```ts
type MemorySearchRequest = Scope & {
  query: string;
  layers?: string[];
  limit?: number;
  cursor?: string;
  include_evidence_summary?: boolean;
};
```

Response:

```ts
type MemorySearchResponse = {
  object: "list";
  data: MemorySummary[];
  next_cursor?: string;
};
```

## GET /ui/memory/{memory_id}

Purpose: Read one Gateway-approved memory item.

Auth: Required.

Mode: Read-only.

Request:

```http
GET /ui/memory/{memory_id}?tenant_id=tenant_123&project_id=project_123
```

Response:

```ts
type MemoryResponse = {
  object: "brain_memory.memory";
  memory: MemorySummary & {
    content: string;
    metadata?: Record<string, unknown>;
    source_session_id?: string;
    source_agent?: string;
    pinned?: boolean;
    stale?: boolean;
  };
};
```

## GET /ui/memory/{memory_id}/evidence

Purpose: Show why a memory exists or why it was retrieved, without exposing raw database rows.

Auth: Required.

Mode: Read-only.

Request:

```http
GET /ui/memory/{memory_id}/evidence?tenant_id=tenant_123&limit=50&cursor=
```

Response:

```ts
type MemoryEvidenceResponse = {
  object: "list";
  memory_id: string;
  data: Array<{
    id: string;
    type: "message" | "tool_result" | "document" | "retrieval_trace" | string;
    source_id?: string;
    source_label?: string;
    excerpt: string;
    score?: number;
    created_at: ISODateTime;
    metadata?: Record<string, unknown>;
  }>;
  next_cursor?: string;
};
```

## GET /ui/memory/{memory_id}/supersession-chain

Purpose: Show lineage from original memory through stale/superseded/current records.

Auth: Required.

Mode: Read-only.

Request:

```http
GET /ui/memory/{memory_id}/supersession-chain?tenant_id=tenant_123
```

Response:

```ts
type SupersessionChainResponse = {
  object: "brain_memory.supersession_chain";
  memory_id: string;
  data: Array<MemorySummary & {
    relation: "original" | "superseded" | "current" | string;
    superseded_at?: ISODateTime;
    superseded_reason?: string;
  }>;
};
```

## GET /ui/audit

Purpose: Inspect memory/project/session audit events through Gateway policy.

Auth: Required.

Mode: Read-only.

Request:

```http
GET /ui/audit?tenant_id=tenant_123&project_id=project_123&session_id=&memory_id=&action=&limit=100&cursor=
```

Response:

```ts
type AuditResponse = {
  object: "list";
  data: Array<{
    id: string;
    tenant_id: string;
    project_id?: string;
    session_id?: string;
    memory_id?: string;
    actor_id?: string;
    action: string;
    mode: "read" | "mutating";
    summary: string;
    created_at: ISODateTime;
    metadata?: Record<string, unknown>;
  }>;
  next_cursor?: string;
};
```

## Future Controlled Admin Actions

These are not for the first read-only memory console. They require Gateway policy checks, explicit confirmation in the UI, and audit records.

### POST /ui/memory/{memory_id}/mark-stale

Mode: Mutating.

Request:

```ts
type MarkStaleRequest = Scope & {
  reason: string;
};
```

Response:

```ts
type MarkStaleResponse = {
  object: "brain_memory.memory";
  memory: MemorySummary & { stale: true };
  audit_id: string;
};
```

### POST /ui/memory/{memory_id}/supersede

Mode: Mutating.

Request:

```ts
type SupersedeRequest = Scope & {
  replacement_content: string;
  reason: string;
};
```

Response:

```ts
type SupersedeResponse = {
  object: "brain_memory.supersession";
  previous_memory_id: string;
  new_memory: MemorySummary;
  audit_id: string;
};
```

### POST /ui/memory/{memory_id}/pin

Mode: Mutating.

Request:

```ts
type PinRequest = Scope & {
  reason?: string;
};
```

Response:

```ts
type PinResponse = {
  object: "brain_memory.memory";
  memory: MemorySummary & { pinned: true };
  audit_id: string;
};
```

### DELETE /ui/memory/{memory_id}

Mode: Mutating and destructive.

Request:

```ts
type DeleteMemoryRequest = Scope & {
  policy: "delete_by_policy";
  reason: string;
  confirmation: string;
};
```

Response:

```ts
type DeleteMemoryResponse = {
  object: "brain_memory.memory.deleted";
  memory_id: string;
  deleted: true;
  audit_id: string;
};
```

Deletion should be disabled unless the Gateway policy explicitly permits it.

