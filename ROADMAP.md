# Stoix Roadmap

Stoix `0.1.x` is a local presentation and orchestration layer for Hermes Agent.
Hermes remains the agent runtime, model router, tool host, and source of truth for
sessions and capabilities.

## 0.1 Public Preview

- Project-scoped local workspace and Hermes conversations.
- Fast, buffered streaming with clear model and provider state.
- Searchable selection of models configured in Hermes.
- Plugins, skills, configuration, keys, logs, and runtime status surfaces.
- Continuation of Hermes sessions created in supported external channels.
- Portable loopback-only packages for Windows, macOS, and Linux.
- Local browser storage, private per-user configuration, and explicit updates.

## Near Term

- Validate installation and upgrade behavior on clean machines.
- Improve accessibility, keyboard navigation, and small-screen ergonomics.
- Harden compatibility across supported Hermes releases through capability
  discovery rather than version-specific assumptions.
- Expand integration and regression tests around sessions, model switching,
  streaming, attachments, and provider failures.
- Add signing and notarization when release identities are available.

## Later

- Evaluate optional capabilities as independently installed Hermes skills or
  plugins rather than expanding Stoix into an agent runtime.
- Add richer artifact and tool views when Hermes exposes stable contracts for
  them.
- Consider push-based channel/session freshness when Hermes provides a supported
  event path.

Features enter the core application only after their Hermes contract, security
boundary, fallback behavior, and package impact are documented and tested.
