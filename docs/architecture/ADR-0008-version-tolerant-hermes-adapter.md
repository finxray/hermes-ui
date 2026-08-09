# ADR-0008: Version-tolerant Hermes adapter

## Status

Accepted

## Context

Stoix must continue to work across backward-compatible Hermes releases. UI
components cannot safely depend on Hermes response shapes, event names, provider
aliases, or release-version strings directly. A Hermes update may add fields,
events, endpoints, or capability metadata without changing the behavior Stoix
uses.

Hermes 0.20 also demonstrated why duplicated routing authority is unsafe: a
session model lock could be confirmed successfully while repeated turn-level
model fields were interpreted as a different raw route.

## Decision

1. The Stoix browser talks only to the Stoix BFF. Only the typed
   `packages/hermes-client` adapter interprets Hermes contracts.
2. Compatibility is negotiated from advertised capabilities and verified
   behavior, not from a hard-coded Hermes version allowlist.
3. Unknown response fields and unknown stream events remain forward-compatible;
   they are ignored unless they affect a required Stoix behavior.
4. Model routing has one authority. Stoix selects and verifies the session model
   before streaming; the stream request carries requested-route diagnostics in
   metadata but does not repeat routing fields.
5. Compatibility shims must be narrow, behavior-preserving, and covered by a
   positive and negative contract matrix. They must never hide an error before
   valid assistant output or hide a model/provider change.
6. Every release runs the offline Hermes adapter contract check. A change that
   weakens these invariants blocks packaging.
7. A genuinely incompatible Hermes response must fail clearly at the BFF
   boundary. Stoix must not silently fall back to another provider or pretend a
   request succeeded.
8. Provider-reported stream usage remains authoritative. When a verified local
   provider omits usage from the stream, the adapter may recover that turn's
   counts by subtracting Hermes' pre-run cumulative session counters from its
   post-run counters. It must not replace an existing provider usage event, use
   a cumulative session total as a single-turn count, or label a browser text
   estimate as authoritative usage.

## Consequences

- Backward-compatible Hermes additions do not require Stoix changes.
- Hermes-specific quirks stay out of UI components.
- New Hermes behavior is added as a tested adapter case, without branching the
  UI by server version.
- Local providers that persist usage but omit SSE usage still produce accurate
  per-turn input/output counts without moving Hermes state into Stoix.
- If Hermes removes or changes a required API incompatibly, users receive an
  explicit integration error rather than a misrouted or corrupted conversation.
