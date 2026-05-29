# Prompt for Codex — Slice 5 Project-aware Memory Scope

Use GPT-5.5/Codex with **high reasoning**.

Goal: connect project/session identity to Hermes and Brain Memory scope without bypassing Gateway.

Implement:

- project memory scope model,
- mapping between UI session and Hermes session,
- use current Hermes session/memory headers if available,
- Brain Memory Gateway UI client skeleton,
- read-only active context preview placeholder,
- settings for tenant/project/session scope,
- tests for scope mapping.

Hard constraints:

- Do not write to Brain Memory storage directly.
- Do not implement memory admin actions.
- Do not fake memory retrieval as if it were real; clearly label mock data.

Acceptance:

- switching project changes active memory scope,
- outgoing Hermes calls include correct session/project scope metadata where supported,
- UI shows active context scope,
- Brain Memory client has typed methods but can be mocked if endpoints are not ready.
