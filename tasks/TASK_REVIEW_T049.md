# TASK_REVIEW — T049: Allow clearing a set low-stock threshold

> Sibling of `tasks/TASK_GUIDE_T049.md`. Filled by the Supervisor at Stage 4/5 (2026-10-29).

## Auto decisions

Mode: auto
1. Stage 4 review by an independent reviewer agent; P0/P1 fixed before Done, P2s fixed where cheap, P3s recorded — RULE: `.claude/skills/code-review/SKILL.md` § Phase 4
2. Stage 5 verify done with a scripted headless-Chromium run against the live stack instead of easy-ui-mcp (its port 8766 is held by another process; web served on :8767) — SAFER OPTION: real browser against real API beats skipping UI verify ⚠ decided for you — please review
Checks: tests — pass; reviews code-review — pass; real run `node reports/evidence/T044-T051/verify-web.cjs` — printed the RESULTS block in `reports/evidence/T044-T051/verify-web-result.txt`
Not done: nothing pending for this task

## Evidence

| Check | Result | Notes / output snippet |
|-------|--------|------------------------|
| **New test(s) cover Acceptance Criteria (file paths pasted)** | ☒ pass | `apps/web/src/features/inventory/InventoryPage.test.tsx` "T049 AC1: edit with a cleared/whitespace threshold input PATCHes minThreshold: null" (failed before fix at :582), `apps/api/src/inventory/inventory.e2e.spec.ts` "T049 AC2" — pass |
| Verification command run | ☒ pass | Guide's verification command run by the Supervisor; Supervisor ran full suites on `feat/m001-pnpm-workspace` after all fixes: web vitest `Test Files 36 passed (36) / Tests 230 passed (230)`, web build `✓ built`, API jest `26 suites / 222 tests passed` — pass |
| Negative cases hold | ☒ pass | T041 guards still hold: 0/negative/non-numeric blocked with zero calls; create-mode blank sends no key — pass |
| verify | ☒ pass | Live: ingredient with minThreshold 5 → edit dialog, clear field, Save Changes → API read-back `minThreshold: null` — pass. Supervisor ran `node reports/evidence/T044-T051/verify-web.cjs` (headless Chromium, live API :3000 + vite dev :8767, real Postgres) at 2026-10-29T07:21Z; output in `reports/evidence/T044-T051/verify-web-result.txt` |
| Review scope bounded to the change's blast radius (affected set, not whole repo) | ☒ pass | Reviewed `f95e26a..edbf1b6 -- apps/web` + direct callers and the backend controllers each feature calls (contract check); everything else skipped as outside the blast radius — pass |
| Full smoke suite still green (no regression) | ☒ pass | Supervisor ran full suites on `feat/m001-pnpm-workspace` after all fixes: web vitest `Test Files 36 passed (36) / Tests 230 passed (230)`, web build `✓ built`, API jest `26 suites / 222 tests passed` — pass |
| **Companion score (easy-verifier)** | ☑ N/A | easy-verifier companion not run this session (no `report:` path) — N/A |
| **UI: Visual regression (diff or verdict pasted)** | ☒ pass | No visual change — N/A, pass |
| **UI: Design-system compliance (tokens/colors/typography verified)** | ☒ pass | No visual change — pass |
| **UI: Responsiveness at target viewports** | ☒ pass | No visual change — pass |

---

## Demonstration

**BEFORE**:
```
2026-10-29T05:13:55Z
$ grep -n "if (trimmed === '') return" apps/web/src/features/inventory/IngredientFormDialog.tsx
60:    if (trimmed === '') return undefined;
```

**AFTER**: `minThreshold: parsedThreshold ?? null` in edit payload; live read-back null — see `reports/evidence/T044-T051/verify-web-result.txt`.

**DELTA**: Clearing the threshold now actually removes it instead of silently keeping the old value.

**WITNESS**: Supervisor (main session), 2026-10-29 — independent of the implementing agent; trace in `memory/event-trace/`.
