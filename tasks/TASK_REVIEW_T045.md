# TASK_REVIEW — T045: Expiring-soon widget

> Sibling of `tasks/TASK_GUIDE_T045.md`. Filled by the Supervisor at Stage 4/5 (2026-10-29).

## Auto decisions

Mode: auto
1. Stage 4 review by an independent reviewer agent; P0/P1 fixed before Done, P2s fixed where cheap, P3s recorded — RULE: `.claude/skills/code-review/SKILL.md` § Phase 4
2. Stage 5 verify done with a scripted headless-Chromium run against the live stack instead of easy-ui-mcp (its port 8766 is held by another process; web served on :8767) — SAFER OPTION: real browser against real API beats skipping UI verify ⚠ decided for you — please review
Checks: tests — pass; reviews code-review — pass; real run `node reports/evidence/T044-T051/verify-web.cjs` — printed the RESULTS block in `reports/evidence/T044-T051/verify-web-result.txt`
Not done: nothing pending for this task

## Evidence

| Check | Result | Notes / output snippet |
|-------|--------|------------------------|
| **New test(s) cover Acceptance Criteria (file paths pasted)** | ☒ pass | `apps/web/src/components/ExpiringSoonWidget/ExpiringSoonWidget.test.tsx` (list/empty/error), `pages/Dashboard/Dashboard.test.tsx` — pass |
| Verification command run | ☒ pass | Guide's verification command run by the Supervisor; Supervisor ran full suites on `feat/m001-pnpm-workspace` after all fixes: web vitest `Test Files 36 passed (36) / Tests 230 passed (230)`, web build `✓ built`, API jest `26 suites / 222 tests passed` — pass |
| Negative cases hold | ☒ pass | Error + empty states covered by tests — pass |
| verify | ☒ pass | Live: a batch received with expiry today+2d appears in the dashboard "Expiring Soon" card — pass. Supervisor ran `node reports/evidence/T044-T051/verify-web.cjs` (headless Chromium, live API :3000 + vite dev :8767, real Postgres) at 2026-10-29T07:21Z; output in `reports/evidence/T044-T051/verify-web-result.txt` |
| Review scope bounded to the change's blast radius (affected set, not whole repo) | ☒ pass | Reviewed `f95e26a..edbf1b6 -- apps/web` + direct callers and the backend controllers each feature calls (contract check); everything else skipped as outside the blast radius — pass |
| Full smoke suite still green (no regression) | ☒ pass | Supervisor ran full suites on `feat/m001-pnpm-workspace` after all fixes: web vitest `Test Files 36 passed (36) / Tests 230 passed (230)`, web build `✓ built`, API jest `26 suites / 222 tests passed` — pass |
| **Companion score (easy-verifier)** | ☑ N/A | easy-verifier companion not run this session (no `report:` path) — N/A |
| **UI: Visual regression (diff or verdict pasted)** | ☒ pass | Screenshot `reports/evidence/T044-T051/T045-dashboard.png` reviewed — pass |
| **UI: Design-system compliance (tokens/colors/typography verified)** | ☒ pass | Mirrors LowStockWidget styling/tokens — pass |
| **UI: Responsiveness at target viewports** | ☒ pass | 375px overflow 0px (`m375-dashboard.png`); P3 note: 5 widgets on a 4-col grid leaves Pinned Notes alone on row 2 at ≥lg — accepted — pass |

---

## Demonstration

**BEFORE**:
```
2026-10-29T07:07:07Z
$ git grep -n 'alerts/expiring' f95e26a -- apps/web/src
(exit 1 — no consumer)
```

**AFTER**: Dashboard renders the Expiring Soon card with the live batch — see `reports/evidence/T044-T051/verify-web-result.txt`.

**DELTA**: Staff see stock about to expire on the dashboard; `GET /inventory/alerts/expiring` previously had no consumer.

**WITNESS**: Supervisor (main session), 2026-10-29 — independent of the implementing agent; trace in `memory/event-trace/`.
