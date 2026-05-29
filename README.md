# Hermes UI + Brain Memory Studio

Local ChatGPT-like workspace for Hermes Agent with first-class Brain Memory integration.

This repository is intended to become a downloadable package that contains:

- a beautiful OpenAI-inspired dark Web UI,
- project-based chat sessions,
- Hermes Agent integration,
- Brain Memory integration through Gateway-approved endpoints,
- optional high-throughput model mode for providers such as Cerebras/Kimi K2.6,
- packaging scripts for local development and later Docker Compose.

## Current state

This folder currently contains the roadmap, architecture rules, Codex prompts, and design/performance guidance. It intentionally does **not** contain application code yet. Codex should start with Slice 0 discovery before scaffolding the app.

## Recommended first local commands

Run these from:

```powershell
cd C:\Users\Alexey\.cursor\projects\hermes-ui
```

Then initialize the repository:

```powershell
git init
git add .
git commit -m "chore: add initial Hermes UI roadmap"
```

After that, start Codex with the prompt in:

```text
docs/codex/PROMPT_SLICE_00_DISCOVERY.md
```

## Product thesis

A local ChatGPT-like workspace with transparent, inspectable, project-aware long-term memory.

The Web UI should feel familiar to ChatGPT users: titled sessions, project navigation, contextual continuity, streaming responses, model selection, and polished dark-mode ergonomics. The key differentiator is that Brain Memory makes context persistent, inspectable, and user-controllable.

## Non-negotiable boundary

The UI must not become the memory system or the agent runtime.

- Hermes remains the agent runtime.
- Brain Memory Gateway remains the memory authority.
- The UI may call Hermes and Brain Memory Gateway endpoints.
- The UI must not directly write to Postgres, Redis, Qdrant, RAGLight, or any storage layer.
