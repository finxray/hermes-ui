# UI Interaction Contract 12D

Date: 2026-05-30

Audit base commit: `552cf12 test: recheck live Brain Memory Gateway smoke`

Purpose: freeze the MVP interaction contract for Hermes UI / Brain Memory Studio so later slices can distinguish real behavior, mock/local behavior, placeholders, and regressions.

## Guardrails

- No visual redesign was included in this slice.
- No Hermes streaming logic was changed.
- No Brain Memory BFF, Gateway, or memory scope bridge logic was changed.
- No project/session stable key logic was changed.
- No memory mutation or admin action was added.
- Browser code remains routed through the Web UI backend/BFF.

## Architecture Summary

- The browser renders the Codex-style Studio shell from scoped React components and CSS modules.
- The browser calls Next/Web UI BFF routes for Hermes and Brain Memory.
- Hermes remains the agent runtime and owns live chat execution.
- Brain Memory Gateway remains the memory authority.
- Workspace project/session state is explicit and local to the Studio UI for the MVP.
- Brain Memory console surfaces read-only status, search, and inspect details through Gateway-approved BFF paths.

## Status Counts

Audited UI elements: 40

| Status | Count |
| --- | ---: |
| Real working | 20 |
| Mock/local honest | 12 |
| Placeholder | 8 |
| Broken | 0 |
| Hidden/removed | 0 |

## Interaction Matrix

| # | Surface | Element | Status | Contract |
| ---: | --- | --- | --- | --- |
| 1 | App shell | Root page load | Real working | `/` loads the Studio shell and document title. |
| 2 | App shell | Old green UI removal | Real working | No old green UI markers should render. |
| 3 | Top bar | Left rail collapse toggle | Real working | Toggles the left sidebar via the shell checkbox state. |
| 4 | Top bar | Right rail collapse toggle | Real working | Toggles the right context rail via the shell checkbox state. |
| 5 | Top menu | Workspace | Real working | Current section only; marked with `aria-current`. |
| 6 | Sidebar | Settings trigger | Real working | Opens the settings/status popover. |
| 7 | Sidebar | Settings popover shell | Real working | Shows connection/status controls without changing routes. |
| 8 | Sidebar | Refresh Hermes | Real working | Calls the Hermes status refresh hook through the BFF. |
| 9 | Chat | Activity details disclosure | Real working | Native disclosure expands and collapses activity details. |
| 10 | Composer | Message textarea | Real working | Captures draft text and submits on Enter without Shift. |
| 11 | Composer | Send message | Real working | Sends through the existing Hermes chat hook/BFF path. |
| 12 | Right rail | Context tab | Real working | Switches the right rail to scoped context. |
| 13 | Right rail | Memory tab | Real working | Switches the right rail to Brain Memory. |
| 14 | Right rail | Tools tab | Real working | Switches the right rail to tool/activity summary. |
| 15 | Right rail | Files tab | Real working | Switches the right rail to files/artifacts. |
| 16 | Right rail | Hermes status refresh | Real working | Refreshes Hermes status through the existing BFF hook. |
| 17 | Right rail | Brain Memory status refresh | Real working | Refreshes Brain Memory status through the existing BFF hook. |
| 18 | Memory console | Search input | Real working | Captures read-only memory search query. |
| 19 | Memory console | Search submit | Real working | Calls `/api/brain-memory/search` via the client hook. |
| 20 | Memory console | Detail close | Real working | Closes the read-only memory detail panel. |
| 21 | Sidebar | New project quick action | Mock/local honest | Creates local workspace project state only. |
| 22 | Sidebar | New chat quick action | Mock/local honest | Creates local session/chat state only. |
| 23 | Sidebar | Project row selection | Mock/local honest | Selects local project and preserves explicit scope. |
| 24 | Sidebar | Session row selection | Mock/local honest | Selects local session and preserves explicit scope. |
| 25 | Sidebar | Recent chat row selection | Mock/local honest | Selects local chat and session state. |
| 26 | Settings | Connection rows | Mock/local honest | Displays current local/BFF status; no auth/classification implied. |
| 27 | Settings | Reset mock data | Mock/local honest | Resets local mock workspace state. |
| 28 | Chat | Header/status banner | Mock/local honest | Shows current project/session scope and connection mode. |
| 29 | Chat | Seeded transcript | Mock/local honest | Displays local seeded messages until live chat adds messages. |
| 30 | Chat | Active scope cards/chips | Mock/local honest | Shows explicit project/session memory scope from local state. |
| 31 | Right rail | Tool/file/activity rows | Mock/local honest | Read-only MVP context; no direct tool execution or file mutation. |
| 32 | Memory console | Mock search/detail/evidence | Mock/local honest | Used only when Gateway is absent or mock mode is configured. |
| 33 | Top menu | Memory section | Placeholder | Disabled and labelled as coming soon. |
| 34 | Top menu | Projects section | Placeholder | Disabled and labelled as coming soon. |
| 35 | Top menu | Tools section | Placeholder | Disabled and labelled as coming soon. |
| 36 | Top menu | Help section | Placeholder | Disabled and labelled as coming soon. |
| 37 | Composer | Attach context | Placeholder | Disabled; context attachment controls are deferred. |
| 38 | Composer | Provider/model selector | Placeholder | Disabled; provider/model selector polish is deferred. |
| 39 | Composer | Voice input | Placeholder | Disabled; voice input is deferred. |
| 40 | Composer | Stop response | Placeholder | Disabled during generation; real stop/cancel streaming is deferred. |

## P0/P1 Findings

- P0: none found.
- P1: top menu items looked clickable but had no handlers. Fixed by disabling deferred items and labelling them as coming soon.
- P1: composer utility controls looked actionable but had no handlers. Fixed by disabling attach/model/voice controls and labelling them as placeholders.
- P1: the stop icon implied real cancellation during generation. Kept visible as an honest disabled placeholder and documented real cancellation as deferred.

## Smoke Harness Updates

`scripts/mvp-smoke.mjs` now checks source markers for:

- current Workspace top menu label,
- disabled coming-soon top menu placeholders,
- disabled composer placeholder controls,
- explicit deferred stop/cancel copy.

## Browser Smoke Notes

Browser smoke target: `http://127.0.0.1:3000/`

Observed:

- App loads as Brain Memory Studio.
- Old green UI is absent.
- Project/session sidebar is visible.
- Composer is visible.
- Right rail is visible.
- Settings popover opens.
- No horizontal overflow was observed.
- Browser automation could verify rendered controls and CSS-driven settings behavior. Some React click-handler checks were validated by source and smoke harness rather than treated as fully browser-automated because the in-app browser automation did not reliably mutate React state during this audit.

## Deferred Features

- Full auth/classification model.
- Production one-command CLI.
- Durable evidence/supersession storage.
- Memory mutation/admin actions.
- Real stop/cancel streaming.
- Provider/model selector polish.
- Further UI polish.
- Browser-level interaction regression harness beyond source and route smoke.

## Next Recommended Slice

Slice 12E: add a browser-level interaction regression harness for the MVP shell, covering sidebar selection, chat send, right rail tabs, settings popover, and disabled placeholder assertions without changing product behavior.
