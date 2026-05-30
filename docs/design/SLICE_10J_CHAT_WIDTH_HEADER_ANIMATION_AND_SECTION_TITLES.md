# Slice 10J: Production Chat Width, Header, Panel Animation, and Section Titles

## Summary

Slice 10J refined the production root UI at `http://127.0.0.1:3000/`. This was a visual/layout slice only. No Hermes, Brain Memory, BFF, storage, memory scope, or backend behavior was changed.

## Files Changed

- `apps/web/src/app/globals.css`
- `apps/web/src/components/ChatView.tsx`
- `docs/design/slice-10j-production-smoke.png`
- `docs/design/SLICE_10J_CHAT_WIDTH_HEADER_ANIMATION_AND_SECTION_TITLES.md`

## Chat Column Width

The shared production content width was reduced from:

```css
--content-width: clamp(940px, 50vw, 1520px);
```

to:

```css
--content-width: clamp(560px, 30vw, 912px);
```

This keeps the inner transcript, warning banner, title, and composer aligned while making the chat/content column roughly 60% of the previous width. The outer center workspace still fills its available area.

Measured in real Windows Chrome at a 1920px viewport:

- transcript column: `576px`
- warning banner: `576px`
- composer inner shell: `576px`
- no horizontal overflow

## User Message Alignment

User messages now align to the right side of the chat column with a constrained bubble width:

- user rows use `justify-items: end`
- user bubbles use `width: fit-content`
- user bubbles cap at `min(72%, 720px)`
- assistant messages remain left-aligned and full-column, Codex-style

## Header Simplification

The central chat header was simplified to a single truncating session title. The previous project/session subtitle line was removed from the production chat view, and the header band styling was replaced with a transparent title line aligned to the narrower content column.

## Panel Animation Fix

The panel collapse animation was previously easy to perceive as abrupt because collapsed panels combined grid-column changes with visibility hiding. Slice 10J keeps the 500ms grid transition and animates panel opacity, transform, and padding without toggling `visibility: hidden`, so the side rails can slide/fade while the grid column narrows.

Transition timing:

```css
500ms cubic-bezier(0.2, 0.8, 0.2, 1)
```

## Sidebar Section Titles

Sidebar section labels now use a dedicated section title token:

```css
--font-section-title: clamp(18px, calc(15px + 0.16vw), 24px);
```

Only sidebar section labels such as `Projects`, `Sessions`, and `Mock connections` were enlarged. Project/session row text was left on the normal UI scale.

## Real Chrome Smoke

Real Windows Chrome was opened against:

```text
http://127.0.0.1:3000/
```

Screenshot evidence:

```text
docs/design/slice-10j-production-smoke.png
```

Validated:

- production root shows the Hermes UI app, not Codex
- content and composer are aligned at the narrower width
- central header is one title line with no subtitle
- user message bubble is right-aligned
- assistant message remains left-aligned
- composer remains visible
- no horizontal overflow
- sidebar section titles are more readable
- side panel transitions are defined at 500ms and no longer use immediate visibility hiding

## Checks Run

```text
npm run check:workspace-state
npm run check:brain-memory-client
npm run studio:doctor
npm run typecheck
npm run build
npm audit --audit-level=moderate
```

All checks passed.

## Remaining Notes

This slice does not migrate or redesign any backend behavior. The next slice can continue production visual polish, likely around final panel/toggle interaction review, responsive breakpoint tuning, or a broader production UI QA pass.
