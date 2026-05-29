# @hermes-ui/hermes-client

Typed server-side Hermes API client foundation for the Studio BFF.

Implemented so far:

- Slice 03: health, models, and capabilities normalization.
- Slice 04: session chat streaming via `/api/sessions/{session_id}/chat/stream`.

This package is intended for server-side BFF route handlers. Browser code should
call Studio routes such as `/api/hermes/status` and `/api/hermes/chat/stream`,
not Hermes directly.
