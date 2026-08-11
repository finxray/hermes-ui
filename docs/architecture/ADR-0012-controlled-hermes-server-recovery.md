# ADR-0012: Controlled Hermes Server Recovery

## Status

Accepted for Stoix 0.1.

## Context

Stoix chat requires the headless Hermes backend configured by
`HERMES_API_BASE_URL`. When that loopback service is stopped, showing a model
label such as `Hermes default` is misleading and leaves the user without a
direct recovery path.

Hermes 0.20 exposes the Stoix-compatible REST API through the gateway's
`api_server` platform, configured locally at `127.0.0.1`. The
dashboard/desktop command below is not that API:

```text
hermes serve
```

Starting it on the configured API port prevents the real `api_server` from
binding and creates a false-positive dashboard health response.

## Decision

Stoix may offer a local **Launch Hermes** action through a typed BFF route. The
route owns a fixed allowlisted argument vector and accepts no command, host,
port, distribution, executable, or environment values from browser input.

The recovery contract is:

1. `GET /api/hermes/server` probes the configured Hermes API and reports
   whether it is reachable and whether this local Stoix process may start it.
2. `POST /api/hermes/server` validates a same-origin, loopback request, stops
   an accidental `hermes serve` dashboard process, and starts the Hermes
   gateway so its configured `api_server` can bind. WSL first stops the user
   service, then uses the CLI-recommended foreground `gateway run` command in a
   detached `wsl.exe` process so the WSL VM remains alive; native installs use
   `gateway start`.
3. Executable discovery reuses the reviewed native/WSL/macOS/Linux discovery
   used by Dashboard recovery.
4. Hermes binding remains owned by the local gateway configuration; browser
   input cannot alter the bind address, port, or launch arguments.
5. The BFF polls the configured Hermes API before reporting success, and the
   composer refreshes status only after the probe succeeds.
6. Readiness requires the REST API's `/health` endpoint. Dashboard-only
   `/api/health` responses are deliberately not accepted.
7. When no explicit `HERMES_API_KEY` is configured for a loopback server, the
   Windows BFF may resolve `API_SERVER_KEY` from the configured WSL Hermes
   environment using a fixed, server-owned command. As a compatibility fallback
   for a loopback dashboard server, it may read Hermes' no-store root HTML and
   extract its injected dashboard session token. Credentials are used only by
   server-side Hermes clients and are never returned to browser JavaScript.

The browser never executes commands directly and never receives Hermes API
keys or arbitrary process-control capability.

## Security Constraints

- Server recovery is disabled when `HERMES_API_BASE_URL` is not loopback HTTP.
- POST requests must be same-origin and addressed through a loopback host.
- Process launch uses an argument vector, not a shell command string.
- The fixed recovery commands are `serve --stop`, then `gateway stop` and
  `gateway run --replace --force` in WSL, or `gateway start` for a native
  executable.
- Executable discovery accepts no browser input. An absolute executable
  override remains server process configuration only.
- Automatic session-token discovery is restricted to the configured loopback
  HTTP origin and accepts only the exact JSON string assignment emitted by
  Hermes for `window.__HERMES_SESSION_TOKEN__`.
- WSL API-key discovery uses a fixed command and a server-configured
  distribution name; browser input cannot select a command, file, or secret.
- Only this bounded recovery sequence is exposed. Arbitrary commands and
  non-loopback binding remain unavailable from the browser.

## Consequences

Disconnected users receive an accurate composer state and a deterministic
recovery action. Hermes remains the agent runtime and Stoix remains a local
presentation/orchestration layer. The Web UI gains one narrowly scoped local
process action, not a general command-execution surface.
