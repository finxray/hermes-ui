# Stoix 0.1.0 Packaging Audit

Date: 2026-08-05

## Implemented

- Next.js standalone production output with no development fixture routes.
- Hermes-only core boundary; no built-in Brain Memory API, console, client, or
  instruction bridge.
- Cross-platform launcher for Windows, macOS, and Linux.
- Bundled Node 24 runtime; end users do not install Node.js.
- Loopback-only server with automatic free-port selection and browser launch.
- Per-user private configuration stored outside version directories.
- Versioned portable ZIP and SHA-256 generation.
- Package smoke that launches the bundled runtime and probes production routes.
- Daily/manual GitHub update checks with user-visible status and no silent
  installation.
- Cross-channel Hermes session discovery and canonical-session continuation,
  including source icons, persisted metadata, periodic/focus refresh, and a
  release contract check.
- GitHub Actions release gate on all three operating systems.
- Tag-triggered native packaging for Windows x64, Linux x64, macOS Apple
  Silicon, and macOS Intel into a draft GitHub Release.
- Expected platform and architecture assertions prevent runner-label changes
  from silently producing a mislabeled release archive.
- Tracked-secret and packaged-secret scanning plus dependency audit.

## Locally Verified

- Windows x64 portable archive created.
- Packaged runtime launched and shut down cleanly.
- Packaged browser smoke passed for Workspace, Plugins, Config, Keys, Logs, and
  Settings at desktop and compact viewports with no browser errors or page-level
  horizontal overflow.
- Home page, favicon, and Hermes status BFF returned successful responses.
- Compiled and packaged output contains no Brain Memory strings or routes.
- Local credential values were absent from build and package output.
- Dependency audit reported zero vulnerabilities.

Cross-platform archives are generated and verified by the release workflow; a
tag should not be published until those matrix jobs and clean-machine tests pass.

## Owner-Controlled Publication Blockers

1. Add an approved software license or commercial EULA.
2. Approve `PRIVACY.md` and add the public support/contact location.
3. Decide whether `0.1.0` is an unsigned preview or provision code-signing and
   macOS notarization identities for a stable public release.
4. Run clean-machine package tests on Windows, macOS, and Linux.

These decisions require product/legal credentials and cannot be safely inferred
by a coding agent. Until they are resolved, the generated archive is a tested
release candidate, not a fully approved public stable release.
