# GitHub Update Channel

Stoix `0.1.x` uses GitHub Releases as its stable update authority:

```text
https://api.github.com/repos/finxray/hermes-ui/releases/latest
```

The app checks at most once every 24 hours and also supports a manual check in
Settings. It validates release metadata and shows an unseen-update dot. It does
not run downloaded code or replace application files. The user reviews and
downloads the release explicitly.

`HERMES_UI_UPDATE_MANIFEST_URL` is only for an approved HTTPS mirror or loopback
development manifest. Public installations need no override.

## Publication Order

1. Push an immutable version tag.
2. Let `package-release.yml` build and smoke-test all supported OS packages.
3. The workflow creates a draft GitHub Release containing archives and SHA-256
   files only after every matrix job passes.
4. Test each draft asset on a clean target OS.
5. Apply required platform signatures/notarization and review legal/privacy text.
6. Publish the release. Only a published, non-prerelease release is announced to
   stable installations.

One-command installation now verifies release checksums and stages immutable
per-user version directories before switching the stable launcher. Automatic
in-place updates remain a separate future feature requiring signed manifests,
health-checked replacement, and rollback; see
`ADR-0003-signed-release-updates.md` and
`ADR-0011-one-command-installation.md`.
