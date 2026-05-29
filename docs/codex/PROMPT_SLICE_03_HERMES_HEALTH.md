# Prompt for Codex — Slice 3 Hermes Health and Capabilities

Use GPT-5.5/Codex with **high reasoning for the first design pass**, then medium for implementation.

Goal: add a server-side Hermes integration layer for health, models, and capabilities.

Read the Slice 0 Hermes API map first.

Implement:

- environment config for Hermes base URL and API key,
- server-side BFF/proxy route or API handler,
- typed Hermes client package/module,
- health endpoint call,
- detailed health endpoint call if available,
- models endpoint call,
- capabilities endpoint call,
- connection status UI,
- safe error states,
- tests for client/adapter where practical.

Hard constraints:

- Do not expose Hermes API key in browser JS.
- Do not implement chat streaming yet.
- Do not mutate Hermes sessions yet.

Report changed files, config needed, run/test commands, and what remains mocked.
