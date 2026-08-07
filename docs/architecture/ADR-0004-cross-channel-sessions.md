# ADR-0004: Cross-channel Hermes sessions

## Status

Accepted for development validation on Stoix `0.1.x`.

## Context

Hermes can receive conversations from messaging adapters such as Telegram,
Discord, WhatsApp, Slack, Signal, Matrix, and dynamically installed platform
plugins. Stoix users need to continue those conversations on a desktop without
creating a disconnected copy or exposing channel credentials to the browser.

## Decision

1. Hermes remains the canonical session and message store.
2. Stoix reads session summaries and messages through its BFF. Browser code never
   calls Hermes or a messaging platform directly.
3. A Stoix chat imported from Hermes stores the exact Hermes session ID plus a
   small, non-secret channel descriptor. It does not store platform credentials,
   platform user IDs, or channel tokens.
4. Sending from Stoix continues the same Hermes session. New channel messages are
   reconciled from Hermes on polling, window focus, and visibility changes.
5. External sessions appear in a compact folder per channel in the existing
   sidebar. The platform glyph replaces the folder icon; chat rows keep the same
   compact treatment, timestamp, hover overview, and rename/pin/archive menu as
   local project conversations. Selecting one associates it with the active
   Stoix project without duplicating its sidebar row. Archiving hides only the
   Stoix reference; it does not delete the canonical Hermes conversation.
6. Hermes source values are open-ended. Known sources receive a current brand or
   platform glyph; unknown plugin sources receive a neutral message glyph and a
   readable label.
7. Deleting an external channel session is not offered from Stoix history because
   that would delete the canonical cross-channel conversation.
8. After a successful Stoix turn in an externally owned session, the BFF asks
   the installed Hermes CLI to deliver the completed assistant response to that
   channel. Hermes retains ownership of credentials and destination resolution;
   text is passed over stdin and no channel secret or destination ID reaches the
   browser. Local/API sessions are never relayed.
9. This slice is validated on the development server at `127.0.0.1:3000` before
   it is included in release packaging.

## Consequences

- Telegram and other supported Hermes conversations can be opened and continued
  in Stoix without changing the workspace, composer, chart, or panel designs.
- Hermes timestamps are normalized from ISO strings, Unix seconds, or Unix
  milliseconds so newly active external sessions sort reliably.
- Cross-channel freshness is near-real-time rather than push-based until Hermes
  exposes a session event stream suitable for the BFF.
- Hermes `0.20.0` does not expose adapter delivery through its HTTP API. Stoix
  therefore uses the supported `hermes send` command as a server-only transport
  bridge after the canonical session stream completes.
- Current `hermes send` mirrors successful outbound text into the destination
  session. Stoix suppresses an immediately repeated assistant message with the
  same normalized content when importing channel history, so this transport
  audit copy does not render as a duplicate conversation row.
- Delivery uses the channel's configured Hermes home target. Exact multi-room
  routing still requires Hermes to expose destination provenance in its safe
  session API; Stoix fails closed rather than accepting browser-supplied IDs.
