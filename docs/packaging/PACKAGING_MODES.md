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

## Update Behavior

Stoix checks the public GitHub release channel at most once every 24 hours and
can also check on demand. It notifies the user and opens the release page only
after an explicit action. Version `0.1.0` does not download or execute remote
code and does not overwrite user data.

## Not Included

- Hermes installation or service management;
- third-party skill or plugin installation outside Hermes' own interfaces;
- platform installer registration;
- automatic in-place updates;
- code signing or notarization credentials.

Those boundaries keep the first package small, reversible, and OS-agnostic.
