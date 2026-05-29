# Prompt for Codex — Slice 0 Discovery

Use GPT-5.5/Codex with **high reasoning** for this slice.

You are starting the project at:

```text
C:\Users\Alexey\.cursor\projects\hermes-ui
```

Read these files first:

- `README.md`
- `ROADMAP.md`
- `AGENTS.md`
- `docs/architecture/ARCHITECTURE.md`
- `docs/architecture/HERMES_INTEGRATION_NOTES.md`
- `docs/architecture/BRAIN_MEMORY_UI_CONTRACT.md`
- `docs/research/SOURCES.md`

Do **not** scaffold the app yet.

Tasks:

1. Initialize git if it is not initialized.
2. Verify the current Hermes Agent API surface by reviewing official docs/source. Use web search or clone/read the Hermes repo if needed.
3. Document exactly which Hermes endpoints should be used for:
   - health/status,
   - model list,
   - capabilities,
   - sessions,
   - session messages,
   - chat streaming,
   - run events,
   - approvals/clarifications,
   - stop/interrupt,
   - model switching,
   - session/memory scoping headers.
4. Create `docs/discovery/hermes-api-map.md`.
5. Create `docs/discovery/brain-memory-contract-assumptions.md` based on the draft contract, clearly marking unknowns.
6. Create `docs/adr/ADR-0001-stack-and-boundaries.md` with a recommendation for the initial app stack.
7. Decide whether the project should start as:
   - single Next.js app,
   - monorepo with `apps/web` and `packages/*`,
   - Vite/React + separate API server,
   - or another option.
8. Update `ROADMAP.md` only if your discovery finds a better or more current plan.
9. Make a git commit with docs only.

Hard constraints:

- Do not write application code yet.
- Do not install dependencies yet unless needed only for documentation validation.
- Do not connect to live Hermes or Brain Memory yet.
- Do not create database schemas yet.
- Do not bypass Brain Memory Gateway in any proposed design.

At the end, report:

1. Current Hermes API findings.
2. Recommended stack and why.
3. Files changed.
4. Any conflicts with the roadmap.
5. Exact proposed Slice 1 command/prompt.
