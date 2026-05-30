# Slice 11B Scoped Composer And Panel Polish

## Files changed

- `apps/web/src/components/chat/Composer.module.css`
- `apps/web/src/components/chat/MessageBubble.module.css`
- `apps/web/src/components/shell/AppShell.tsx`

## Composer polish

The composer shell now uses a lighter Codex-like charcoal surface:

- composer surface: `rgba(46, 48, 54, 0.98)` with a very subtle top highlight,
- no outline border,
- slightly softer shadow,
- smaller internal gap and padding,
- textarea minimum height reduced from `clamp(52px, calc(42px + 0.7vw), 76px)` to `clamp(44px, calc(36px + 0.58vw), 65px)`.

This makes the initial composer height about 15% lower while keeping the floating composer shape and aligned content column intact.

## Unknown icon root cause

The stray settings-looking mark above the send button was the native textarea resize grip. The textarea previously used `resize: vertical`, which exposed the browser resize affordance near the lower-right composer area.

The textarea now uses `resize: none`, so the native resize grip is removed. The composer still allows internal scrolling for longer drafts through the textarea max-height.

## Send and stop button behavior

The send/stop control remains the existing Codex-like circular action button:

- send state shows the upward arrow,
- generating state shows the square stop placeholder,
- stream cancellation is still not implemented in this slice.

No Hermes streaming behavior or cancellation behavior changed.

## User bubble contrast

User message bubbles now use a darker surface, `rgba(35, 37, 42, 0.95)`, while the composer is lighter. This restores the intended hierarchy: the composer reads as the active input surface, and past user messages sit further back.

## Panel toggle acceptance

Real Windows Chrome was opened with a temporary profile at `http://127.0.0.1:3000/`.

During smoke testing, the hidden checkbox fallback for rail labels was found to be able to drift out of sync with the React collapsed state. That meant CSS `:has()` could keep rails collapsed even when `data-left-collapsed` and `data-right-collapsed` said they were open.

The hidden fallback inputs are now controlled by React:

- `checked={leftCollapsed}`
- `checked={rightCollapsed}`

After the fix, the real Chrome grid changed from `272px 992px 336px` to `0px 1600px 0px` and back to `272px 992px 336px`, with no horizontal overflow. The final screenshot captured the actual Hermes UI, not the Codex UI.

Screenshot path used for validation:

- `artifacts/slice11b-real-chrome-final.png`

The `artifacts/` folder is ignored and was not committed.

## Checks run

- `npm run check:workspace-state` passed
- `npm run check:brain-memory-client` passed
- `npm run studio:doctor` passed
- `npm run check:ui-structure` passed
- `npm run typecheck` passed
- `npm run build` passed
- `npm audit --audit-level=moderate` passed with 0 vulnerabilities

## Deliberately not changed

- No backend, Hermes, Brain Memory, BFF, or storage behavior changed.
- No memory mutation or admin actions were added.
- No direct browser-to-Gateway, browser-to-Hermes, or browser-to-storage path was added.
- No full auth/classification system was implemented.
- No production redesign or broad layout migration was performed.

## Next recommended slice

Slice 11C: a focused visible-browser pass for remaining production UI fit-and-finish, especially sidebar row truncation, right rail density, and any remaining topbar/toggle keyboard ergonomics after the component architecture has settled.
