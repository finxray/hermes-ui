# Stoix

Stoix is a local Web UI for [Hermes Agent](https://github.com/NousResearch/hermes-agent).
It provides project-scoped chats, streaming responses, model selection, plugins,
skills, configuration, API-key management, logs, local workspace persistence,
and continuation of Hermes conversations started in external channels.

Stoix is presentation and orchestration software. Hermes remains the agent
runtime, and all browser requests to Hermes pass through the Stoix server-side
BFF. Brain Memory is not bundled with Stoix `0.1.0`; it may be offered later as
an independently installed Hermes skill or plugin.

## Run From Source

Requirements: Node.js 24, npm 11, and a separately installed Hermes runtime.

```powershell
npm ci
Copy-Item .env.example apps/web/.env.local
npm run dev
```

Stoix opens on `http://127.0.0.1:3000`. Its default Hermes endpoint is
`http://127.0.0.1:8642`. Put a required `HERMES_API_KEY` only in the ignored
`apps/web/.env.local`; never place credentials in a committed env template.

## Production Build

```powershell
npm run release:check
npm run package:release
```

`package:release` creates a versioned portable archive and SHA-256 file under
`artifacts/release/`, then launches the bundled runtime and probes the production
UI and Hermes status route. The archive includes a pinned Node runtime, so end
users do not need Node.js.

The launcher binds only to `127.0.0.1`, opens the default browser, and stores its
private configuration outside the application directory:

- Windows: `%APPDATA%\Stoix\config.env`
- macOS: `~/Library/Application Support/Stoix/config.env`
- Linux: `$XDG_CONFIG_HOME/stoix/config.env` or `~/.config/stoix/config.env`

Hermes must be installed and started separately. User chats and projects remain
in the browser profile's IndexedDB and are not replaced with application files.

## Channel Continuity

When Hermes reports session source metadata, Stoix shows external conversations
in a dedicated folder for each platform, with the platform glyph replacing the
folder icon. Opening a channel chat continues that canonical Hermes session from
the desktop without creating a duplicate thread under the active local project.
Channel history refreshes periodically and whenever the Stoix window regains
focus. Explicit CLI-style handoff back to a platform is not exposed because
Hermes does not currently provide that operation through its HTTP API.

## Updates

Stoix checks the stable `finxray/hermes-ui` GitHub Releases channel at most once
every 24 hours. A blue dot beside Settings indicates an unseen release. Manual
checks report whether the current version is up to date. Downloading remains an
explicit user action; Stoix `0.1.0` does not execute remote scripts or silently
replace itself.

See [GitHub update channel](docs/release/GITHUB_UPDATES.md),
[packaging audit](docs/release/PACKAGING_AUDIT_0.1.0.md), and
[publishing guide](docs/release/PUBLISHING.md).

## Security Boundary

- Browser code never receives the Hermes API key.
- Mutation routes reject cross-origin requests.
- The production server and Hermes Dashboard recovery bind to loopback.
- No database or agent-runtime state is implemented in the UI.
- Release checks accept GitHub metadata or an approved HTTPS/loopback manifest;
  they do not install software.
