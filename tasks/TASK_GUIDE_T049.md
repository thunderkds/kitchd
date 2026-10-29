# TASK_GUIDE — T049: Allow clearing a set low-stock threshold
**Date**: 2026-10-29
**Complexity Level**: C1
**Risk Level**: Low
**Priority**: P2
**Assigned agent**: frontend-developer (backend-developer only if AC2's API test proves the API rejects `null`)
**Agent guide**: `agents/frontend-implementer.md`
**Linear**: HUN-93

> Read relevant files from `docs/legacy/` before making any code changes. (This project has no `docs/legacy/`; `PROJECT_SPEC.md` + `memory/MEMORY.md` are its equivalent.)

---

## Mandatory Startup (Do Not Skip)

1. Read `PROJECT_SPEC.md`
2. Read `memory/MEMORY.md` (T041 entries: "A form field that never reaches its consumer…", "A sentinel-valued filter turns `0`…")
3. Read this file completely
4. Read `agents/frontend-implementer.md`

---

## Requirement (Pillar 1 - Adapt the requirement)

Origin: T041 Stage 4 P2 finding (KANBAN Todo row).

**Restated intent**:
> When editing an ingredient that already has a low-stock threshold, clearing the threshold input and saving must remove the threshold (store `null`), instead of silently keeping the old value.

Today `IngredientFormDialog.parseThreshold()` maps blank → `undefined`, so `JSON.stringify` drops the key and `PATCH /ingredients/:id` leaves the stored value unchanged.

**Out of scope**:
- Changing the create flow (blank on create already means "no threshold" because the key is simply absent)
- Changing the "0 / negative / non-numeric is blocked" rule from T041
- Any schema change — `minThreshold` is already `Float?` in `schema.prisma`

**Requirement Refs**:
- KANBAN T049: "clearing the input sends no key, so the old value silently persists; needs `minThreshold: null` in the payload + backend nullability"

### Requirement Fidelity Gate

- [x] Restated intent matches the KANBAN row
- [x] Every Acceptance Criterion traces to the Requirement

---

## Dependencies & Reachability

**Depends on**: T041 (done)

**Entry point**: `IngredientFormDialog`

**Consumer**: Inventory page edit dialog → `PATCH /ingredients/:id` → `AlertsService#lowStock`

---

## Acceptance Criteria

| # | Criterion (testable) | Traces to requirement |
|---|----------------------|-----------------------|
| 1 | Editing an ingredient with a threshold, clearing the input and saving sends `minThreshold: null` in the PATCH body | "clearing … must remove the threshold" |
| 2 | `PATCH /ingredients/:id` with `{ "minThreshold": null }` returns 200 and the stored value becomes `null` (API e2e test) | "backend nullability" |
| 3 | Creating an ingredient with a blank threshold still sends no `minThreshold` key (unchanged behaviour) | out-of-scope guard |
| 4 | Zero/negative/non-numeric thresholds are still blocked client-side with zero network calls (T041 regression guard) | out-of-scope guard |

---

## Evaluation & Acceptance

### Success Criteria (observable, pass/fail)

| # | Given | Expect | How it's checked |
|---|-------|--------|------------------|
| 1 | Edit dialog for ingredient with `minThreshold: 5`, input cleared, Save | `updateIngredient` called with `minThreshold: null` | vitest |
| 2 | API: PATCH with `minThreshold: null` | 200, `GET` returns `minThreshold: null` | jest e2e |
| 3 | Create dialog, blank threshold | payload has no `minThreshold` key | vitest |
| 4 | `0` typed | error shown, no call | vitest (existing T041 test must still pass) |

### Verification Command (exact, runnable)

```bash
pnpm --filter @kitchenos/web exec vitest run src/features/inventory && pnpm --filter @kitchenos/web run build && (cd apps/api && npx jest src/inventory/inventory.e2e.spec.ts)
```
(API e2e needs Postgres: `docker start kitchenos-postgres`.)

### Evidence

> Filled by the reviewer in `tasks/TASK_REVIEW_T049.md`.

---

## Approach

**Vital slice**: in edit mode, blank → `null`; in create mode, blank → `undefined`. Widen `UpdateIngredientInput.minThreshold` in `features/inventory/types.ts` to `number | null`. Backend: `@IsOptional()` already skips validation for `null`, so the DTO likely accepts it as-is — prove it with the e2e test first (test-first); only if it fails, widen the DTO type to `number | null`.

**Cut list**: no "clear" button, no UI copy change beyond what's needed.

---

## Edge Case Checklist

- [ ] Ingredient had no threshold, edit with blank input → sending `null` is harmless (stays null)
- [ ] Whitespace-only input counts as blank
- [ ] Low-stock widget no longer lists the ingredient after the threshold is cleared

---

## Files to Change (Predicted)

| File | Change |
|------|--------|
| `apps/web/src/features/inventory/IngredientFormDialog.tsx` | blank → `null` in edit mode |
| `apps/web/src/features/inventory/types.ts` | `minThreshold?: number \| null` on the update input |
| `apps/web/src/features/inventory/IngredientFormDialog.test.tsx` (or the existing inventory test file) | AC1, AC3 tests |
| `apps/api/src/inventory/inventory.e2e.spec.ts` | AC2 test |
| `apps/api/src/inventory/dto/update-ingredient.dto.ts` | only if AC2 test fails |

## Files Must NOT Touch

| File | Reason |
|------|--------|
| `apps/api/prisma/schema.prisma` | column is already nullable |
| `apps/api/src/inventory/alerts/*` | alert filter is correct |

---

## Test Plan

Test-first: write AC1 + AC2 tests, see them fail (AC2 may already pass — record that), implement, rerun the verification command.

---

## Completion Checklist

- [ ] Implementation done
- [ ] Tests written AND pass
- [ ] Web build passes
- [ ] Supervisor notified: task ready for Stage 4 review
