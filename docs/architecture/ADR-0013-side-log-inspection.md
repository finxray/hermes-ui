# ADR-0013: Side-pane log inspection

## Status

Accepted for Stoix `0.1.x`.

## Context

Stoix exposes Hermes agent and gateway logs as a dedicated main-window section.
Users also need to keep a log stream visible while working in a chat, without
opening another browser window or replacing the existing full logs route.

## Decision

1. The existing logs route remains the complete, responsive log-inspection
   surface and the only log entry in the top navigation.
2. Logs can also occupy the established right split pane as presentation state
   owned by the Stoix shell. Opening or closing that pane does not change Hermes
   runtime state or create a second logging endpoint.
3. Both surfaces reuse `LogsView`, `useHermesLogs`, and the same Stoix BFF route.
   The side variant adds only pane-local file selection and compact layout.
4. Copy continues to operate on the currently visible, filtered records returned
   by the existing Hermes dashboard contract. Stoix does not request, store, or
   reveal additional log fields in side-pane mode.
5. Log records wrap within the available pane width. Wrapped text keeps normal
   line spacing, while separate records receive additional vertical separation.
6. Recognized leading timestamps receive the existing Stoix blue accent without
   changing the underlying text used by search, severity filters, or copy.
7. The existing mobile breakpoint does not render the right rail; the full logs
   route remains available on those viewports.

## Consequences

- Users can compare live logs with an active conversation while retaining the
  established resize and reveal animations.
- There is one fetch, filter, copy, and recovery implementation to maintain.
- Side-pane visibility is ephemeral UI state; no new durable workspace schema or
  Hermes integration contract is introduced.
- Narrow mobile screens continue to use the dedicated logs section rather than a
  compressed split layout.
