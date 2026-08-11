# ADR-0009: Local durable data and attachment vault

## Status

Accepted for Stoix `0.1.x` implementation.

## Context

Hermes is the canonical agent runtime and conversation store, but its session
API is not a general-purpose Stoix file store. Browser-owned `blob:` URLs expire
with the browser process, while IndexedDB is scoped to one browser profile and
cannot provide durable attachments across browsers on the same installation.

Stoix also needs a small, reusable persistence foundation for future local
application records that do not belong to Hermes. Brain Memory remains outside
the core application and is not part of this decision.

## Decision

1. The Stoix BFF owns a local durable-data store rooted in the operating
   system's per-user application-data directory. `STOIX_DATA_DIR` may override
   the root for packaging, tests, and managed installations.
2. Structured metadata and namespaced application records are stored in
   SQLite. Large binary payloads are stored as content-addressed files keyed by
   SHA-256; SQLite stores their manifests and references.
3. Browser code uploads files through trusted, same-origin BFF routes and keeps
   only stable object IDs and BFF URLs. Browser storage is a cache, not the
   canonical attachment store.
4. Stored files never expose host paths. Reads use opaque IDs, loopback BFF
   routes, MIME validation, `nosniff`, and restrictive content-disposition and
   content-security headers.
5. Chat attachment references are associated with stable Hermes session and
   message IDs. Pending client message IDs are reconciled after a Hermes turn
   is persisted.
6. Supported images are read by the BFF and sent to Hermes as native
   multimodal image input. Unsupported documents remain durable Stoix
   attachments and are described to Hermes as metadata only.
7. The internal store supports generic namespaced JSON records and object
   references, but browser-facing routes remain feature-specific. New durable
   features reuse the server abstraction instead of exposing a generic write
   endpoint.
8. Brain Memory is neither a storage backend nor a dependency of this layer.

## Data locations

- Windows: `%LOCALAPPDATA%\Stoix`
- macOS: `~/Library/Application Support/Stoix`
- Linux: `$XDG_DATA_HOME/stoix`, falling back to `~/.local/share/stoix`

The root contains `stoix.sqlite3` and an `objects/` content-addressed tree.

## Consequences

- Attachments survive browser restarts and are shared by browsers using the
  same Stoix installation.
- Identical payloads share one on-disk blob while retaining independent object
  manifests and message references.
- Browser IndexedDB remains useful for workspace presentation state, but no
  longer owns attachment bytes.
- Moving data between computers requires copying or exporting the Stoix data
  root; this ADR does not introduce cloud synchronization.
- Attachments created before durable bytes were retained cannot be recovered.
  The UI reports them as unavailable instead of pretending that a missing
  preview is still readable.
