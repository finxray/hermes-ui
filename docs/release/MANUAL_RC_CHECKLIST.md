# Manual RC Checklist

Use this checklist for Hermes UI / Brain Memory Studio release-candidate dry
runs. It is manual by design and does not install, start, stop, or mutate
Hermes, Brain Memory, Docker, systemd, `~/.hermes`, or local secrets.

## 1. Clean Repo

- [ ] Run `git status --short`.
- [ ] Confirm no unexpected tracked or untracked files are present.
- [ ] Run `git log --oneline -n 5`.
- [ ] Record the candidate commit in `docs/release/RELEASE_DECISION_RECORD.md`
  or a copied decision record.

## 2. Install / Build Gate

- [ ] Run `npm install`.
- [ ] Run `npm run check:packaging`.
- [ ] Run `npm run release:check`.
- [ ] Review `docs/release/MVP_COMPLETION_AUDIT_17A.md`.
- [ ] Review `docs/release/FINAL_MVP_LIVE_SMOKE_CHECKLIST_17A.md`.
- [ ] Record failures exactly; do not relabel failed checks as warnings.

## 3. Launcher Gate

- [ ] Run `npm run studio:launch -- --help`.
- [ ] Run `npm run studio:web -- --help`.
- [ ] Choose the intended healthy Web UI base URL.
- [ ] Run `npm run studio:launch -- --check --base-url <healthy-url>`.
- [ ] Confirm the launcher does not report stale selected static chunks.
- [ ] Confirm any stale non-selected servers are documented as warnings.

## 4. Healthy Server Setup

- [ ] Start only the Web UI if no healthy server is running:

```powershell
npm run studio:web -- --port 3002
```

- [ ] Avoid stale or broken default servers on `3000` or `3005`.
- [ ] Verify the selected base URL with:

```powershell
npm run studio:launch -- --check --base-url http://127.0.0.1:<port>
```

- [ ] Use the same selected base URL for all browser smokes.

## 5. Browser Smoke

- [ ] Run `npm run smoke:ui -- --base-url <healthy-url>`.
- [ ] Run `npm run smoke:markdown -- --base-url <healthy-url>`.
- [ ] Run `npm run smoke:markdown:long -- --base-url <healthy-url>`.
- [ ] Run `npm run smoke:memory-detail -- --base-url <healthy-url>`.
- [ ] Confirm browser smoke claims name the healthy selected base URL.
- [ ] Confirm no horizontal overflow is reported.
- [ ] Confirm stale static chunk checks passed before interaction checks.

## 6. Hermes Live Checks

Run this section only when Hermes is intentionally live and configured.

- [ ] Confirm Hermes status through the Web UI BFF.
- [ ] Run `npm run smoke:ui:send -- --base-url <healthy-url>`.
- [ ] Run `npm run smoke:ui:stop -- --base-url <healthy-url>`.
- [ ] Run:

```powershell
node scripts/mvp-smoke.mjs --require-hermes --base-url <healthy-url>
```

- [ ] If Hermes is not running, record `not configured/not running`; do not
  fake success.

## 7. Brain Memory Optional Checks

Run live checks only when Brain Memory Gateway is intentionally live and the
tenant-bound read key is configured.

- [ ] Confirm Brain Memory status through the Web UI BFF.
- [ ] Follow `docs/product/BRAIN_MEMORY_READ_ONLY_QA_GATE_15L.md` before
  claiming live read-only Brain Memory MVP behavior.
- [ ] If Gateway is live, search a known safe memory through the UI or BFF
  smoke.
- [ ] If a result is available, inspect detail through the existing read-only
  BFF inspect route.
- [ ] Run these only when live Gateway/key are available:

```powershell
npm run smoke:ui:memory-live -- --base-url <healthy-url>
npm run smoke:ui:memory-scope -- --base-url <healthy-url>
node scripts/mvp-smoke.mjs --require-hermes --require-brain-memory --base-url <healthy-url>
```

- [ ] If Brain Memory is mock/unconfigured, record that state as accepted for
  the MVP default path.

## 8. UI Manual Checks

- [ ] Production root `/` loads.
- [ ] Old green UI is absent.
- [ ] Project/session sidebar is visible.
- [ ] Project selection works.
- [ ] Session selection/replay works.
- [ ] Composer is visible.
- [ ] Composer send works in live Hermes mode or remains honestly unavailable
  when Hermes is not configured.
- [ ] Stop/cancel works through the current client/BFF abort path in live mode.
- [ ] Activity blocks render and expand/collapse.
- [ ] Markdown headings, lists, tables, links, and code blocks render cleanly.
- [ ] Code-copy controls work.
- [ ] Right rail tabs are visible and usable.
- [ ] Settings popover is available.
- [ ] No horizontal overflow appears at desktop and common narrow widths.

## 9. Secrets / Security

- [ ] `apps/web/.env.local` is not staged or committed.
- [ ] No API keys are printed in logs, docs, screenshots, or release notes.
- [ ] Browser code calls only Web UI BFF routes.
- [ ] No direct browser-to-Hermes path is added.
- [ ] No direct browser-to-Brain-Memory path is added.
- [ ] No direct storage access is added.
- [ ] No memory mutation/admin action is added.
- [ ] No context compaction runtime is added.
- [ ] No infinite scroll, virtualization, or runtime pagination is added unless
  that is the explicit slice being tested.

## 10. Release Decision

- [ ] Pass: all required checks passed and optional live-service status is
  honestly documented.
- [ ] Pass with known limitations: safe gate and browser gate passed, but
  optional live services or deferred features are documented.
- [ ] Blocked: required source/build/audit/browser checks failed or selected
  server could not be verified healthy.

Deferred features that must remain named when relevant:

- production Runs implementation/default;
- Agent access selector UI;
- approval buttons/action routes;
- memory mutation/admin;
- auth/classification;
- durable evidence/supersession/audit;
- production installer;
- export/import;
- context compaction runtime;
- scalable infinite/progressive loading runtime.

Record the final decision in `docs/release/RELEASE_DECISION_RECORD.md` or a
candidate-specific copy. Slice 17A records the current audit posture in
`docs/release/RELEASE_DECISION_17A.md`.
