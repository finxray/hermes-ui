# Studio Web Dev Windows Hardening 14N

Date: 2026-05-31

## Purpose

Slice 14N hardens the optional `studio:web` Web UI dev-server wrapper for
Windows and WSL without changing product behavior.

The issue investigated came from the Slice 14M RC dry run: `npm run studio:web
-- --port 3002 --no-open` failed under hidden redirected Windows automation
with `spawn EINVAL`, and the manual root `npm run dev -- --hostname
127.0.0.1 --port 3002` path did not reliably forward host/port flags through
the root workspace script.

## Spawn Behavior

`studio:web` now builds a small command spec before spawning the dev server:

- Windows Node: `cd apps/web && node ..\..\node_modules\next\dist\bin\next dev
  --hostname <host> --port <port>`;
- WSL/Linux/macOS: `cd apps/web && node
  ../../node_modules/next/dist/bin/next dev --hostname <host> --port <port>`;
- `shell` remains `false` for the long-running dev-server child;
- `windowsHide` is `true`;
- child stdout/stderr are piped to the wrapper process and written back to the
  current console.

The reproduced root cause was Windows `.cmd` shim spawning: direct
`spawn("npm.cmd", ...)` threw `EINVAL` under hidden redirected automation even
with piped or ignored stdio, while a Windows shell invocation of npm succeeded.
The root workspace script added a second portability caveat around npm argument
forwarding, and shelling through npm made child lifecycle cleanup less
reliable. The wrapper now invokes the Next CLI directly through Node for the
actual dev-server process, avoids inherited stdio handles, and avoids the root
forwarding path.

## npm vs npm.cmd

For one-shot npm commands, such as optional smokes, the wrapper chooses the npm
executable from the current Node platform:

- `npm.cmd` when `process.platform === "win32"`;
- `npm` everywhere else, including WSL.

The long-running dev-server child intentionally bypasses npm shims and uses
`process.execPath` plus Next's CLI file. Dry-run output and dry-run JSON show
that exact command string.

## Process Lifecycle

The wrapper starts only one Web UI child process. It does not use detached mode.

Pressing `Ctrl+C` or sending `SIGTERM` to the wrapper sends `SIGINT` only to
the child process that the wrapper started. On Windows, npm and Next can sit
behind `cmd.exe`, so shutdown uses `taskkill.exe /PID <started-child-pid> /T`
for the process tree rooted at the wrapper's own child PID. Existing servers on
other ports are not signaled, killed, or inspected beyond non-mutating
HTTP/process diagnostics.

Child spawn errors are handled explicitly and reported as startup failures.
The wrapper does not leave a successful child running after health wait failure;
it signals only its own child before exiting.

## Health Wait

After spawn, the wrapper polls the selected base URL until it is classified as a
likely Studio server or the startup timeout expires. The classification checks:

- root route reachability;
- `Brain Memory Studio` root HTML marker;
- old green UI marker absence;
- sampled `/_next/static/**` chunk health;
- `/api/hermes/status` only as a BFF shape signal.

If startup fails, verbose output includes the current classification and root or
static chunk failure detail. The wrapper does not delete `.next` and does not
stop pre-existing servers.

## Dry-Run, Help, And JSON

`--dry-run` remains the recommended first recovery command. It prints:

- selected base URL;
- exact dev-server command;
- optional browser-open command;
- optional smoke commands;
- child-process shutdown note.

`--json` remains limited to dry-run/refusal output because a real dev server is
long-running and streams logs. JSON output is structured and does not expose
secrets.

`--help` now documents the Windows/WSL executable choice and hidden automation
stdio behavior.

## What Remains Manual

Operators still manually:

- stop stale or broken pre-existing servers after verifying ownership;
- choose an alternate free port when needed;
- delete `apps/web/.next` only as a last-resort manual cleanup after stopping
  the relevant server and confirming the path;
- start Hermes if live Hermes is desired;
- start Brain Memory Gateway if live Brain Memory is desired.

## Safety Boundaries

This slice does not manage Hermes, Brain Memory, Docker, systemd, or any other
service. It does not modify `~/.hermes`, write `apps/web/.env.local`, delete
`.next`, kill unrelated processes, add browser-to-Hermes or browser-to-Brain
Memory paths, change Hermes streaming logic, change Brain Memory BFF logic, or
implement export/import.

## Checks

The contract check for `npm run check:studio-launch` now covers:

- `studio-web-dev.mjs` exists;
- Windows/WSL command helpers exist;
- optional one-shot npm commands select `npm.cmd` on Windows and `npm`
  elsewhere;
- actual dev-server spawn runs Next's CLI from `apps/web`;
- inherited stdio is not used;
- child logs are piped;
- child spawn errors are handled;
- only the child process started by the wrapper is signaled;
- dry-run and help output remain present;
- service-management and destructive commands remain absent.

## Next Recommended Slice

Slice 14O - RC packaging docs consolidation and final local bundle checklist.

Reason: the Windows/WSL launcher caveat is hardened, while production
installer, export/import, service automation, and final one-command bundle
remain explicitly deferred.
