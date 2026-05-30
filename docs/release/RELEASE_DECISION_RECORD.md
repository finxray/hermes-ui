# Release Decision Record

Copy this template for each release-candidate dry run, or update it in-place
only when the repository intentionally tracks the current candidate decision.

## Candidate

`vX.Y.Z-rc.N`

## Commit

`<commit-sha>`

## Date

YYYY-MM-DD

## Checks Run

| Check | Result | Notes |
| --- | --- | --- |
| `git status --short` | Not run |  |
| `npm install` | Not run |  |
| `npm run check:packaging` | Not run |  |
| `npm run release:check` | Not run |  |
| `npm run studio:launch -- --check --base-url <healthy-url>` | Not run |  |
| `npm run smoke:ui -- --base-url <healthy-url>` | Not run |  |
| `npm run smoke:markdown -- --base-url <healthy-url>` | Not run |  |
| `npm run smoke:markdown:long -- --base-url <healthy-url>` | Not run |  |
| Hermes live checks | Not run | Optional. |
| Brain Memory live checks | Not run | Optional. |

## Result

Pass / Pass with known limitations / Blocked.

## Known Blockers

- None recorded.

## Decision

- Decision:
- Scope:
- Not claimable:

## Approver / Notes

- Approver:
- Notes:
