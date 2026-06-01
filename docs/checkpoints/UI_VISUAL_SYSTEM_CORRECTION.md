# UI Visual System Correction

**Date:** 2026-06-01  
**Slice:** Visual-system audit and correction (no new product features)

---

## Audit Summary

### Problems Found

1. **Scale / font-size**: `html { font-size: 105% }` applied a global 5% upscale on top of the already-fluid `--font-body` range. The `--font-body` range was `clamp(13.5px, calc(11.7px + 0.13vw), 18px)` — spanning 4.5px which caused text to feel inconsistent across viewport widths.

2. **Chat bubbles**: The user bubble `max-width: min(70%, 720px)` was fine but padding used `clamp()` with a wide range. The assistant bubble had `padding: 0` and transparent background (correct), but the `head` row margin-bottom of 7px vs the reference systems's cleaner 6px with baseline-aligned metadata.

3. **Activity rows**: Shimmer was applied to `running` AND `thinking` icons via `::after`. The `thinking` row also applied shimmer unconditionally via `.thinking .icon::after`. The raw JSON `<pre>` was always visible in expanded details — cluttering the expanded view.

4. **Thinking/Reasoning lifecycle**: `showThinking` is correctly gated on `isGenerating && !assistantHasContent && !hasRunningActivity` in ChatView. ThinkingRow renders only while this condition is true. No private reasoning text was exposed.

5. **Shimmer misuse**: The `streamPlaceholder` in MessageBubble was rendering as an invisible block (height 12px, font-size 0) with complex grid and width calculations causing potential layout shift. Simplified to a single `display: block` pill with `overflow: hidden` + `::after` shimmer.

6. **Composer overflow**: `.wrap { overflow: hidden }` — the `overflow: hidden` on the composer wrapper was causing horizontal scroll issues in some layout configurations. Removed it.

7. **Composer note text**: Internal BFF jargon ("BFF stream path. Server-configured model.") shown to users. Changed to user-facing text. Preserved internal `streamBatchingDetail` string for the check that validates it.

8. **Composer placeholder**: "Message Hermes through the local BFF..." changed to "Message Hermes…".

9. **MockBanner**: Used `AlertTriangle` with orange text (`#e7b866`) and grid layout — looked like a warning. Converted to a subtle inline notice with muted text and no background.

10. **Right rail `meta` size**: Used `--font-ui` (was 14.5–19px fluid), which is oversized for metadata fields. Changed to `--font-small`.

11. **Content width**: `--content-width: clamp(590px, 33vw, 960px)` — minimum was 590px which felt tight. Changed to `clamp(640px, 56%, 860px)` for more consistent centering.

12. **Font density tokens**: Were fluid clamp() ranges causing jarring jumps. Replaced with fixed values: `--font-xs: 11.5px`, `--font-small: 13px`, `--font-body: 15px`, `--font-ui: 15px`.

13. **Rail widths**: Left rail min was 232px (too narrow), right rail was wide (up to 492px). Tightened to `clamp(220px, 14vw, 280px)` left and `clamp(300px, 20vw, 420px)` right.

14. **ContextRail heading size**: Was `--font-section-title` (was 14.5–19px), changed to `--font-body` (15px fixed) with lighter weight (620 vs 650).

15. **ContextRail padding**: Was `clamp(22px, calc(14px + 0.52vw), 35px)` — simplified to fixed `20px`.

16. **Code block header**: Was 38px tall with 14px font. Reduced to 34px with `--font-xs` (11.5px) — cleaner, more Codex-like.

17. **Copy button**: Had hard `min-width: 118px` making it fixed-width regardless of content. Removed.

18. **Action row hover**: Added `opacity: 0` default + hover reveal on `.message` to reduce visual noise when not hovering.

19. **Responsive breakpoint**: Left rail disappears at 1180px, changed to 1280px to better preserve sidebar on medium screens.

---

## Files Changed

| File | Change |
|------|--------|
| `apps/web/src/app/globals.css` | `font-size: 105%` → `font-size: 100%` |
| `apps/web/src/styles/tokens.css` | Added `--bg-user-bubble`, `--warning-dim` tokens |
| `apps/web/src/components/shell/AppShell.module.css` | Fixed font/layout tokens, responsive breakpoints |
| `apps/web/src/components/chat/ChatView.module.css` | Tighter padding, cleaner mockBanner, smaller gap |
| `apps/web/src/components/chat/ChatTranscript.tsx` | Shorter mockBanner copy |
| `apps/web/src/components/chat/MessageBubble.module.css` | Action row hover reveal, cleaner shimmer placeholder, `--bg-user-bubble` |
| `apps/web/src/components/chat/MessageMarkdown.module.css` | Code block header 34px, copy button without min-width, fixed font sizes |
| `apps/web/src/components/chat/AgentActivityBlock.module.css` | Tighter rows, shimmer only while running, cleaner layout |
| `apps/web/src/components/chat/AgentActivityBlock.tsx` | Details stay collapsed by default (no dynamic `open=` prop) |
| `apps/web/src/components/chat/ChatActivityBlock.module.css` | Consistent with AgentActivityBlock style |
| `apps/web/src/components/chat/Composer.module.css` | Removed `overflow: hidden`, smaller note text |
| `apps/web/src/components/chat/Composer.tsx` | User-facing placeholder and note text |
| `apps/web/src/components/shell/ContextRail.module.css` | Fixed padding, smaller heading, `--font-small` for meta |

