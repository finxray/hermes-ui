# Packaging Modes

## Supported: Portable Stoix Archive

The `0.1.0` release is a self-contained archive for one operating system and
architecture. It includes:

- the production Stoix web application;
- a pinned Node.js runtime;
- launch scripts for the target platform;
- Node.js and third-party license notices;
- privacy and version metadata;
- a SHA-256 checksum.

The launcher binds to `127.0.0.1`, selects an available local port, opens the
default browser, and stores configuration outside the application directory.
Hermes is an external dependency and can be configured in the per-user
`config.env` file. If Hermes is unavailable, Stoix reports that state honestly
and offers supported recovery actions.

## Supported: One-Command Per-User Install

`install.sh` (macOS/Linux) and `install.ps1` (Windows) detect the native target,
verify the release archive, install it into an immutable version directory,
repair the stable user launcher, and start Stoix. The scripts use no elevation.
They can invoke Hermes' official installer when Hermes is absent, but Hermes
continues to own its runtime, setup, credentials, services, and updates.

When no public Stoix release exists, the installers use a public-source fallback
with a temporary Node.js runtime verified against Node's published checksum
list. This path is slower but keeps a clean-machine installation possible.

## Update Behavior

Stoix checks the public GitHub release channel at most once every 24 hours and
can also check on demand. It notifies the user and opens the release page only
after an explicit action. Version `0.1.0` does not download or execute remote
code and does not overwrite user data.

## Not Included

- bundled Hermes code or ownership of Hermes updates;
- third-party skill or plugin installation outside Hermes' own interfaces;
- platform installer registration;
- automatic in-place updates;
- code signing or notarization credentials.

Those boundaries keep the first package small, reversible, and OS-agnostic.
