# Publishing Stoix

Stoix releases are portable, OS-specific archives built in GitHub Actions. A
tag creates a **draft** release; publishing remains an explicit owner action.

## One-Time Owner Decisions

Before publishing the first public release:

1. Choose and add the project license or commercial EULA. This is a legal owner
   decision and must not be inferred from the code.
2. Decide whether unsigned portable archives are acceptable for the first
   preview. A broadly distributed stable release should use platform code
   signing/notarization identities.
3. Confirm that `finxray/hermes-ui` is the permanent public update repository.
4. Review and approve `PRIVACY.md`, which explains local storage, Hermes data
   flow, and the GitHub update check.

## Build A Draft

1. Update both root and Web package versions.
2. Run `npm ci` and `npm run package:release` locally.
3. Review `git diff` and commit from a clean release branch.
4. Create and push an annotated tag, for example `v0.1.0`.
5. The `Package release` workflow builds and smoke-tests Windows x64/ARM64,
   Linux x64/ARM64, macOS Apple Silicon, and macOS Intel archives, attaches
   SHA-256 files, and creates a draft GitHub Release.
6. Each native job also installs its archive through the public bootstrap
   script in an isolated per-user root, then launches and probes that installed
   copy. Download every archive from the draft and repeat the install on a clean
   physical or virtual machine.
7. Add the approved license, privacy link, release notes, and known limitations.
8. Apply required code signatures/notarization and replace unsigned assets when
   the release policy requires them.
9. Publish only when all platform assets are present and verified.

`VERSION.json` records whether the source tree was dirty. A public asset must
have `sourceDirty: false`; locally generated dirty-tree archives are review
candidates only and must not be uploaded to a release.

## Supported Package Behavior

- The package includes Node.js and does not require a source checkout.
- `install.sh` and `install.ps1` provide the supported one-command install path.
- Installation is per-user, versioned, checksum-verified, and does not require
  administrator access.
- It binds only to `127.0.0.1`.
- Hermes remains an external dependency.
- Credentials live in the per-user `config.env`, never in the archive.
- Projects and chats live in browser IndexedDB, outside version directories.
- Update checks notify and link to GitHub; they do not auto-install.

## Rollback

Because `0.1.0` is portable and user data is external, rollback means stopping
Stoix and launching the previous verified archive. Do not delete the browser
profile or per-user configuration during an application rollback.
