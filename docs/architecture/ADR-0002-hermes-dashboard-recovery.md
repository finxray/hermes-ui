# ADR-0002: Controlled Hermes Dashboard Recovery

## Status

Accepted for the Hermes UI 0.1 local development product.

## Context

Hermes UI reads plugin, configuration, key, and log metadata from the Hermes
Dashboard API. A reachable Hermes API does not imply that the Dashboard process
is running. When the Dashboard is absent, the Plugins view currently reports an
unavailable endpoint without offering a useful recovery path.

The installed Hermes CLI exposes a supported lifecycle command:

```text
hermes dashboard --host 127.0.0.1 --port 9119 --no-open
```

Sending a natural-language chat prompt to ask Hermes to run this command would
be nondeterministic, approval-dependent, and would incorrectly use the agent as
an infrastructure process manager.

## Decision

Hermes UI may offer a local **Start Dashboard** recovery action through a typed
BFF route. The route owns a fixed allowlisted argument vector and accepts no
command, host, port, distribution, or executable values from browser input.

The recovery contract is:

1. `GET /api/hermes/dashboard` probes the configured Dashboard base URL and
   reports whether it is reachable and whether this local UI process may start
   it.
2. `POST /api/hermes/dashboard` validates a same-origin, loopback request and
   starts only the fixed Hermes Dashboard command.
3. Runtime selection is explicit and based on Node's host platform:
   - Windows first discovers a native `hermes.exe`, then falls back to the
     the validated WSL distribution selected by ADR-0014. Operators may force
     `native` or `wsl` with `HERMES_DASHBOARD_WINDOWS_MODE` and may pin a distro
     with `STUDIO_WSL_DISTRO`.
   - macOS resolves Hermes through a login Zsh, with Bash and POSIX shell
     fallbacks so Homebrew and user-profile installations are discoverable.
   - Linux resolves Hermes through a login Bash, with a POSIX shell fallback.
   - `HERMES_DASHBOARD_EXECUTABLE` may provide an absolute native executable
     path for controlled packaged or non-standard installations.
4. The Dashboard is always bound to `127.0.0.1`; `--insecure` is prohibited.
5. The BFF polls the Dashboard before reporting success. Plugins refresh only
   after the health probe succeeds.
6. A reachable Dashboard that lacks the plugin hub endpoint is treated as an
   incompatible Hermes version, not as a stopped process.

The browser never executes commands directly and never receives Hermes API
keys, Dashboard session tokens, or arbitrary process-control capability.

## Security Constraints

- Dashboard recovery is disabled when the configured Dashboard URL is not
  loopback HTTP.
- POST requests must be same-origin and addressed through a loopback host.
- Process launch uses an argument vector, not a shell command string.
- Executable discovery commands are fixed by the server and accept no browser
  input. The optional executable override is process configuration only.
- Browser request bodies are ignored; launch parameters are server-owned.
- Only `start` is exposed. Stop, restart, arbitrary commands, and `--insecure`
  remain unavailable from the browser.
- Packaged or remote deployments must replace this local launcher with an
  authenticated desktop/service lifecycle adapter.

## Consequences

Users receive a deterministic recovery path when the Dashboard is stopped.
Hermes remains the runtime and Hermes Dashboard remains the metadata authority.
The Web UI gains narrowly scoped local process orchestration, but not a general
command-execution surface.
