# Slice 10G-pre3 Runtime Identification

## Purpose

This slice identified which local route is serving the approved Codex-style prototype before any production migration. The important finding is that the approved prototype and the old green production app are served by the same current Next dev server on different routes.

## Ports Checked

Checked candidate Next/local app ports:

- `3000`
- `3001`
- `3002`
- `3003`
- `3004`
- `3005`
- `3006`
- `3007`

HTTP route checks:

- `http://127.0.0.1:3000/` returned `200`, title `Brain Memory Studio`, and serves the existing old green production app.
- `http://127.0.0.1:3000/design/codex-shell` returned `200`, title `Brain Memory Studio`, and serves the approved Codex-style prototype.
- Ports `3001` through `3007` were not accepting connections for `/` or `/design/codex-shell`.

## Active Server Processes

The only active local Next server found for these ports was on `127.0.0.1:3000`.

Observed process chain:

- `powershell.exe`: `Set-Location "C:\Users\Alexey\.cursor\projects\hermes-ui\apps\web"; npx next dev -H 127.0.0.1 -p 3000`
- `node.exe`: `npx next dev -H 127.0.0.1 -p 3000`
- `cmd.exe`: `next dev -H 127.0.0.1 -p 3000`
- `node.exe`: `next/dist/bin/next dev -H 127.0.0.1 -p 3000`
- `node.exe`: `next/dist/server/lib/start-server.js`

This indicates port `3000` is running a current Next dev server from this repo, not a different application instance.

## Approved Prototype URL

Approved Codex-style prototype:

```text
http://127.0.0.1:3000/design/codex-shell
```

Source files:

- `apps/web/src/app/design/codex-shell/page.tsx`
- `apps/web/src/app/design/codex-shell/page.module.css`

The route is present in the current committed source, and `npm run build` includes `/design/codex-shell` as a static app route. It is reproducible from the current repo source.

## Old Green App URL

Old green production app:

```text
http://127.0.0.1:3000/
```

Source file:

- `apps/web/src/app/page.tsx`

The root route still renders `AppShell`, so seeing the old green design at `/` is expected and does not identify the approved prototype.

## Stale Server and Cache Findings

No stale Next server needed to be stopped. The confusion was route-level, not process-level:

- `3000` is not a wrong repo process.
- `3000` is not only stale cached content.
- `/` is the old production app.
- `/design/codex-shell` is the approved prototype.

A previous Chrome app window was also found pointing at:

```text
http://127.0.0.1:3000/design/codex-shell
```

That matches the approved prototype route.

## Exact Run Command

Current dev server command observed:

```powershell
cd C:\Users\Alexey\.cursor\projects\hermes-ui\apps\web
npx next dev -H 127.0.0.1 -p 3000
```

Then open:

```text
http://127.0.0.1:3000/design/codex-shell
```

The root route is not the approved prototype.

## Border-Radius Continuity Fix

No new border-radius fix was needed in this slice. The current prototype CSS already contains the workspace top-left continuity treatment:

- `.workspace` uses a rounded left edge.
- `.workspace::before` inherits the radius and draws the shell border over the rounded edge.

## Readiness for Production Migration

The approved prototype is ready to be used as the source for a future production migration slice, but production migration was intentionally not performed here.

Migration source for the next slice:

```text
http://127.0.0.1:3000/design/codex-shell
```

Do not use:

```text
http://127.0.0.1:3000/
```

as the design source, because it still shows the old green production app.

## Checks Run

- `npm run typecheck` passed.
- `npm run build` passed.
- `npm audit --audit-level=moderate` passed with `0` vulnerabilities.

