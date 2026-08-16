# Packaging Modes

## Supported: Portable Stoix Archive

Each `0.1.x` package target is a self-contained archive for one operating system and
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

During the community beta, the documented Windows configuration runs Stoix on
Windows and Hermes inside WSL2. The Windows Stoix installer should therefore be
run with `-HermesMode Wsl` after Hermes is installed in WSL2. It discovers the
distribution, synchronizes the private loopback API key, and starts the gateway.

When no public Stoix release exists, the installers use a public-source fallback
with a temporary Node.js runtime verified against Node's published checksum
list. This path is slower but keeps a clean-machine installation possible.

## Update Behavior

Stoix checks the public GitHub release channel at most once every 24 hours and
can also check on demand. Starting with version `0.1.1`, the explicit
`stoix update` command runs the platform-native updater bundled in the installed
package. It preserves the existing install and configuration roots, installs
into a versioned directory, and switches the stable launcher only after the new
bundle is complete. Browser-based update checks remain notification-only, and
no update is installed silently.

## Not Included

- bundled Hermes code or ownership of Hermes updates;
- third-party skill or plugin installation outside Hermes' own interfaces;
- platform installer registration;
- unattended or browser-triggered updates;
- code signing or notarization credentials.

Those boundaries keep the beta package small, reversible, and OS-agnostic.
