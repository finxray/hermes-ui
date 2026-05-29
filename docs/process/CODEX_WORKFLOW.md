# Codex Workflow

Status: Governing process for future slices
Date: 2026-05-29

## Slice Rule

Run one roadmap slice at a time. Never ask Codex to implement the whole roadmap in one run.

Each slice should have:

- a clear goal;
- explicit non-goals;
- files or areas in scope;
- expected checks;
- a commit at the end when the slice is complete.

## Reasoning Effort

Use high reasoning for:

- Slice 00 discovery and architecture decisions;
- Hermes API integration choices;
- Brain Memory contract design;
- real streaming, run events, approvals, stop/cancel, and reconnect behavior;
- project/session/memory scoping;
- memory admin actions;
- auth/security/network exposure decisions;
- packaging and deployment layout.

Use medium reasoning for:

- app scaffold after architecture is accepted;
- normal component implementation;
- local mock persistence;
- typed client work from documented contracts;
- test implementation;
- ordinary bug fixes.

Use low or minimal reasoning for:

- small copy changes;
- CSS polish;
- renames;
- formatting;
- mechanical refactors.

## Standard Slice Flow

1. Read `README.md`, `ROADMAP.md`, `AGENTS.md`, and any slice prompt in `docs/codex/`.
2. Read relevant architecture/design/process docs for the slice.
3. Confirm the slice boundary and do not expand it.
4. Inspect existing files before editing.
5. Make focused changes only.
6. Run available checks for the changed surface.
7. Update docs if architecture or contracts changed.
8. Commit with a concise conventional commit message.
9. End with changed files, test results, mocked/unfinished areas, risks, and the next recommended slice.

## Commit Guidance

- Commit only files relevant to the slice.
- Do not commit roadmap/source zip files.
- Do not commit secrets or `.env` files.
- Do not rewrite unrelated user changes.
- If dependencies are added, explain why in the slice summary.

## Slice Output Format

Every slice final response should include:

- What changed.
- Files changed.
- How to run or test.
- What remains mocked or unimplemented.
- Risks/open questions.
- Suggested next slice and exact prompt/file.

## Current Slice Sequence

- Slice 00: high reasoning, discovery and architecture only.
- Slice 01: medium reasoning, static app shell with mocked data.
- Slice 02: medium reasoning, projects/sessions UX with local mock persistence.
- Slice 03: high first pass, Hermes health/capabilities/BFF client.
- Slice 04: high reasoning, real Hermes streaming/run events.
- Slice 05: high reasoning, project-aware context and Brain Memory contract wiring.
- Slice 06: high reasoning, read-only Brain Memory console.
- Slice 07: high reasoning, controlled audited Brain Memory admin actions.
- Slice 08: medium-high reasoning, model/provider selector and fast-streaming mode.
- Slice 09: medium-high reasoning, packaging.
- Slice 10: medium reasoning for QA and low for small polish.

## Hard Boundaries

- The Web UI is not the agent runtime.
- Hermes remains the agent runtime.
- Brain Memory Gateway remains the memory authority.
- The UI does not access Brain Memory storage directly.
- API keys stay server-side.
- Real integration slices must use typed clients/adapters instead of inline fetch calls inside components.
- Streaming implementation must avoid per-token React state updates.

