# Slice 10I Responsive Density Audit

## Purpose

This slice audited and corrected production root UI density after the Codex-style shell migration. The goal was to make the UI scale appropriately across HD, 1440p, 4K, and 5K-like viewports without using whole-app CSS transforms.

## Root Cause Findings

The small-scaling issue was CSS-driven.

Before this slice, the production root used mostly fixed pixel values:

- Body text stayed at `16.1px` from HD through 5K.
- Top menu text stayed at `16.1px`.
- Titles stayed at `19.55px`.
- Left rail capped at `391px`.
- Right rail capped at `483px`.
- Composer/content capped at `973px`.
- Icons were scaled with a CSS transform instead of intrinsic width/height tokens.
- Several controls still had hardcoded `font-size: 11px`, `12px`, `13px`, `14px`, or `16px`, so some button text ignored the intended shell scale.

The selected session/project row issue came from row action controls participating in layout even when hidden. The wrapper got the selected background while the child button stayed as a separate inner surface, making selected rows feel nested and taller than neighboring rows.

## Browser Zoom / Device Pixel Ratio Findings

Runtime inspection used a real Chrome instance with remote debugging on the production root.

Findings:

- `devicePixelRatio`: approximately `1` in the inspected Chrome contexts.
- `visualViewport.scale`: `1`.
- `html` font size: `16px`.
- `body` font size: `16px`.
- Horizontal overflow: false at tested viewport sizes.

The issue was not browser zoom, WSL, or a VM display bridge. It was caused by fixed CSS pixel sizing and mixed style systems after the prototype-to-production migration.

## Density Token Design

Production root now defines shared responsive density tokens on `.app-shell`:

```css
--density-scale: clamp(1, calc(0.82 + 0.018vw), 1.42);
--content-width: clamp(940px, 50vw, 1520px);
--composer-width: var(--content-width);
--font-xs: clamp(13px, calc(12px + 0.08vw), 16px);
--font-small: clamp(14px, calc(12.8px + 0.11vw), 18px);
--font-body: clamp(16px, calc(14px + 0.16vw), 22px);
--font-ui: clamp(17px, calc(14.5px + 0.18vw), 23px);
--font-title: clamp(21px, calc(16.5px + 0.22vw), 28px);
--icon-sm: clamp(16px, calc(14px + 0.12vw), 21px);
--icon-md: clamp(19px, calc(16px + 0.16vw), 25px);
--icon-lg: clamp(24px, calc(20px + 0.22vw), 32px);
--control-height: clamp(38px, calc(32px + 0.42vw), 52px);
--row-height: clamp(40px, calc(34px + 0.4vw), 54px);
--topbar-height: clamp(64px, calc(54px + 0.65vw), 88px);
--rail-width-left: clamp(340px, 18vw, 520px);
--rail-width-right: clamp(420px, 21vw, 620px);
```

## Font Scaling Changes

Font sizes now use shared tokens across:

- top menu buttons
- sidebar actions
- project rows
- session rows
- section headings
- chat title/subtitle
- chat message text
- composer textarea and controls
- right rail title/body
- tabs
- badges
- memory cards
- detail drawer text
- metadata and status copy

Representative computed values after the fix:

| Viewport | Body Text | UI Text | Title Text |
| --- | ---: | ---: | ---: |
| `1920x1080` | `17.07px` | `17.96px` | `21px` |
| `2560x1440` | `18.10px` | `19.11px` | `22.13px` |
| `3840x2160` | `20.14px` | `21.41px` | `24.95px` |
| `5120x2880` | `22px` | `23px` | `27.76px` |

An additional HD-ish `1366x768` check stayed readable without horizontal overflow.

## Icon Scaling Changes

Icons no longer rely on whole-icon transform scaling. Production root now sets intrinsic SVG width/height from responsive tokens:

- default icon: `--icon-md`
- small utility icon: `--icon-sm`
- brand and warning icons: `--icon-lg`

Representative computed icon sizes:

| Viewport | Default Icon | Large Icon |
| --- | ---: | ---: |
| `1920x1080` | `19.07px` | `24.22px` |
| `2560x1440` | `20.09px` | `25.63px` |
| `3840x2160` | `22.14px` | `28.44px` |
| `5120x2880` | `24.19px` | `31.26px` |

## Width Scaling Changes

Widths now scale with viewport size:

- left rail: `clamp(340px, 18vw, 520px)`
- right rail: `clamp(420px, 21vw, 620px)`
- composer/content: `clamp(940px, 50vw, 1520px)`

Representative computed widths:

| Viewport | Left Rail | Right Rail | Composer/Content |
| --- | ---: | ---: | ---: |
| `1920x1080` | `345.6px` | `420px` | `960px` |
| `2560x1440` | `460.8px` | `537.6px` | `1280px` |
| `3840x2160` | `520px` | `620px` | `1520px` |
| `5120x2880` | `520px` | `620px` | `1520px` |

Horizontal overflow remained false for:

- `1366x768`
- `1920x1080`
- `2560x1440`
- `3840x2160`
- `5120x2880`

## Nested Selected Background Fix

Project/session selected rows now use a single active surface:

- `row-with-actions` owns hover and active background.
- `project-button.is-active` and `session-button.is-active` remain transparent.
- inline row actions are absolutely positioned, so hidden rename/archive controls do not inflate active row height.

After the fix, selected session row height matches the selected button height, eliminating the double/nested highlight effect.

## Viewport Sizes Checked

Runtime computed-size checks were performed in Chrome using these viewport sizes:

- `1366x768`
- `1920x1080`
- `2560x1440`
- `3840x2160`
- `5120x2880`

The `5120x2880` run approximates a 5K workspace width for CSS layout validation.

## Real Chrome Smoke Result

Opened the production root in real Windows Chrome:

```text
http://127.0.0.1:3000/
```

Also opened:

```text
http://127.0.0.1:3000/design/codex-shell
```

Screenshot evidence:

- `docs/design/slice-10i-responsive-density-root.png`

The root showed the Codex-style UI, no green design, larger text/buttons, clean selected project/session rows, and no obvious horizontal overflow.

## Checks Run

- `npm run check:workspace-state` passed.
- `npm run check:brain-memory-client` passed.
- `npm run studio:doctor` passed local checks; Hermes direct and BFF were connected, Brain Memory BFF was mock/disabled.
- `npm run typecheck` passed.
- `npm run build` passed.
- `npm audit --audit-level=moderate` passed with `0` vulnerabilities.

## Remaining UI Issues

- A future visual QA pass should inspect actual user 5K display scaling in the user profile, not only emulated CSS viewport sizes.
- The static prototype route still has its own CSS variables. Consider consolidating shared density tokens later if the reference route remains long-lived.
- The right panel can become visually dense at maximum scale when many memory detail cards are open; this is a future content-density pass, not a backend issue.

