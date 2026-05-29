# Codex reasoning effort policy

Default project setting: `medium`.

## Use high reasoning when

- starting the project and making architecture decisions,
- reviewing Hermes docs/source and selecting the API integration path,
- designing the Brain Memory UI/API contract,
- implementing real streaming, run events, approvals, and reconnect behavior,
- adding project/session/memory scope rules,
- adding Gateway-controlled memory admin actions,
- making security/auth decisions,
- creating Docker Compose/package layout,
- doing large refactors or cross-cutting changes.

## Use medium reasoning when

- building well-defined slices,
- implementing components from an accepted design,
- writing typed clients from documented contracts,
- adding tests,
- fixing normal bugs,
- doing most day-to-day implementation.

## Use low or minimal reasoning when

- changing copy,
- small CSS polish,
- renaming files,
- formatting,
- adding icons,
- simple mechanical refactors.

## Cost control rule

Do not use high reasoning by default. Use it at decision points. Once the decision is documented, switch back to medium for implementation.
