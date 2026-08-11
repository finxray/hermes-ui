# ADR-0010: Model-generated first-message chat titles

## Status

Accepted - 2026-08-11

## Context

Stoix previously derived a chat title locally from the first user message. The
heuristic frequently produced incomplete phrases and was not capable of
understanding the actual topic or intent.

Sending a second prompt through the visible Hermes session would improve title
quality but would also add hidden conversation state that could influence later
answers. Browser code must continue to use the Stoix BFF and must not receive
Hermes credentials.

## Decision

On the first user message of a default-titled chat, Stoix persists a one-time
title-generation reservation and starts a BFF request in parallel with the
visible response stream.

The BFF uses the typed Hermes adapter to create a per-chat session whose id ends
in `::utility`. It applies the same selected model and provider through Hermes's
verified session model endpoint, then sends a constrained title-only prompt to
that utility session. Utility sessions remain excluded from the Stoix session
list and are deleted after completion on a best-effort basis. The prompt and
response never enter the visible chat session or transcript.

Successful titles are applied only while the chat still has its default title.
A manual rename always wins. Failed or invalid title attempts are not retried on
later messages because the reservation timestamp is persisted before the request.

## Consequences

- Titles use the selected model's understanding instead of local word picking.
- Visible answer latency is not intentionally sequenced behind title creation.
- Title generation uses a small additional model request on the first message.
- A failed first attempt leaves the default title and does not affect later turns.
- Existing heuristic-generated titles are retained for backward compatibility.
