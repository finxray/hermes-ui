# UI Production Visual Architecture Pass

Date: 2026-06-01
Slice: Production-grade visual architecture correction

## Root Issues Found

- The main canvas used mostly flat local backgrounds, so depth depended on individual components instead of a coherent shell system.
- Empty chats reused the generic transcript empty card, leaving the new-chat flow stuck in the normal chat layout instead of a centered start state.
- The composer had no session-aware lower context panel, so path, route, scope, and model context were either absent or scattered elsewhere.
- Warning copy was visually treated like generic app chrome instead of a calm inline warning signal.
- Right-rail tabs relied on default button line box behavior, which made text appear slightly off-center.
- Activity rows were structurally sound but still read as loose rows instead of one integrated inline orchestration timeline.
- Shimmer was already gated to active states, but the surrounding surfaces needed clearer boundaries so shimmer did not feel like whole-card motion.

## Files Changed

- `apps/web/src/styles/tokens.css`
- `apps/web/src/components/shell/AppShell.module.css`
- `apps/web/src/components/shell/ContextRail.module.css`
- `apps/web/src/components/shell/StatusPanel.module.css`
- `apps/web/src/components/chat/ChatView.tsx`
- `apps/web/src/components/chat/ChatView.module.css`
- `apps/web/src/components/chat/ChatTranscript.tsx`
- `apps/web/src/components/chat/Composer.tsx`
- `apps/web/src/components/chat/Composer.module.css`
- `apps/web/src/components/chat/MessageBubble.module.css`
- `apps/web/src/components/chat/MessageMarkdown.module.css`
- `apps/web/src/components/chat/AgentActivityBlock.module.css`
- `apps/web/src/components/chat/ChatActivityBlock.module.css`
- `apps/web/src/components/ui/EmptyState.module.css`
- `scripts/check-ui-structure.mjs`
- `docs/checkpoints/UI_PRODUCTION_VISUAL_ARCHITECTURE_PASS.md`
- `ROADMAP.md`

## Visual Changes

- Added shared glass tokens for translucent surfaces, glass borders, highlights, and shadows.
- Reworked the app shell background into a subtle dark multi-radial gradient with a very slow, low-cost ambient shift.
- Preserved `prefers-reduced-motion` by disabling background and context-panel motion when requested.
- Made the chat workspace translucent over the shell background so the main canvas has depth without decorative clutter.
- Refined user bubbles, code blocks, empty states, composer, and floating controls onto the same glass surface language.

## Composer And New Chat

- Empty sessions now render a centered start stage with the prompt "What should Hermes work on?" above the composer.
- The start-state composer floats in the main view instead of staying pinned to the bottom.
- Established chats continue to use the stable transcript plus bottom composer layout.
- The composer now accepts a lower context panel containing workspace, project, session, scope, route, and model state.
- The lower context panel is visible only for the empty/new-chat start state.
- After the first message is sent, the panel remains mounted but collapses through CSS to zero height and opacity, avoiding an abrupt layout jump.

## Warning Treatment

- Replaced the prior notice treatment with a minimal inline warning line.
- Warning text and icon use the warning token, with no filled box or thick outline.
- Blocking/error detail in the right rail was also reduced to inline text rather than a heavy filled card.

## Right Rail And Activity

- Right-rail tab buttons now use explicit inline-flex centering, fixed line-height, and normalized horizontal padding.
- Activity rows have tighter padding, softer glass icon disks, calmer hover states, and cleaner expanded detail indentation.
- Running/queued shimmer remains scoped to small icon overlays and thinking placeholders only.
- Completed, failed, cancelled, and waiting states do not shimmer.
- Public reasoning signals remain safe; private reasoning text is not rendered.

## Routes Checked

- `/`
- `/design/codex-shell`
- `/design/markdown-fixture`
- `/design/markdown-long-fixture`
- `/design/memory-detail-fixture`
- `/design/long-session-fixture`
- `/design/sidebar-large-fixture`
- `/design/artifacts-tools-large-fixture`

## Checks And Smokes Passed

- `npm run smoke:mvp -- --base-url http://127.0.0.1:3002`
- `npm run smoke:ui -- --base-url http://127.0.0.1:3002`
- `npm run smoke:markdown -- --base-url http://127.0.0.1:3002`
- `npm run smoke:markdown:long -- --base-url http://127.0.0.1:3002`
- `npm run smoke:memory-detail -- --base-url http://127.0.0.1:3002`
- `npm run smoke:long-session -- --base-url http://127.0.0.1:3002 --json`
- `npm run smoke:sidebar:large -- --base-url http://127.0.0.1:3002 --json`
- `npm run smoke:artifacts-tools:large -- --base-url http://127.0.0.1:3002 --json`
- `npm run check:ui-structure`
- `npm run check:workspace-state`
- `npm run check:agent-activity`
- `npm run check:agent-activity-rendering`
- `npm run check:brain-memory-client`
- `npm run check:tenant-scope`
- `npm run check:hermes-model-capabilities`
- `npm run typecheck`
- `npm run build`
- `npm audit --audit-level=moderate`

## Boundaries Preserved

- Production chat still uses `/api/hermes/chat/stream`.
- Production Runs remains disabled/deferred.
- No production Runs composer path was added.
- No Agent access selector, approval buttons, memory mutation/admin UI, export/import runtime, or fake model switching was added.
- No direct browser-to-Hermes or browser-to-Brain-Memory-Gateway path was added.
- No direct storage access was added.

## Known Remaining Issues

- The composer context panel uses workspace labels available to browser state; a full OS path should come from a future safe BFF endpoint if needed.
- Empty/new-chat state is implemented for active empty sessions. A no-session project state still uses the existing compact empty prompt and create-chat action.
- Runs, approvals, memory mutation, export/download, and runtime model switching remain intentionally deferred until verified server-side contracts exist.
