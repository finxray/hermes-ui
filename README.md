# Stoix

Stoix is a local Web UI for [Hermes Agent](https://github.com/NousResearch/hermes-agent).
It provides project-scoped chats, streaming responses, model selection, plugins,
skills, configuration, API-key management, logs, local workspace persistence,
and continuation of Hermes conversations started in external channels.

Stoix is presentation and orchestration software. Hermes remains the agent
runtime, and all browser requests to Hermes pass through the Stoix server-side
BFF. Brain Memory is not bundled with Stoix `0.1.0`; it may be offered later as
an independently installed Hermes skill or plugin.

## Install And Launch

**macOS or Linux:**

```sh
curl -fsSL https://raw.githubusercontent.com/finxray/hermes-ui/master/install.sh | sh
```

**Windows PowerShell:**

```powershell
irm https://raw.githubusercontent.com/finxray/hermes-ui/master/install.ps1 | iex
```

That one command detects the operating system and processor, verifies the
download, installs Stoix for the current user, adds the `stoix` command, helps
install and configure the official Hermes Agent runtime when it is missing,
starts its local gateway and Dashboard, and opens Stoix in the default browser.
It does not need administrator access or a preinstalled Node.js runtime.

The first installation may take several minutes when no published Stoix release
is available because the installer builds the production package with a
temporary, checksum-verified Node.js runtime. Later installs use the smaller
prebuilt release package. On a new machine, Hermes may still ask the user to
sign in to a model provider or add an API key; credentials cannot be created or
accepted on the user's behalf.

Launch Stoix later from the Start menu/application launcher or with `stoix` in
a new terminal. Run `stoix --doctor` for a short package, configuration, and
Hermes connection check.

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
npm run package:release
```

`package:release` creates a versioned portable archive and SHA-256 file under
`artifacts/release/`, then launches the bundled runtime and probes the production
UI and Hermes status route through both the portable launcher and the real
native installer. The archive includes a pinned Node runtime, so end users do
not need Node.js.

The launcher binds only to `127.0.0.1`, opens the default browser, and stores its
private configuration outside the application directory:

- Windows: `%APPDATA%\Stoix\config.env`
- macOS: `~/Library/Application Support/Stoix/config.env`
- Linux: `$XDG_CONFIG_HOME/stoix/config.env` or `~/.config/stoix/config.env`

Hermes remains a separate runtime, although the one-command installer can invoke
its official installer and configure its loopback API. Workspace presentation
state stays in browser IndexedDB, while durable attachment bytes live in Stoix's
per-user local data store. Neither is replaced with versioned application files.

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
