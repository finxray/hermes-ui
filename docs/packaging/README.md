# Packaging

Stoix `0.1.0` is distributed as a portable, platform-specific archive. Each
archive contains the production Next.js server, a pinned Node.js runtime, a
loopback-only launcher, third-party notices, privacy information, and a SHA-256
digest. Users do not need Node.js or a source checkout.

## Current Documents

- `PACKAGING_MODES.md` describes the supported portable package.
- `../release/PUBLISHING.md` is the owner publication runbook.
- `../release/PACKAGING_AUDIT_0.1.0.md` records the current technical audit.
- `../release/GITHUB_UPDATES.md` documents daily GitHub update discovery.
- `../release/RELEASE_NOTES_TEMPLATE.md` is the release-note template.

## Commands

```powershell
npm ci
npm run release:check
npm run package:release
```

`package:release` builds and smoke-tests the archive for the current operating
system and architecture. GitHub Actions builds Windows, macOS, and Linux draft
release assets from a version tag.

Hermes remains a separately installed runtime. The Stoix launcher never installs,
updates, starts, or stops Hermes and never executes remote update code.
