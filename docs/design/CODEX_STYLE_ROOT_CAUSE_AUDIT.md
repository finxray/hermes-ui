# Codex Style Root Cause Audit

Slice 10D starts from clean HEAD `a74e5ee`. Before starting, the uncommitted pre-10D visual WIP was saved at `/tmp/hermes-ui-pre-10d-visual-wip.patch` and the working tree was restored to HEAD.

## Root causes

1. The production shell has no single layout contract. `AppShell`, `Sidebar`, `ChatView`, and `ContextPanel` each own part of the visual structure, while `globals.css` tries to reconcile them afterward.
2. Global selectors are overloaded. Classes such as `section-label`, `pill`, `summary-card`, `text-button`, `tab-button`, and `status-badge` are reused across left rail, chat, and right rail, so a fix for one region changes another.
3. The shell background and panel backgrounds are not tokenized precisely enough. There are tokens for canvas and surfaces, but not for shell atmosphere, transparent rails, dominant workspace, rail dividers, or selected-row fills.
4. The right rail mixes rail layout and card content. Status, memory, contract, metadata, and capability chips all add their own backgrounds and borders, creating nested card layers.
5. The sidebar hierarchy is represented by nested row wrappers. This caused active and hover fills to be measured against child containers instead of the full rail width.
6. Chat vertical rhythm is coupled to the warning banner, transcript, and composer in the same scroll/layout flow. That made warning placement and message spacing regress when one area moved.
7. Previous passes patched production CSS directly. The cascade now includes debug colors, late font-size overrides, and repeated state corrections, which makes visual changes hard to reason about.
8. The live app is stateful. Screenshots can vary with localStorage, current session, memory state, and panel toggles, so visual validation needs a static fixture before production migration.

## Patch vs rewrite

Keep:
- Workspace state hooks, project/session actions, Hermes streaming, BFF clients, Brain Memory read-only clients, composer submit behavior, and memory drawer logic.
- Existing domain data types and mock workspace model.

Replace or isolate:
- Shell layout CSS, rail row primitives, top menu controls, right rail visual treatment, chat transcript rhythm, warning-banner placement, composer surface contract, and reusable control states.

## Recommended approach

Use an isolated static prototype first, then migrate production only after the shell contract is accepted. The prototype should become the visual source of truth; production components can then map existing behavior into those primitives without changing backend or memory paths.

