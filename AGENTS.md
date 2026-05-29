# AGENTS.md — Instructions for Codex and coding agents

## Project identity

This project is Hermes UI + Brain Memory Studio: a local ChatGPT-like Web UI for Hermes Agent with transparent, project-aware Brain Memory integration.

## Mandatory boundaries

1. The Web UI is presentation/orchestration, not the agent runtime.
2. Hermes remains the agent runtime.
3. Brain Memory Gateway remains the memory authority.
4. Agent memory path must remain: UI -> Hermes -> Brain Memory MCP/skill -> Brain Memory Gateway.
5. UI observability/admin path must remain: UI -> Brain Memory Gateway UI/Admin API.
6. Browser code should call the Web UI backend/BFF, and the BFF should call Hermes and Brain Memory Gateway.
7. Do not directly read/write Postgres, Redis, Qdrant, RAGLight, SQLite memory internals, or any storage backend from the Web UI.
8. Do not duplicate Hermes' agent state machine in the UI.
9. Do not leak API keys into browser JavaScript.
10. Prefer typed adapters/clients over inline fetch calls inside components.
11. Keep project/session/memory scopes explicit.

## Design direction

Use an OpenAI-inspired dark theme: calm, minimal, refined, high-contrast where needed, lots of breathing room, subtle borders, restrained motion.

Do not copy OpenAI branding, logos, exact product chrome, or proprietary assets. The product should feel familiar, not cloned.

## Development style

- Implement one roadmap slice at a time.
- Before changing architecture, write or update an ADR.
- Keep files small and purposeful.
- Avoid heavy dependencies unless justified.
- Add tests or smoke checks for every integration slice.
- Always report changed files, test results, and what remains mocked.
- Do not expand scope beyond the current slice.

## Hermes research requirement

Before real Hermes integration, inspect current Hermes docs/source and document the exact API surface used by this project.

At minimum verify:

- API server enablement and auth,
- `/health` and `/health/detailed`,
- `/v1/models`,
- `/v1/capabilities`,
- `/v1/chat/completions`,
- `/v1/responses`,
- `/api/sessions` if still present,
- `/v1/runs` and run event/approval endpoints if still present,
- session headers such as `X-Hermes-Session-Id`,
- memory-scope headers such as `X-Hermes-Session-Key`,
- model switching behavior.

If any endpoint has changed, update the roadmap before implementing.

## Brain Memory requirement

The UI may include a Brain Memory console only through Gateway-approved endpoints.

Start read-only:

- health/status,
- project context preview,
- search,
- evidence viewer,
- supersession chain,
- audit trail,
- layer/source labels.

Mutation/admin actions are later-phase only and must be explicit, audited, and Gateway-mediated.

## Fast streaming requirement

The UI must be ready for very fast streams. Do not update React state once per token. Use buffering, requestAnimationFrame batching, incremental parsing, and virtualization when needed.

## Reasoning effort guidance

- Use high reasoning for Slice 0 discovery/architecture, Hermes/Brain Memory contract design, real streaming/run/approval logic, memory admin actions, security/auth, and packaging decisions.
- Use medium reasoning for normal implementation once the slice is well specified.
- Use low/minimal reasoning for text changes, small CSS polish, renames, and mechanical refactors.
- Do not use high reasoning just for routine component work.

## Response format after each slice

Report:

1. What changed.
2. Files changed.
3. How to run/test.
4. What is mocked.
5. What risks remain.
6. Suggested next slice.
