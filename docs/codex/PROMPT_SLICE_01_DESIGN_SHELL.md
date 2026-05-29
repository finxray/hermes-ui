# Prompt for Codex — Slice 1 Design Shell

Use GPT-5.5/Codex with **medium reasoning** unless you need to revisit architecture.

Read:

- `ROADMAP.md`
- `AGENTS.md`
- `docs/adr/ADR-0001-stack-and-boundaries.md`
- `docs/design/DESIGN_SYSTEM_OPENAI_DARK.md`

Goal: scaffold the app and build a beautiful static OpenAI-inspired dark UI shell with mocked data only.

Implement only:

- app scaffold selected in ADR-0001,
- TypeScript setup,
- dark design tokens,
- project/session sidebar,
- central chat area,
- right context/memory/tools panel,
- model selector placeholder,
- connection status placeholder,
- settings placeholder,
- responsive layout.

Do not implement real Hermes or Brain Memory calls.

Acceptance:

- app runs locally,
- UI has polished dark theme,
- mock projects and sessions render,
- no API keys or secrets,
- no direct storage access,
- components are cleanly organized.

Report changed files, run command, what is mocked, and tests/smoke checks.
