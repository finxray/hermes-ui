# Stoix VERSION

State whether this is a community beta, prerelease, or stable release. Include
the MIT license and independent-project disclaimer for every public beta.

## Highlights

- Summarize user-visible improvements.
- Name important reliability or security fixes.

## Requirements

- A separately installed Hermes runtime.
- A modern browser opened by the bundled local launcher.
- Provider credentials configured privately when required by Hermes.

## Downloads

Choose the archive matching the operating system and architecture. Verify it
against the adjacent `.sha256` file before launch.

## Upgrade

Stop the current Stoix process, extract the new archive into a new directory,
and launch it. The per-user config and browser workspace remain outside the
versioned application directory. Keep the previous verified archive available
for rollback.

## Known Limitations

- Updates are user-initiated; `0.1.x` does not silently install releases.
- Hermes is external and must be installed, configured, and started separately.
- List any platform signing/notarization limitation explicitly.

## Verification

### Automated checks

- `npm run release:check`
- `npm run package:release`
- GitHub Actions Windows/macOS/Linux package matrix

### Manual validation

- List the exact operating system, architecture, Hermes installation mode, and
  clean-machine status tested by a person.
- Label every offered package that has automated checks only as experimental.
- Do not turn CI coverage into a human-testing claim.
