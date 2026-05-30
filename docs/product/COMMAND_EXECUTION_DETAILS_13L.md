# Command Execution Details 13L

Date: 2026-05-31

## Scope

Slice 13L adds first-class display rendering for command-like
`AgentActivityEvent` items.

The architecture remains:

```text
Browser UI -> Next.js BFF -> Hermes API server / Brain Memory Gateway UI API
```

No browser command execution, direct browser-to-Hermes calls, direct
browser-to-Brain Memory Gateway calls, direct storage access, Hermes source
changes, Brain Memory source changes, Telegram integration, provider
integration, or provider credentials were added.

## Files Changed

- `apps/web/src/types/agentActivity.ts`
- `apps/web/src/lib/agentActivityEvents.ts`
- `apps/web/src/components/chat/AgentActivityBlock.tsx`
- `apps/web/src/components/chat/AgentActivityBlock.module.css`
- `apps/web/src/components/shell/ContextRail.tsx`
- `apps/web/src/components/shell/ContextRail.module.css`
- `scripts/check-agent-activity-events.mjs`
- `scripts/check-agent-activity-rendering.mjs`
- `scripts/mvp-smoke.mjs`
- `scripts/ui-interaction-smoke.mjs`
- `docs/product/COMMAND_EXECUTION_DETAILS_13L.md`
- `docs/product/AGENT_ACTIVITY_EVENT_MODEL.md`
- `docs/architecture/HERMES_EVENT_NORMALIZATION_PLAN.md`
- `docs/product/AGENT_ORCHESTRATION_UX_CONTRACT.md`
- `docs/product/AGENT_ORCHESTRATION_SLICE_PLAN.md`
- `ROADMAP.md`

## Command Detection Rules

Command-like tool events are detected from tool names or payload fields.

Recognized names include:

- `shell`
- `terminal`
- `powershell`
- `bash`
- `python`
- `npm`
- `run_command`
- `command`
- `exec`

Recognized payload fields include:

- `command`
- `cmd`
- `args`
- `argv`
- `cwd`
- `stdout`
- `stderr`
- `output`
- `exit_code`
- `exitCode`
- `return_code`
- `returnCode`

Unknown tools still map to generic `tool` events.

## Command Metadata Model

`AgentActivityEvent` now has optional `command` metadata:

- `command`
- `args`
- `cwd`
- `exitCode`
- `durationMs`
- `stdoutPreview`
- `stderrPreview`
- `outputPreview`
- `sourceChannel`
- `toolName`
- `truncated`

Supported source/channel labels are:

- `web-ui`
- `telegram`
- `cli`
- `api`
- `unknown`

This is source-aware data modeling only. No Telegram ingestion or setup was
implemented.

## Stdout And Stderr Handling

Stdout, stderr, and generic output are displayed only when Hermes/tool payloads
provide them. The UI does not invent command output.

Command output previews are:

- redacted before rendering;
- truncated to compact preview size;
- shown in collapsed activity details;
- rendered as text/preformatted content only;
- never rendered with `dangerouslySetInnerHTML`.

Non-zero exit codes convert completed command tool payloads into failed command
activity rows so the UI does not imply success.

## Chat Transcript Behavior

Command activity rows still use native `details`/`summary` and remain collapsed
by default.

Collapsed rows show:

- command status;
- command preview when available;
- duration when available;
- exit code when available;
- source/channel when available.

Expanded details show:

- command;
- args;
- cwd;
- stdout preview;
- stderr preview;
- output preview;
- redacted raw details.

## Right Rail Behavior

The Tools tab now includes a compact `Recent commands` section before generic
tool activity.

Behavior:

- derives rows from current-session `AgentActivityEvent` command events;
- shows an honest empty state: `No command activity in this session yet.`;
- shows command preview, status, exit code, duration, and channel when present;
- adds no execution controls or direct command UI.

## Redaction Behavior

Command metadata and raw details use the existing activity redaction posture:

- secret-like keys are replaced with `[redacted]`;
- bearer-like strings are rewritten to `Bearer [redacted]`;
- stdout/stderr/output previews are redacted before truncation/display.

## Source/Channel Awareness

Command metadata preserves future source/channel labels such as `telegram`,
`cli`, `api`, and `web-ui` when payloads include them. The default UI keeps
unknown sources quiet in the collapsed row unless a source is present.

This prepares the model for future cross-channel session/event display without
adding Telegram integration in this slice.

## Verification

Synthetic verification covers:

- command payload mapping;
- command args/cwd/exit code/duration extraction;
- stdout preview;
- stderr preview;
- non-zero exit codes mapping to failed status;
- stdout/stderr bearer redaction;
- output truncation;
- source/channel preservation;
- generic unknown tools remaining generic tools;
- no dangerous HTML rendering.

Live verification keeps the normal Hermes UI send/stop smokes. A live command
execution prompt was not forced because command tool availability and approval
policy are environment-dependent.

## Limitations

- Command output is preview-only and not a terminal emulator.
- Output is not persisted as a durable run artifact.
- Command streaming/progress chunks are not separately modeled yet.
- The current production chat path is still session-stream based.
- Approval actions for command execution remain display-only/deferred.

## Future Work

- real command streaming output;
- terminal-style output viewer;
- approvals for command execution on a run-backed path;
- command output artifacts/log files;
- cross-channel session discovery for Web UI, Telegram, CLI, and API events.

## Next Recommended Slice

Slice 13M - Production-Grade Run History/Session Replay.

Reason: command and memory observability now have first-class read-only
surfaces. The next orchestration gap is durable normalized run/session replay
without changing Hermes or Brain Memory authority boundaries.
