# ADR-0014: Windows WSL Hermes Auto-Discovery

## Status

Accepted for the Stoix community beta.

## Context

Stoix uses a local Hermes REST API on `127.0.0.1:8642`. On Windows, the
maintainer-tested integration runs Hermes inside WSL2 while Stoix runs as a
Windows application. The existing recovery and credential-discovery paths
assume the WSL distribution is named exactly `Ubuntu`, and an unconfigured
source checkout does not try the standard loopback API at all. A healthy
Hermes gateway can therefore appear in the UI as `Hermes is not connected`.

The Windows installer also treats Hermes as a native Windows executable unless
integration is skipped. Skipping integration leaves Stoix without the WSL
distribution and API-key configuration it needs.

## Decision

1. The default local Hermes API URL is `http://127.0.0.1:8642` when no explicit
   `HERMES_API_BASE_URL` is set. Operators can still disable real Hermes with
   `HERMES_UI_ENABLE_REAL_HERMES=false` or configure another URL explicitly.
2. Windows Hermes discovery uses one server-owned routine for process launch
   and API-key lookup:
   - an explicit, validated `STUDIO_WSL_DISTRO` is tried first;
   - otherwise Stoix enumerates installed distributions with
     `wsl.exe --list --quiet`, removes Windows UTF-16/NUL artifacts, de-duplicates
     names, and prioritizes Ubuntu distributions before probing the remainder;
   - each candidate is probed with the fixed command
     `bash -lc "command -v hermes"`;
   - native Windows discovery remains the first choice in `auto` mode and can
     still be forced with `HERMES_DASHBOARD_WINDOWS_MODE=native`; the documented
     Windows beta path forces `wsl`.
3. WSL distribution names and executable paths are validated before they are
   placed into an argument vector. Browser requests cannot supply either value.
4. While a WSL runtime is selected, the Stoix server holds a fixed
   `wsl.exe -d <validated-distro> -- sleep infinity` connection lease. This
   prevents Windows from tearing down the distribution—and its Hermes API—a
   few seconds after a short discovery command exits. The lease changes no
   Hermes configuration and ends with the Stoix server process.
5. The Windows installer exposes an explicit `-HermesMode Wsl` path. It finds
   Hermes in an installed WSL2 distribution, enables the Hermes API, reuses or
   creates a private API key, writes only the key and selected distribution to
   Stoix's private configuration, and starts the fixed gateway command. It does
   not install or enable WSL itself.
6. After Hermes recovery succeeds, Stoix performs a forced status/model refresh
   so the composer reflects the model catalog advertised by the live server.

## Security Constraints

- WSL discovery and configuration use `wsl.exe` argument arrays; no browser
  input is evaluated as a command.
- The WSL connection lease executes only the fixed `sleep infinity` program in
  a validated distribution; it cannot run browser-supplied arguments.
- Distribution names are limited to a conservative character set and Hermes
  executable paths must be absolute Unix paths.
- API keys stay in server-side/private configuration and are never returned to
  browser JavaScript or printed by the installer.
- Automatic startup remains restricted to a loopback HTTP endpoint and the
  existing same-origin recovery routes.
- The installer does not request elevation, install WSL, or modify a Linux
  distribution other than the selected Hermes configuration values.

## Consequences

A normal source checkout and packaged Stoix installation can find the standard
local Hermes API without an extra `.env.local`. Windows users no longer need to
know the exact WSL distribution name when Hermes is already installed, and the
website can document an explicit WSL2 integration path instead of telling users
to skip Hermes. Machines without WSL2 or without Hermes in WSL receive a
specific recovery message; they are not silently modified.
