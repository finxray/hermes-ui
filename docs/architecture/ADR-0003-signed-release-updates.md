# ADR-0003: Signed Release Updates

## Status

Accepted for Stoix `0.1.0`.

The statements about initial installation are superseded by ADR-0011. This ADR
continues to govern automatic in-place application updates and signing.

## Context

Stoix is currently a local Node/Next application started by repository
scripts. It is not yet an Electron, Tauri, MSIX, PKG, or Linux desktop package.
Updating a user's working tree with `git pull` or running package-manager
commands from browser code would be unsafe: it can overwrite local changes,
mix application code with user data, and leave a partially installed version.

## Decision

Stoix uses an opt-in, release-channel updater with these boundaries:

1. The browser asks the Stoix BFF to check for an update.
2. The BFF reads the public GitHub latest-release metadata, or a configured HTTPS
   release manifest, and reports only validated, non-secret metadata to the browser.
3. The user must explicitly choose to download or install an update.
4. Published bundles are complete, versioned artifacts for Windows, macOS, and
   Linux, split by architecture when needed.
5. Every artifact has a SHA-256 digest. Production manifests and artifacts must
   also be signed by a release key whose public key is pinned in the launcher.
6. A future packaged launcher downloads into a staging directory, verifies the
   signature and digest, stops the local server, switches the active version on
   restart, runs a health check, and rolls back if startup fails.
7. User projects, chats, settings, logs, credentials, and plugin data live
   outside version directories and are never replaced by an application update.
8. Stable is the default channel. Beta is opt-in. Downgrades are never automatic.

The `0.1.0` source distribution implements GitHub release checking and the consent
UI. ADR-0011 adds checksum-verified, staged initial installation into versioned
bundles; automatic in-place replacement remains governed by this ADR.
The public stable notification channel is the repository's latest non-draft,
non-prerelease GitHub Release. The application checks at most once per 24 hours
automatically, caches the result locally, and also supports an explicit
user-initiated check. The signed manifest remains a release asset for the future
packaged installer and approved private update-channel overrides.

## Manifest Contract

```json
{
  "schemaVersion": 1,
  "channel": "stable",
  "version": "0.1.1",
  "publishedAt": "2026-08-02T12:00:00Z",
  "notes": ["Fixed startup recovery", "Improved plugin management"],
  "releaseUrl": "https://example.invalid/hermes-ui/releases/v0.1.1",
  "artifacts": [
    {
      "platform": "win32",
      "arch": "x64",
      "url": "https://example.invalid/hermes-ui-v0.1.1-win32-x64.zip",
      "sha256": "64-lowercase-hex-characters",
      "signature": "base64-detached-signature"
    }
  ],
  "signature": "base64-signature-of-the-canonical-manifest"
}
```

The production launcher must reject malformed, unsigned, incorrectly signed,
wrong-platform, digest-mismatched, or older manifests.

## Release Service

Use immutable GitHub Releases or equivalent immutable object storage. Build all
artifacts in CI, attach them before publication, publish the signed manifest
last, and generate build provenance/attestations. GitHub documents immutable
release assets and artifact attestations as supply-chain integrity controls:

- https://docs.github.com/en/code-security/concepts/supply-chain-security/immutable-releases
- https://docs.github.com/en/actions/concepts/security/artifact-attestations

## Consequences

- `0.1.0` can safely notify users of releases without modifying their machine.
- The public stable notification channel uses GitHub Releases by default; an
  environment variable is needed only for an approved manifest override.
- One-command installation is implemented by ADR-0011. Automatic in-place
  replacement still requires the signed update design in this ADR.
- The updater remains OS-agnostic and does not depend on PowerShell, Bash, Homebrew,
  apt, or a mutable Git checkout.
