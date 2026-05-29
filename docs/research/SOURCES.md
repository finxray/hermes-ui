# Source notes

Verified by ChatGPT on 2026-05-29. Codex must re-check these during Slice 0 because Hermes and provider APIs are moving quickly.

## Hermes Agent

- Official site: https://hermes-agent.org/
  - Notes: describes Hermes as open source, MIT, self-hosted, with persistent memory, skills, multi-platform gateway, local data, and provider support.

- GitHub repo: https://github.com/NousResearch/hermes-agent
  - Notes: Hermes Agent by Nous Research, MIT license, self-improving agent with memory/skills.

- API server docs: https://github.com/NousResearch/hermes-agent/blob/main/website/docs/user-guide/features/api-server.md
  - Notes: API server exposes Hermes as an OpenAI-compatible HTTP endpoint. Frontends can connect through `/v1`.
  - Notes: documented quick start uses `API_SERVER_ENABLED=true`, `API_SERVER_KEY`, and gateway on `127.0.0.1:8642`.
  - Notes: docs mention CORS is disabled by default and must be allowlisted for direct browser access.

- Programmatic integration: https://github.com/NousResearch/hermes-agent/blob/main/website/docs/developer-guide/programmatic-integration.md
  - Notes: lists OpenAI-compatible API server endpoints and suggests API server for web frontends and non-Python clients.

- API server source: https://github.com/NousResearch/hermes-agent/blob/main/gateway/platforms/api_server.py
  - Notes: source comments list endpoints including `/v1/chat/completions`, `/v1/responses`, `/api/sessions`, `/v1/runs`, run events, approval, stop, capabilities, and health.

- Open WebUI Hermes guide: https://docs.openwebui.com/getting-started/quick-start/connect-an-agent/hermes-agent/
  - Notes: Open WebUI can connect to Hermes because Hermes exposes an OpenAI-compatible API server; Hermes handles tool execution and streams results back.

## Codex / GPT-5.5

- Codex config basics: https://developers.openai.com/codex/config-basic
  - Notes: `model = "gpt-5.5"`, `model_reasoning_effort`, project `.codex/config.toml`, sandbox mode, approvals, and web search options.

- Codex config reference: https://developers.openai.com/codex/config-reference
  - Notes: reasoning effort values include `minimal`, `low`, `medium`, `high`, `xhigh` depending on model support.

- Codex prompting guide: https://developers.openai.com/cookbook/examples/gpt-5/codex_prompting_guide
  - Notes: medium reasoning is recommended as a balanced all-around setting; high/xhigh are for hardest tasks.

- GPT-5.5 guide: https://developers.openai.com/api/docs/guides/latest-model
  - Notes: GPT-5.5 defaults to medium reasoning; high/xhigh should be used only when quality gains justify latency/cost.

## Cerebras / Kimi K2.6

- Cerebras Kimi K2.6 announcement: https://www.cerebras.ai/blog/cerebras-kimi-k2-Enterprise
  - Notes: Cerebras says Kimi K2.6 approaches ~1,000 output tokens/sec and cites 981 output tokens/sec measured by Artificial Analysis.

- Cerebras inference page: https://www.cerebras.ai/inference
  - Notes: Cerebras positions fast inference as enabling more interactive products and more reasoning within a latency budget.
