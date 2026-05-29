# Prompt for Codex — Slice 6 Brain Memory Read-only Console

Use GPT-5.5/Codex with **high reasoning**.

Goal: build the dedicated Brain Memory console using Gateway-approved read-only endpoints.

Implement:

- memory search UI,
- filters for tenant/project/session/layer,
- memory result list,
- evidence drawer/detail view,
- supersession chain view,
- audit trail view,
- layer/source labels,
- empty/error/loading states,
- typed Brain Memory client methods,
- tests for result parsing and filters.

Hard constraints:

- Read-only only.
- Gateway endpoints only.
- No direct database/storage access.
- Mark mocked data clearly if endpoints are not available.

Acceptance:

- user can inspect memory results and evidence,
- memory scope is visible,
- UI explains why memory was retrieved,
- no mutation controls are active.
