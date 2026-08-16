# Stoix 0.1.0 Packaging Audit

Date: 2026-08-12

## Implemented

- Next.js standalone production output with no development fixture routes.
- Hermes-only core boundary; no built-in Brain Memory API, console, client, or
  instruction bridge.
- Cross-platform launcher for Windows, macOS, and Linux.
- One-command native bootstrap installers with published-package and
  verified-runtime source fallback paths.
- Per-user immutable version installs, stable launch commands, desktop launch
  integration, checksum verification, and isolated native installer smoke.
- Bundled Node 24 runtime; end users do not install Node.js.
- Loopback-only server with a stable configurable port and browser launch; a
  conflict fails clearly instead of silently changing the IndexedDB origin.
- Per-user private configuration stored outside version directories.
- Versioned portable Windows ZIP and Unix tar.gz archives with SHA-256 files.
- Package smoke that launches the bundled runtime and probes production routes.
- Daily/manual GitHub update checks with user-visible status and no silent
  installation.
- Cross-channel Hermes session discovery and canonical-session continuation,
  including source icons, persisted metadata, periodic/focus refresh, and a
  release contract check.
- GitHub Actions release gate across Windows, Linux, and macOS on all six
  supported processor targets.
- Tag-triggered native packaging for Windows x64/ARM64, Linux x64/ARM64,
  macOS Apple Silicon, and macOS Intel into a draft GitHub Release.
- Expected platform and architecture assertions prevent runner-label changes
  from silently producing a mislabeled release archive.
- Tracked-secret and packaged-secret scanning plus dependency audit.

## Automated Windows Development-Environment Verification

- Windows x64 portable archive created.
- Packaged runtime launched and shut down cleanly.
- Native Windows installation, damaged-install repair, stable wrapper launch,
  and single-instance reuse passed in an isolated per-user root.
- Packaged browser smoke passed for Workspace, Plugins, Config, Keys, Logs, and
  Settings at desktop and compact viewports with no browser errors or page-level
  horizontal overflow.
- Home page, favicon, and Hermes status BFF returned successful responses.
- Compiled and packaged output contains no Brain Memory strings or routes.
- Local credential values were absent from build and package output.
- Dependency audit reported zero vulnerabilities.

These checks ran in a development environment and do not establish a clean
download or installation result. Cross-platform archives are generated and
verified by the release workflow; a package must remain clearly labeled beta
until its clean-install status is recorded separately.

## Owner-Controlled Publication Blockers

1. MIT licensing is now resolved in the root `LICENSE` file.
2. Privacy, support, security, and beta-reporting paths must remain public.
3. Decide whether each beta may ship unsigned or provision code-signing and
   macOS notarization identities.
4. Record clean-machine package tests separately for every claimed platform.

Until the remaining gates are resolved, generated archives are beta test
candidates, not approved stable releases.
