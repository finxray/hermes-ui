# @hermes-ui/brain-memory-client

Typed server-side client for Brain Memory Gateway UI/read-only endpoints.

Current supported calls:

- `GET /health`
- `POST /ui/memory/search`

This package is for Gateway-mediated observability only. It must not import or
call Postgres, Redis, Qdrant, RAGLight, filesystem memory internals, or any
storage adapter directly.
