# Slice 10H Remove Green and Migrate Shell

## Purpose

This slice made the approved Codex-style shell the production root UI at:

```text
http://127.0.0.1:3000/
```

The static reference route remains available at:

```text
http://127.0.0.1:3000/design/codex-shell
```

## Old Green Source Identified

The root route used the real production app:

- `apps/web/src/app/page.tsx` renders `AppShell`.
- `apps/web/src/components/AppShell.tsx` composes the real production sidebar, chat, and context panel.
- `apps/web/src/app/globals.css` contained the old green root styling.

The specific green source was:

- `body { background: #003f22; }`
- `.app-shell { background: #003f22; }`

The approved prototype lived separately in:

- `apps/web/src/app/design/codex-shell/page.tsx`
- `apps/web/src/app/design/codex-shell/page.module.css`

## Migration Approach

The migration kept the real production component tree and live hooks. It did not redirect root to the static prototype.

Preserved production components:

- `AppShell`
- `Sidebar`
- `ChatView`
- `Composer`
- `ContextPanel`
- `BrainMemoryConsole`
- `HermesStatusPanel`
- Brain Memory status/search/detail hooks
- Hermes status/chat streaming hooks
- workspace localStorage state

The approved visual contract was applied through production CSS in `apps/web/src/app/globals.css`.

## Files Changed

- `apps/web/src/app/globals.css`
- `apps/web/src/app/layout.tsx`
- `docs/design/SLICE_10H_REMOVE_GREEN_AND_MIGRATE_SHELL.md`
- `docs/design/slice-10h-root-codex-shell.png`

## Root Route Behavior

`http://127.0.0.1:3000/` now uses the approved Codex-style dark shell:

- dark integrated app background
- transparent/integrated left rail
- dominant rounded center workspace
- right rail with subtle divider
- scaled typography and icons
- wider left/right rails
- wider aligned transcript/composer content
- floating composer preserved

The old green background is no longer present in normal root usage.

## Prototype Route Behavior

`http://127.0.0.1:3000/design/codex-shell` still returns `200` and remains available as a static visual reference route.

The production root and prototype route now share the same visual direction, while root keeps real functionality.

## Functionality Preserved

The migration did not change the TypeScript or route logic for:

- project/session switching
- localStorage restore
- new project/new chat
- rename/archive behavior
- first-message title cleanup
- Hermes status BFF
- Hermes chat streaming BFF
- Brain Memory status/search/detail BFF
- memory detail drawer
- memory scope bridge
- project/session stable keys

Runtime BFF checks after migration:

- `/api/hermes/status` returned real, configured, reachable status for `http://127.0.0.1:8642`.
- `/api/brain-memory/status` returned mock/disabled because real Brain Memory Gateway is disabled for this UI process.

## Panel Animation Behavior

Existing left/right panel toggles are preserved.

The production shell still animates grid column changes with:

```css
transition: grid-template-columns 0.5s cubic-bezier(0.16, 1, 0.3, 1);
```

Sidebar and context panel opacity/transform transitions remain in place. `prefers-reduced-motion: reduce` now also disables shell/panel transitions.

## Real Chrome Validation

Opened the root route in a clean real Windows Chrome app window:

```text
http://127.0.0.1:3000/
```

Opened the reference route as well:

```text
http://127.0.0.1:3000/design/codex-shell
```

Screenshot evidence:

- `docs/design/slice-10h-root-codex-shell.png`

The screenshot shows the actual root app window with the Codex-style dark shell and no old green design.

## Checks Run

- `npm run check:workspace-state` passed.
- `npm run check:brain-memory-client` passed.
- `npm run studio:doctor` passed local repo checks; Hermes direct health was connected, BFF checks required the dev server before it was started.
- `npm run typecheck` passed.
- `npm run build` passed.
- `npm audit --audit-level=moderate` passed with `0` vulnerabilities.

## Remaining Cleanup / Follow-Up

- Consider consolidating shared visual tokens between the production shell CSS and the static prototype route to reduce duplicate maintenance.
- Run a future interactive smoke with live Brain Memory Gateway enabled when desired; this slice preserved the BFF path but did not enable Brain Memory Gateway.
- Next recommended slice: production visual QA and interaction polish on the migrated root shell.

