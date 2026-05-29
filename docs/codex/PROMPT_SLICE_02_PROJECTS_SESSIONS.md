# Prompt for Codex — Slice 2 Projects and Sessions UX

Use GPT-5.5/Codex with **medium reasoning**.

Goal: make the static UI feel like a real project/session workspace using local mock persistence.

Implement:

- create project,
- rename project,
- archive/delete project,
- create session under project,
- rename session,
- archive/delete session,
- active project/session routing or state,
- local storage adapter with a clean interface,
- empty states,
- loading states,
- basic tests or smoke checks.

Do not implement Hermes chat yet.

Important:

- The local storage adapter is temporary UI persistence only.
- Keep it replaceable with Hermes/Brain Memory-backed persistence.
- Do not add direct memory/database writes.

Report changed files, run/test commands, what remains mocked, and next integration risks.