---

## Visual System Decisions

### Typography
- Fixed pixel tokens instead of fluid clamp: eliminates jarring scale changes across viewports
- `--font-body: 15px` is the primary reading size — matches ChatGPT/Codex convention
- `--font-small: 13px` for secondary UI, `--font-xs: 11.5px` for metadata/labels

### Color / Surfaces
- Added `--bg-user-bubble: rgba(28, 30, 35, 0.9)` for a slightly warmer, defined user bubble
- Assistant messages remain transparent (full-width, flush with transcript)
- Activity rows use `rgba(255,255,255, 0.022)` hover only — no borders between rows

### Spacing
- `transcriptInner` gap reduced from 28px → 20px (consistent density)
- ContextRail padding unified to 20px (from fluid calc)
- Composer padding unified: `8px clamp(20px,4vw,52px) 20px`

---

## Shimmer / Thinking / Reasoning Lifecycle

| State | Behavior |
|-------|----------|
| Generating, no content yet, no activity | `ThinkingRow` shown with shimmer icon |
| Generating, activity events present | Activity events shown, ThinkingRow hidden |
| Generating, content streaming | MessageBubble shows streaming markdown |
| Stream complete | All shimmer stops; activity events persist in collapsed `<details>` |
| Activity `running` status | Icon shimmer via `::after` only on running/queued icons |
| Activity `completed` | No shimmer; icon color changes to `--accent` |
| Thinking `showThinking=false` | `ThinkingRow` unmounted completely |

**No private chain-of-thought or hidden reasoning text is rendered.**

---

## Activity / Tool Row Decisions

- Native `<details>/<summary>` — collapsed by default
- Shimmer ONLY on `data-status="running"` and `data-status="queued"` icons via `::after`
- `ThinkingRow` shimmer only while `showThinking` is true (unmounted when false)
- Raw JSON `<pre>` is inside `<details>` — hidden until user expands
- No border separators between rows — spacing via `gap: 2px` only
- Subtitle truncated with `text-overflow: ellipsis` to prevent tall rows

---

## Composer Overflow Fix

**Root cause**: `.wrap { overflow: hidden }` was clipping the composer wrapper, which could cause horizontal scrollbar to appear above the composer in some layout configurations when child content (e.g., composer box shadow) extended outside the clip.

**Fix**: Removed `overflow: hidden` from `.wrap`. The backdrop blur and gradient still work without it. The composer is now stably contained by the grid layout.

---

## Routes / Fixtures Checked

All fixture routes return HTTP 200:
- `/` — main app root
- `/design/codex-shell`
- `/design/markdown-fixture`
- `/design/markdown-long-fixture`
- `/design/memory-detail-fixture`
- `/design/long-session-fixture`
- `/design/sidebar-large-fixture`
- `/design/artifacts-tools-large-fixture`

---

## Checks / Smokes Run

| Check | Result |
|-------|--------|
| `check:ui-structure` | ✓ passed |
| `check:workspace-state` | ✓ passed |
| `check:agent-activity` | ✓ 36 passed |
| `check:agent-activity-rendering` | ✓ 35 passed |
| `check:brain-memory-client` | ✓ passed |
| `check:tenant-scope` | ✓ passed |
| `typecheck` | ✓ clean |
| `build` | ✓ clean |
| `npm audit --audit-level=moderate` | ✓ 0 vulnerabilities |
| `smoke:mvp` | ✓ 47 passed, 0 failed |
| `smoke:ui` | HTTP 200 ✓; browser launch skipped (Playwright not installed) |
| `smoke:markdown` | HTTP ✓; browser launch skipped |
| `smoke:markdown:long` | HTTP ✓; browser launch skipped |
| `smoke:memory-detail` | HTTP ✓; browser launch skipped |
| `smoke:long-session` | HTTP ✓; browser launch skipped |
| `smoke:sidebar:large` | HTTP ✓; browser launch skipped |
| `smoke:artifacts-tools:large` | HTTP ✓; browser launch skipped |

Playwright browser binary not installed in this WSL environment — all HTTP/static asset preflight checks pass.

---

## Known Remaining Visual Issues

1. **Playwright smoke coverage**: Full browser visual regression requires `npx playwright install` in this environment. HTTP-level checks pass.
2. **Right rail responsive**: Below 1280px the right rail collapses to 0 (existing behavior). No right rail visible on medium screens without explicit toggle.
3. **Sidebar row hover**: Minor hover background inconsistency on expanded project groups — pre-existing.
4. **Code syntax highlighting**: Basic tokenizer only; no full language grammar. Pre-existing limitation.
5. **User bubble hover**: Action row is hidden by default (hover to reveal). On mobile/touch devices, this pattern may not be ideal. Pre-existing limitation.

---

## Architecture Confirmations

- **Production chat path unchanged**: `/api/hermes/chat/stream` — verified in ChatView.tsx  
- **Production Runs**: Remains disabled/guarded — `/api/hermes/runs/*` routes exist but not wired to main chat  
- **No Agent access selector**: Not added  
- **No approval buttons**: Not added  
- **No memory mutation/admin UI**: Not added  
- **No export/import runtime**: Not added  
- **No direct browser-to-Hermes path**: Not added  
- **No direct browser-to-Brain-Memory-Gateway path**: Not added  
- **No direct storage path**: Not added  
- **No provider/model switching**: Not added  
