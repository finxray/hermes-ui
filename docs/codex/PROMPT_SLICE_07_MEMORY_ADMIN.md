# Prompt for Codex — Slice 7 Brain Memory Controlled Admin Actions

Use GPT-5.5/Codex with **high reasoning**.

Goal: add Gateway-mediated memory admin actions.

Only proceed if Brain Memory Gateway admin endpoints exist or a clearly approved contract is available.

Implement, as supported:

- mark stale,
- supersede memory,
- pin/unpin,
- delete only if policy allows,
- confirmation dialogs,
- audit log display for completed actions,
- optimistic UI only where safe,
- tests for action calls and rollback/error states.

Hard constraints:

- No direct storage access.
- No destructive action without confirmation.
- Every mutation must be auditable.
- If endpoint contracts are missing, produce contract proposal only and stop.
