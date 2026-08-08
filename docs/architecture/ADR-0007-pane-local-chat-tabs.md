# ADR-0007: Pane-local chat tabs

## Status

Accepted for Stoix `0.1.x`.

## Context

Stoix already supports a smoothly animated two-pane workspace, but each pane can
show only one chat. Users need to keep several chats available in either pane,
move chats between panes, and temporarily focus either pane without changing the
underlying Hermes sessions or disturbing the established workspace animation.

## Decision

1. Open tabs are presentation state owned by the Stoix shell. Closing a tab does
   not archive or delete its Hermes session.
2. The main and side panes each own an ordered list of session IDs and one active
   session. The existing workspace active session remains the main pane's active
   session so current project, composer, and persistence behavior stays intact.
3. Both panes render the same tab-strip component and interaction language.
4. Native pointer drag data is used to reorder tabs and move them between panes;
   no drag-and-drop dependency or duplicate session state machine is introduced.
5. Focusing one pane reuses the existing width transition. The prior split width
   and tab contents remain in memory so the split can be restored exactly.
6. Adding a tab creates a normal Hermes session in the pane's current project.
   Closing the final tab creates a replacement only when no other visible pane
   can be promoted.
7. Tab widths respond only to available tab count: relaxed when few tabs are
   open, compact when crowded, with the active compact tab allowed more width.

## Consequences

- Chat tabs remain a lightweight UI concern; Hermes stays canonical for session
  content and lifecycle.
- Existing chats remain available in the sidebar after their tabs are closed.
- The established pane, composer, transcript, minimap, and resize animations are
  reused rather than replaced.
- Native drag-and-drop provides efficient desktop behavior without adding a
  production dependency; keyboard tab selection and close controls remain
  independently accessible.
