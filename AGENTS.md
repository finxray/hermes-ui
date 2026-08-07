# AGENTS.md - Instructions for coding agents

## Project identity

Stoix is a local Web UI for Hermes Agent. The `0.1.x` core product contains only
the Stoix presentation/orchestration layer and Hermes integration.

Brain Memory is not part of the core application. A future Brain Memory feature
must be independently installed and managed as a Hermes skill or plugin; do not
add Brain Memory routes, clients, bridge instructions, fixtures, or Console UI to
the core package.

## Mandatory boundaries

1. Stoix is presentation/orchestration, not the agent runtime.
2. Hermes remains the agent runtime.
3. Browser code calls the Stoix BFF; the BFF calls Hermes.
4. Do not duplicate the Hermes agent state machine in Stoix.
5. Do not leak API keys into browser JavaScript.
6. Prefer typed adapters/clients over inline component fetch calls.
7. Keep project and session scopes explicit.
8. Keep user data and credentials outside versioned package directories.
9. Bind local services to loopback unless a separately reviewed architecture
   explicitly requires remote access.

## Design direction

Use the established calm, minimal Stoix dark theme. Preserve the workspace,
composer, chart, panel-toggle animation, and shell design unless the task
explicitly targets them. Use the existing icon library and component patterns.

## Development style

- Implement one release slice at a time.
- Write or update an ADR before changing architecture.
- Keep files small and purposeful.
- Avoid heavy dependencies unless justified.
- Add tests or smoke checks for every integration slice.
- Report changed files, tests, mocks, and residual risks.

## Hermes contract

Verify current Hermes documentation/source before changing integration behavior,
including health, capabilities, models, chat/responses, sessions, runs,
approvals, session headers, and model switching.

## Fast streaming

Do not update React state once per token. Use buffering, requestAnimationFrame
batching, incremental parsing, and virtualization where needed.
