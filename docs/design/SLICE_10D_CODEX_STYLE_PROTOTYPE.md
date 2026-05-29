# Slice 10D Codex Style Prototype

## Starting state

The working tree was dirty before Slice 10D because of uncommitted visual iteration. Before reverting, the WIP diff was saved at `/tmp/hermes-ui-pre-10d-visual-wip.patch`. The five dirty files were restored and the tree was verified clean before starting from HEAD `a74e5ee`.

## Files changed

- `docs/design/CODEX_STYLE_ROOT_CAUSE_AUDIT.md`
- `docs/design/CODEX_STYLE_LAYOUT_CONTRACT.md`
- `docs/design/SLICE_10D_CODEX_STYLE_PROTOTYPE.md`
- `apps/web/src/app/design/codex-shell/page.tsx`
- `apps/web/src/app/design/codex-shell/page.module.css`

## Prototype route

`/design/codex-shell`

This route is static visual fixture content only. It does not call Hermes, Brain Memory Gateway, localStorage, storage backends, or production hooks.

## Prototype choices

- Transparent left rail with full-width row fills.
- Text-only top menu controls with transparent default state.
- Dominant rounded center workspace.
- Right rail using the same workspace background family with only a divider.
- User messages align right with a soft fill.
- Assistant messages are plain text with no bubble background.
- Tool rows include a compact loading/shimmer-style state.
- Composer includes attach, model, options, mic, and send controls.
- Memory/status examples remain visibly read-only mock content.

## Migration decision

Production migration is deferred. The audit found enough cascade and layout coupling in `globals.css` that another production patch would risk continuing the same regression loop. The next slice should migrate production components against the prototype contract rather than reusing the dirty WIP patch wholesale.

## Screenshot validity

Valid. The prototype route was served at `http://127.0.0.1:3000/design/codex-shell`, opened in Chrome, and captured to `docs/design/slice-10d-codex-shell-prototype.png`. The screenshot shows the Hermes UI prototype route, not Codex or another app.

## Checks run

- `npm run check:workspace-state` - passed.
- `npm run check:brain-memory-client` - passed.
- `npm run studio:doctor` - passed with expected warnings that Web UI BFF Hermes/Brain Memory status endpoints were unreachable before the dev server was started.
- `npm run typecheck` - passed.
- `npm run build` - passed.
- `npm audit --audit-level=moderate` - passed with 0 vulnerabilities.
- Prototype route HTTP smoke: `GET /design/codex-shell` returned 200 from the local dev server.

## Remaining work

1. Review the static prototype against the target Codex-style screenshots.
2. If accepted, map production `AppShell`, `Sidebar`, `ChatView`, `ContextPanel`, and shared controls onto the contract.
3. Reduce global CSS by replacing region-specific global overrides with local primitives or scoped classes.
4. Replace debug shell background in production after the visual contract is accepted.
