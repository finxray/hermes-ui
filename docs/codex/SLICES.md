# Codex slice index

Use these prompts one at a time. Do not ask Codex to build the whole project in one pass.

| Slice | Prompt file | Reasoning | Purpose |
|---|---|---:|---|
| 0 | `PROMPT_SLICE_00_DISCOVERY.md` | high | Verify Hermes/docs, init repo, choose stack, write ADR |
| 1 | `PROMPT_SLICE_01_DESIGN_SHELL.md` | medium | Scaffold app and beautiful dark static shell |
| 2 | `PROMPT_SLICE_02_PROJECTS_SESSIONS.md` | medium | Mock project/session UX and persistence adapter |
| 3 | `PROMPT_SLICE_03_HERMES_HEALTH.md` | high then medium | Hermes BFF/client and health/capabilities |
| 4 | `PROMPT_SLICE_04_HERMES_STREAMING.md` | high | Real chat streaming, events, stop, tool timeline |
| 5 | `PROMPT_SLICE_05_PROJECT_MEMORY_SCOPE.md` | high | Project-aware context and Brain Memory client skeleton |
| 6 | `PROMPT_SLICE_06_MEMORY_CONSOLE.md` | high | Read-only Brain Memory console |
| 7 | `PROMPT_SLICE_07_MEMORY_ADMIN.md` | high | Controlled Gateway-mediated admin actions |
| 8 | `PROMPT_SLICE_08_FAST_MODEL_MODE.md` | medium-high | Cerebras/Kimi fast-stream UI mode |
| 9 | `PROMPT_SLICE_09_PACKAGING.md` | medium-high | Docker Compose/setup scripts/release docs |
| 10 | `PROMPT_SLICE_10_POLISH_QA.md` | medium/low | Accessibility, tests, polish |
