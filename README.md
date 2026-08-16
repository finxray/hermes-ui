# Stoix

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
![Status: community beta](https://img.shields.io/badge/status-community_beta-c084fc.svg)

Stoix is an independent, MIT-licensed community interface for
[Hermes Agent](https://github.com/NousResearch/hermes-agent). Run two Hermes
conversations side by side while keeping projects, tools, approvals, and
context visible in one local workspace.

> **Community beta:** expect bugs and breaking changes. The current source
> application has received limited maintainer testing on macOS and on Windows
> with Hermes running inside WSL2. The packaged download and clean-install path
> have not yet received maintainer validation. Linux still needs community
> testing. Do not rely on Stoix as the only copy of important work.

Stoix is not affiliated with or endorsed by Nous Research.

## Current Test Status

| Surface | Current evidence | Beta status |
| --- | --- | --- |
| macOS source application | Used during active development; coverage is not exhaustive | Testers welcome |
| Windows source application | Used with Hermes inside WSL2; coverage is not exhaustive | Testers welcome |
| Packaged download and clean install | Automated checks only; no maintainer clean-machine test yet | High-priority testing needed |
| Linux | Automated package checks only; no maintainer test yet | Experimental; testers needed |
| Native-Windows Hermes integration | Alternate code path exists but is not the maintainer-tested Stoix setup | Experimental |

Automated package checks are useful evidence, but they are not a substitute for
a clean-machine human test. See [beta testing](docs/release/BETA_TESTING.md).

## What Stoix Includes

Stoix provides project-scoped chats, streaming responses, model selection,
plugins, skills, configuration, API-key management, logs, local workspace
persistence, and continuation of Hermes conversations started in external
channels.

Stoix is presentation and orchestration software. Hermes remains the agent
runtime, and all browser requests to Hermes pass through the Stoix server-side
BFF. Brain Memory is not bundled with Stoix `0.1.x`; it may be offered later as
an independently installed Hermes skill or plugin.

## Install And Launch

**macOS or Linux:**

```sh
curl -fsSL https://raw.githubusercontent.com/finxray/hermes-ui/master/install.sh | sh
```

**Windows PowerShell:**

```powershell
& ([scriptblock]::Create((irm https://raw.githubusercontent.com/finxray/hermes-ui/master/install.ps1))) -HermesMode Wsl
```

On Windows, the documented beta setup runs Stoix on Windows and Hermes Agent
inside WSL2. Install Hermes inside WSL2 first, then run the PowerShell command
above; `-HermesMode Wsl` discovers the distro, synchronizes the private API
key, and starts the gateway without installing a second native-Windows Hermes runtime. See the
[Windows and WSL2 test notes](docs/release/BETA_TESTING.md).

The beta installer is designed to detect the operating system and processor,
verify downloads, install Stoix for the current user, add the `stoix` command,
and open Stoix in the default browser. It does not need administrator access or
a preinstalled Node.js runtime. On macOS and Linux it can also help install and
configure Hermes when missing; Windows testers should use the WSL2 path above.

No Stoix GitHub Release is published yet. The bootstrapper therefore downloads
the current public source branch and builds a package with a temporary,
checksum-verified Node.js runtime. This source fallback may take several
minutes and is itself part of the beta test. On a new machine, Hermes may ask the user to
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

## Build a Release Archive

```powershell
npm run package:release
```

`package:release` creates a versioned portable archive and SHA-256 file under
`artifacts/release/`, then launches the bundled runtime and probes the built UI
and Hermes status route through both the portable launcher and the native
installer. These are automated checks, not a complete human or clean-machine
validation. The archive includes a pinned Node runtime, so testers do not need
Node.js.

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

Stoix checks the `finxray/hermes-ui` GitHub Releases channel at most once
every 24 hours. A blue dot beside Settings indicates an unseen release. Manual
checks report whether the current version is up to date. Starting with `0.1.1`,
an installed copy can be updated explicitly on macOS, Linux, or Windows with:

```text
stoix update
```

The command uses the updater bundled with the installed package, preserves the
per-user configuration and data locations, stages the next version separately,
and then starts Stoix. It never installs silently. Published release archives
are verified against their adjacent SHA-256 digest; when no release exists, the
installer uses the documented public-source fallback.

See [GitHub update channel](docs/release/GITHUB_UPDATES.md),
[packaging audit](docs/release/PACKAGING_AUDIT_0.1.0.md), and
[publishing guide](docs/release/PUBLISHING.md).

## Help Test the Beta

Try one real workflow, especially two conversations side by side, and tell us
what breaks. Include the Stoix commit or version, Hermes version, operating
system and architecture, installation method, clean-machine status,
reproduction steps, and redacted `stoix --doctor` output.

- [Report a beta bug](https://github.com/finxray/hermes-ui/issues/new?template=bug_report.yml)
- [Share a platform test](https://github.com/finxray/hermes-ui/issues/new?template=platform_test.yml)
- [Read the contribution guide](CONTRIBUTING.md)
- [Get community support](SUPPORT.md)

## Security Boundary

- Browser code never receives the Hermes API key.
- Mutation routes reject cross-origin requests.
- The production server and Hermes Dashboard recovery bind to loopback.
- No database or agent-runtime state is implemented in the UI.
- Release checks accept GitHub metadata or an approved HTTPS/loopback manifest;
  they do not install software.

Report suspected vulnerabilities privately by following [SECURITY.md](SECURITY.md).

## License

Stoix is available under the [MIT License](LICENSE). You may use, copy, modify,
merge, publish, distribute, sublicense, and sell copies subject to the license
notice. The software is provided without warranty.
