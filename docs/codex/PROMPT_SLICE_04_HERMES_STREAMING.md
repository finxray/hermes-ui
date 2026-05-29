# Prompt for Codex — Slice 4 Hermes Chat Streaming

Use GPT-5.5/Codex with **high reasoning**.

Goal: real chat streaming with Hermes for one selected session.

Read:

- `docs/discovery/hermes-api-map.md`
- `docs/performance/CEREBRAS_KIMI_FAST_STREAMING.md`

Implement:

- session-specific message send,
- Hermes streaming endpoint selected in Slice 0,
- SSE/event parser,
- assistant message streaming renderer,
- tool/run event timeline if available,
- stop/interrupt if available,
- reconnect/disconnect handling,
- idempotency key if supported,
- batching so React does not update per token,
- basic tests for stream parsing.

Do not implement Brain Memory console yet.

Acceptance:

- user can send a message and see streamed response,
- stream events do not corrupt session state,
- tool/status events are visually separated,
- stop/interrupt works if supported,
- fast stream simulation does not freeze UI.

Report changed files, run/test commands, known API limitations, and next slice risks.
