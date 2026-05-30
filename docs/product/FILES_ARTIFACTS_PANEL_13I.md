# Files And Artifacts Panel 13I

Date: 2026-05-30

## Scope

Slice 13I adds the first Files/Artifacts panel foundation without changing
Hermes streaming, Brain Memory Gateway behavior, project/session stable keys,
or storage backends.

The implementation remains inside the existing architecture boundary:

```text
Browser UI -> Next.js BFF -> Hermes API server / Brain Memory Gateway UI API
```

No browser-to-Hermes, browser-to-Gateway, or direct storage path was added.

## Hermes Capability Findings

Current verified Hermes API server source/docs from
`C:\Users\Alexey\AppData\Local\Temp\hermes-agent-slice13a` show:

- inline image inputs are supported for `/v1/chat/completions` and
  `/v1/responses`;
- uploaded files, `input_file`, and `file_id` are rejected with
  `400 unsupported_content_type`;
- `/v1/capabilities` advertises sessions, runs, run events, approvals,
  stop, skills, toolsets, and `session_resources`;
- `/v1/capabilities` does not advertise upload, download, attachment,
  artifact listing, artifact detail, or artifact download endpoints.

Hermes UI therefore keeps `uiCapabilities.files` as:

- `uploadSupported: false`;
- `artifacts: "unknown"`;
- `uiState: "deferred"`.

## StudioArtifact Model

The frontend now has a typed `StudioArtifact` model with:

- `id`;
- `projectId`;
- `sessionId`;
- `title`;
- `kind`;
- `source`;
- `status`;
- `path`;
- `mimeType`;
- `sizeBytes`;
- `createdAt`;
- `updatedAt`;
- `summary`;
- `activityEventId`;
- `metadata`.

Legacy locally persisted artifact fields such as `name`, string `kind`, and
freeform `status` are normalized on workspace hydration.

## Activity Mapping

`AgentActivityEvent.artifact` now accepts richer artifact metadata. Hermes tool
and run payloads are inspected for artifact-shaped fields such as artifact id,
file id, path, name/title, kind, MIME type, size, action, and status.

This is mapping only. The UI does not invent live Hermes artifact support when
payloads do not contain artifact metadata.

## Files Tab Behavior

The right rail Files tab now:

- shows source state as `Local/mock only` unless Hermes advertises real artifact
  availability;
- shows the Hermes artifact capability state and upload support state;
- lists current project/session local mock artifacts;
- labels each artifact by source, kind, status, timestamp, and optional path;
- keeps preview/download disabled with `Download unavailable`.

## BFF Route Decision

No BFF artifact route was added.

Reason: the verified Hermes API server does not expose a safe artifact listing,
detail, preview, upload, or download endpoint. Adding a BFF route now would
either be unused plumbing or would tempt the UI into direct filesystem/storage
access, which is outside this slice and outside the project boundaries.

## Deferred Features

- real Hermes artifact list/detail/download route;
- safe Studio BFF artifact service;
- artifact previews;
- file upload;
- memory mutation/admin actions;
- direct storage access;
- auth/classification model;
- durable artifact persistence beyond current local workspace metadata.

## Recommended Next Slice

Slice 13J - Provider/Model Selector And Cerebras/Kimi Fast-Stream UX.
