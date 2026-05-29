# Prompt for Codex — Slice 8 Fast Model Mode

Use GPT-5.5/Codex with **medium-high reasoning**.

Goal: add provider/model selection and fast-stream UI mode for very high throughput models such as Cerebras-hosted Kimi K2.6.

Implement:

- model/provider selector connected to Hermes model mechanism if available,
- `fast_streaming_mode` flag,
- stream batching and render throttling,
- dev-only fake stream benchmark at ~1,000 token chunks/sec,
- markdown rendering deferral during fast streams,
- transcript virtualization if needed,
- UI indicator for fast mode.

Acceptance:

- high-throughput fake stream stays responsive,
- no React state update per token,
- user can stop stream,
- final text is complete,
- normal mode still works.
