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
system and architecture. GitHub Actions builds these native draft-release assets
from a version tag:

- `stoix-<version>-win32-x64.zip`
- `stoix-<version>-linux-x64.zip`
- `stoix-<version>-darwin-arm64.zip` for Apple Silicon Macs
- `stoix-<version>-darwin-x64.zip` for Intel Macs

Each matrix job asserts its expected platform and architecture before packaging,
then launches the bundled runtime on that same operating system.

Hermes remains a separately installed runtime. The Stoix launcher never installs,
updates, starts, or stops Hermes and never executes remote update code.
