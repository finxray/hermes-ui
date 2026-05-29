# Prompt for Codex — Slice 9 Packaging

Use GPT-5.5/Codex with **medium-high reasoning**.

Goal: package Brain Memory + Web UI for GitHub distribution.

Implement:

- `.env.example`,
- Docker Compose draft,
- local setup scripts,
- service health checks,
- docs for Windows/WSL2/macOS/Linux,
- backup/export/import plan,
- troubleshooting guide.

Hard constraints:

- Do not commit secrets.
- Do not make destructive install scripts.
- Keep Brain Memory and Hermes boundaries intact.

Acceptance:

- new user can understand how to run locally,
- services expose health clearly,
- docs explain required external keys/providers,
- package can be tested without hidden assumptions.
