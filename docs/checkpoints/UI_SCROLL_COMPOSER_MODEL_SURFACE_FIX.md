# UI scroll, composer, model, and surface fix

## Root causes

1. **Main surface transparency** — `ChatView.module.css` used `rgba(13, 15, 18, 0.74)` plus `backdrop-filter: blur(18px)`, so the shell gradient bled through the conversation panel and reduced readability.
2. **Background** — `AppShell` ambient layers used strong purple/blue washes and high animation opacity, diverging from the Codex reference (`#101114` solid workspace, darker canvas gradient).
3. **Transcript scroll height** — The transcript grid child lacked `height: 100%` / `align-self: stretch`, so the scroll region did not fill the `1fr` row; bottom padding did not account for composer height.
4. **Send scroll** — No `scrollIntoView` or composer-aware padding after new messages; the latest user turn could sit visually under the composer fade area.
5. **Long user bubbles** — No max-height or expand affordance; tall user messages could dominate the viewport.
6. **Composer width** — `--composer-width` equaled `--content-width` (100% of content column).
7. **Model label** — `modelLabelForState` returned `"Hermes default"` whenever `selectionStatus === "unknown"`, even when `currentModelLabel` was set (e.g. `hermes-agent`). Background refresh could also replace a known model with unavailable/unknown on transient BFF errors.
8. **Shimmer** — Completed/waiting activity blocks could inherit icon overlay rules ambiguously; thinking shimmer contrast was too low on some displays.

## Files changed

- `apps/web/src/components/chat/ChatView.tsx`
- `apps/web/src/components/chat/ChatView.module.css`
- `apps/web/src/components/chat/ChatTranscript.tsx`
- `apps/web/src/components/chat/MessageBubble.tsx`
- `apps/web/src/components/chat/MessageBubble.module.css`
- `apps/web/src/components/chat/CollapsibleUserMessage.tsx` (new)
- `apps/web/src/components/chat/Composer.tsx`
- `apps/web/src/components/chat/AgentActivityBlock.tsx`
- `apps/web/src/components/chat/AgentActivityBlock.module.css`
- `apps/web/src/components/shell/AppShell.module.css`
- `apps/web/src/styles/tokens.css`
- `apps/web/src/hooks/useHermesStatus.ts`
- `apps/web/src/hooks/useComposerInset.ts` (new)
- `scripts/check-ui-structure.mjs`
- `scripts/check-hermes-model-capabilities.mjs`
- `scripts/check-agent-activity-rendering.mjs`
- `ROADMAP.md`

## Main surface / background

- Conversation workspace uses solid `--bg-workspace-solid` (`#101114`); removed workspace `backdrop-filter`.
- Shell canvas gradients darkened; purple wash reduced; ambient motion softened with `prefers-reduced-motion` unchanged.

## Scroll / composer overlap

- `useComposerInset` measures composer wrapper height via `ResizeObserver`.
- Transcript uses `height: 100%`, `scroll-padding-bottom`, and dynamic `paddingBottom` on inner content.
- New messages trigger smooth `scrollIntoView` on a bottom anchor (respects reduced motion).

## Long user message collapse

- `CollapsibleUserMessage` caps collapsed height at 240px with fade and keyboard-friendly **Show more** / **Show less**.

## Composer width

- `--composer-width: clamp(467px, 40.9%, 628px)` (~73% of prior `clamp(640px, 56%, 860px)`), centered via existing `margin: 0 auto`.

## Model display

- `modelLabelForState` prefers real `currentModelLabel` when present.
- `preserveKnownModelOnTransientFailure` in `useHermesStatus` keeps last server-configured model during transient refresh errors.
- Composer tooltip states Web UI-safe model switching is not exposed; selector remains disabled.

## Shimmer

- Shimmer explicitly disabled on completed/failed/cancelled/waiting activity icons.
- Running/queued/thinking shimmers slightly strengthened; scoped to icon overlays only.

## Routes / fixtures checked

- `/` production shell (layout + scroll + composer)
- `/design/codex-shell` (reference)
- `/design/long-session-fixture`
- `/design/markdown-fixture`
- `/design/markdown-long-fixture`
- `/design/sidebar-large-fixture`
- `/design/artifacts-tools-large-fixture`
- `/design/memory-detail-fixture`

## Checks / smokes run

See commit verification section in the final handoff (release:check, fixture smokes, typecheck, build, audit).

## Remaining issues

- Transcript virtualization and runtime pagination still deferred.
- Model selector remains read-only until Hermes exposes a Web UI-safe switching API.
- Live `smoke:ui` depends on local Hermes/Playwright environment.

## Architecture confirmations

- Production chat remains `/api/hermes/chat/stream` via BFF.
- Production Runs remains disabled/deferred.
- No direct browser-to-Hermes or Brain Memory Gateway paths added.
- No agent access selector, approval buttons, memory mutation, export/import runtime, or fake model switching.
