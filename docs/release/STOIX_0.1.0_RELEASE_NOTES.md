# Stoix 0.1.0

Stoix 0.1.0 is the first public-preview release candidate of the local Hermes
Agent Web UI.

## Highlights

- Project-scoped Hermes conversations with fast streaming and local workspace
  persistence.
- Searchable model selection with verified Hermes session overrides.
- Hermes Plugins, Skills, Config, Keys, Logs, and Settings surfaces.
- Cross-channel continuity for sessions started through Telegram, Discord,
  WhatsApp, Slack, Signal, Matrix, and other Hermes channels.
- A compact folder per detected platform, using a bare channel glyph while
  preserving the existing Stoix workspace layout.
- ISO, Unix-second, and Unix-millisecond Hermes timestamps normalized for
  reliable external-session recency ordering.
- Daily and manual GitHub update checks with explicit user-controlled downloads.
- Portable loopback-only packages with a pinned Node.js runtime and SHA-256
  checksums.

## Requirements

- A separately installed and running Hermes Agent runtime.
- Provider credentials configured in Hermes or the private Stoix per-user
  configuration when required.
- A modern browser opened by the bundled local launcher.

## Channel Continuity

Stoix reads the canonical Hermes session list and displays external sessions by
their reported source. Opening one continues that exact Hermes session from the
desktop; it does not copy the transcript into an unrelated thread. Stoix checks
for new channel activity periodically and whenever its window regains focus.

Channel chats use the same recency annotation, hover overview, pin, rename, and
archive controls as local chats. Stoix treats equivalent loopback aliases such
as `localhost` and `127.0.0.1` as the same local origin on the same port, so
desktop continuation is not rejected by the BFF.

Hermes currently exposes its platform handoff command through the CLI rather
than its HTTP API. Stoix therefore does not display a send-to-platform control.
Users can continue the same session from its original channel, and Stoix will
pick up the updated history.

Hermes `0.20.0` does not currently expose an authenticated HTTP endpoint that
delivers a Stoix-generated reply through the live Telegram adapter. The reply is
stored in the shared Hermes transcript and affects future context, but it will
not appear as a Telegram message until Hermes adds that delivery capability.

## Downloads

Choose the archive matching the operating system and architecture. Verify it
against the adjacent `.sha256` file before launching it.

## Data And Updates

- The local server binds only to `127.0.0.1`.
- Projects and chats stay in the browser profile's IndexedDB.
- Private configuration lives outside the versioned application directory.
- Updates are announced through GitHub Releases and are never silently
  installed.
- Brain Memory is not bundled in Stoix 0.1.0.

## Known Limitations

- Hermes must be installed, configured, and started separately.
- Channel freshness is polling/focus based rather than push based.
- The preview archives are unsigned unless the published assets are replaced
  with signed/notarized builds.
- Cross-platform publication requires successful Windows, macOS, and Linux
  GitHub Actions package jobs and clean-machine checks.

## Upgrade And Rollback

Stop Stoix, extract the new archive into a new directory, and launch it. The
per-user configuration and browser workspace remain outside version directories.
Keep the previous verified archive available for rollback.

## Verification

- Full `release:check` passed.
- Cross-channel session contract passed.
- Production browser smoke passed at desktop and compact viewports.
- Windows x64 portable package smoke passed.
- Release secret audit passed.
- Dependency audit reported zero vulnerabilities.
