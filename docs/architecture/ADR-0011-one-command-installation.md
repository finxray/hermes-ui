# ADR-0011: One-Command Cross-Platform Installation

## Status

Accepted for the Stoix 0.1 release line.

## Context

The portable Stoix bundles include the production application and a pinned
Node.js runtime, but requiring a user to identify an architecture, download an
archive, verify it, extract it, find a launcher, and configure Hermes is too
fragile for first-time installation. It also makes upgrades prone to partial
replacement and leaves failures without a useful recovery path.

Stoix must remain the presentation/orchestration layer. Hermes remains an
independently installed runtime with its own configuration, updater, and data.

## Decision

Stoix provides two small bootstrap entry points:

- `install.sh` for macOS and Linux;
- `install.ps1` for Windows PowerShell.

The installers follow this contract:

1. Detect the operating system and architecture and reject unsupported targets
   before changing the machine.
2. Prefer the latest published, platform-native GitHub Release asset. Download
   its adjacent SHA-256 file and verify the archive before extraction.
3. Until a published release exists, build the current public source archive
   with a temporary, checksum-verified Node.js 24.15.0 runtime. No global Node
   installation is required.
4. Install under a per-user data directory into an immutable version folder.
   Update the stable launcher only after the new version is complete. Keep the
   previous version available for rollback and never store user data inside a
   version folder.
5. Add a user-scoped `stoix` command and create a normal desktop launch entry
   where the platform supports one without administrator access.
6. Preserve the existing private Stoix configuration and local application
   data across installation, upgrade, repair, and rollback.
7. When Hermes is absent, invoke only the official Nous Research installer
   endpoint. Hermes remains a separate installation. A Hermes failure does not
   corrupt or remove a completed Stoix installation, and the installer prints
   a specific recovery command.
8. When Hermes is available, enable its loopback API server, reuse or create a
   local API key, copy that key only into the private Stoix configuration, and
   start the supported local gateway path. Provider authentication still
   requires the user because Stoix cannot invent credentials or consent.
9. Launch Stoix after installation unless explicitly disabled. Re-running the
   command is idempotent and repairs the stable launcher instead of creating a
   second application copy.
10. Support non-interactive local-archive and no-launch modes so every native
    package job can smoke-test the exact installer path before publication.

Default application roots are `%LOCALAPPDATA%\Programs\Stoix` on Windows,
`~/Applications/Stoix` on macOS, and `~/.local/lib/stoix` on Linux. These roots
are separate from browser IndexedDB, the private configuration directory, and
the per-user durable-data store.

The packaged launcher owns single-instance reuse, loopback binding, port
selection, private configuration creation, startup diagnostics, browser-open
fallbacks, and clean shutdown. It does not install or update application code.

## Security Constraints

- Downloads use HTTPS and published binaries are accepted only after SHA-256
  verification.
- Node source-build runtimes are checked against Node.js' published
  `SHASUMS256.txt` before execution.
- Archive paths, release tags, versions, platforms, architectures, and install
  roots are validated before use.
- Installation is per-user and does not require `sudo` or elevation.
- Hermes credentials and provider keys are never printed, committed, embedded
  in a release archive, or returned to browser JavaScript.
- Stoix and Hermes services remain bound to loopback by default.
- The installers do not evaluate GitHub API fields as shell or PowerShell code.

## Consequences

A new user can install and launch Stoix with one command on a supported system.
Published packages install quickly; the source fallback is slower but keeps the
first-install path functional before the initial public release. Hermes remains
replaceable and independently owned, while installation errors become
actionable rather than leaving a half-written application directory.

Native code signing, macOS notarization, and the project license remain owner
controlled publication requirements. The technical installer must not claim
that unsigned artifacts are signed or notarized.
