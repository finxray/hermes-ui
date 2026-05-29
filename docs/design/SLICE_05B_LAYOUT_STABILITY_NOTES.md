# Slice 05B Layout Stability Notes

## Issue Fixed

The central chat composer could be pushed below the visible viewport because the app shell used minimum viewport heights and allowed page-level scrolling. Long content in the side panels or transcript could make the document taller than the browser viewport, which meant the composer was reachable only after scrolling the page.

## CSS/Layout Approach

- Constrained the desktop app shell to `100dvh` so the three-column workspace fits the visible browser viewport.
- Disabled document-level overflow at the desktop layout size.
- Set the shell columns to `min-height: 0` so nested grid/flex children can scroll correctly.
- Kept the chat transcript as the independent scroll container.
- Kept the composer in the final chat grid row with a sticky bottom guard so it remains visible while messages scroll above it.
- Let the left sidebar and right panel manage their own overflow.
- Relaxed document overflow below the tablet breakpoint so the stacked right panel remains reachable on narrower layouts.

## Deliberately Not Changed

- No Hermes streaming, BFF, or client behavior was changed.
- No Brain Memory integration or storage access was added.
- No project/session state logic was changed.
- No theme redesign, global spacing redesign, or new product features were added.

## Checks

- `npm run typecheck` passed.
- `npm run build` passed.
- `npm audit --audit-level=moderate` passed with 0 vulnerabilities.

## Real Chrome Smoke Result

Tested in the user's real Windows Chrome at `http://127.0.0.1:3000` with Hermes running locally.

- Hermes status displayed connected.
- Composer was visible without page scrolling before send.
- One live Hermes message was sent through the existing BFF stream.
- Assistant response completed with `LAYOUT_VISIBLE`.
- Composer remained visible after the response.
- Reload preserved the sent message in localStorage.
- No API secret text was visible.
- No horizontal overflow was detected.
- Document-level vertical overflow was not detected on desktop.
- Transcript, sidebar, and right panel scroll areas remained independent.

Screenshot: `C:\Users\Alexey\.cursor\projects\hermes-ui\.codex-log\slice05b-composer-visible-after-send.png`
