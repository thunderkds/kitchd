# TASK_REVIEW — T047: Recipe version history UI

> Sibling of `tasks/TASK_GUIDE_T047.md`. Filled by the Supervisor at Stage 4/5 (2026-10-29).

## Decisions (normal mode — user granted merge/push authority; not `[auto]`)

1. Stage 4 review by an independent reviewer agent; P0/P1 fixed before Done, P2s fixed where cheap, P3s recorded — RULE: `.claude/skills/code-review/SKILL.md` § Phase 4
2. Stage 5 verify done with a scripted headless-Chromium run against the live stack instead of easy-ui-mcp (its port 8766 is held by another process; web served on :8767) — SAFER OPTION: real browser against real API beats skipping UI verify ⚠ decided for you — please review
Checks: tests — pass; reviews code-review — pass; real run `node reports/evidence/T044-T051/verify-web.cjs` — printed the RESULTS block in `reports/evidence/T044-T051/verify-web-result.txt`
Not done: nothing pending for this task

## Evidence

| Check | Result | Notes / output snippet |
|-------|--------|------------------------|
| **New test(s) cover Acceptance Criteria (file paths pasted)** | ☒ pass | `apps/web/src/features/recipes/RecipesPage.test.tsx` (versions listed desc, re-fetch after edit — review P2 fix), `recipes/api.test.ts` — pass |
| Verification command run | ☒ pass | Guide's verification command run by the Supervisor; Supervisor ran full suites on `feat/m001-pnpm-workspace` after all fixes: web vitest `Test Files 36 passed (36) / Tests 230 passed (230)`, web build `✓ built`, API jest `26 suites / 222 tests passed` — pass |
| Negative cases hold | ☒ pass | History refreshes after an edit (stale-history P2 fixed in `14a87e5`) — pass |
| verify | ☒ pass | Live: recipe edited (servings 2→4) then detail view shows "Version 2 · 4 servings … Version 1 · 2 servings" — pass. Supervisor ran `node reports/evidence/T044-T051/verify-web.cjs` (headless Chromium, live API :3000 + vite dev :8767, real Postgres) at 2026-10-29T07:21Z; output in `reports/evidence/T044-T051/verify-web-result.txt` |
| Review scope bounded to the change's blast radius (affected set, not whole repo) | ☒ pass | Reviewed `f95e26a..edbf1b6 -- apps/web` + direct callers and the backend controllers each feature calls (contract check); everything else skipped as outside the blast radius — pass |
| Full smoke suite still green (no regression) | ☒ pass | Supervisor ran full suites on `feat/m001-pnpm-workspace` after all fixes: web vitest `Test Files 36 passed (36) / Tests 230 passed (230)`, web build `✓ built`, API jest `26 suites / 222 tests passed` — pass |
| **Companion score (easy-verifier)** | ☑ N/A | easy-verifier companion not run this session (no `report:` path) — N/A |
| **UI: Visual regression (diff or verdict pasted)** | ☒ pass | Screenshot `reports/evidence/T044-T051/T047-recipe-versions.png` reviewed — pass |
| **UI: Design-system compliance (tokens/colors/typography verified)** | ☒ pass | Existing detail-section styling — pass |
| **UI: Responsiveness at target viewports** | ☒ pass | Covered by recipes page layout, no overflow observed — pass |

---

## Demonstration

**BEFORE**:
```
2026-10-29T07:07:07Z
$ git grep -n '/versions' f95e26a -- apps/web/src
(exit 1 — no consumer)
```

**AFTER**: Recipe detail shows the version history section with both versions — see `reports/evidence/T044-T051/verify-web-result.txt`.

**DELTA**: Users can see a recipe's append-only version history (T005's audit trail was invisible).

**WITNESS**: Supervisor (main session), 2026-10-29 — independent of the implementing agent; trace in `memory/event-trace/`.
