# Slice 02 Projects And Sessions Notes

Date: 2026-05-29

## State Model

Slice 02 keeps all state in the browser and prepares the UI for later replacement with BFF-backed persistence.

```ts
type WorkspaceState = {
  activeProjectId: string;
  activeSessionId: string | null;
  projects: Project[];
  sessions: Session[];
  modelChoices: ModelChoice[];
  connectionStatus: {
    hermes: string;
    brainMemory: string;
  };
};
```

Projects include:

- `id`
- `name`
- `description`
- `icon`
- `memoryScopeKey`
- `createdAt`
- `updatedAt`

Sessions include:

- `id`
- `projectId`
- `title`
- `summary`
- `createdAt`
- `updatedAt`
- `archivedAt`
- `messages`
- mock memory evidence
- mock tool events
- mock artifacts

## Persistence

Local mock persistence uses browser `localStorage` only.

- Key: `hermes-ui.workspace.v1`
- Version: `1`
- Loader: `apps/web/src/lib/workspaceStore.ts`
- Hook: `apps/web/src/hooks/useWorkspaceState.ts`

If stored data is missing, invalid, or the version does not match, the app falls back to seeded mock data.

## User Actions Implemented

- Switch active project.
- Switch active session.
- Create new local mock project.
- Create new local mock chat under the active project.
- Rename project with inline edit.
- Rename session with inline edit.
- Archive session with lightweight confirmation.
- Restore active project/session after reload.
- Reset mock workspace data from the sidebar status area.
- Empty project state when a project has no sessions.
- Empty chat state when a session has no messages.

New projects intentionally start without a session. This makes the project home state visible and lets users choose when to create the first chat.

## What Remains Mocked

- Hermes connection and health.
- Brain Memory Gateway connection and health.
- Chat sending.
- Transcript generation.
- Memory retrieval.
- Tool activity.
- Files/artifacts.
- Provider/model switching.
- Session archive is local only and has no server effect.

No real Hermes, Brain Memory Gateway, provider, BFF route, API key, database, vector store, RAGLight, or storage-layer calls were added.

## What Remains For Slice 03

- Add server-side BFF route/client shape.
- Add environment config for Hermes endpoint and API key.
- Query Hermes `/health`, `/health/detailed`, `/v1/models`, and `/v1/capabilities`.
- Replace mock connection badges with real health state while keeping browser secrets out of client JavaScript.
- Keep chat sending and streaming out of Slice 03 unless the Slice 03 prompt changes.

## Checks Run

```powershell
npm run typecheck
npm run build
npm audit --audit-level=moderate
```

Browser smoke checked:

- project switching updates session list and right context;
- session switching updates transcript;
- new project shows an empty state;
- new chat creates an empty active session;
- project rename works;
- session rename works;
- reload restores active project/session;
- reset mock data works;
- desktop has no horizontal overflow.

## Run Command

```powershell
npm install
npm run dev
```

Open:

```text
http://localhost:3000
```
