# TASK_GUIDE — T020: CSV export for inventory & recipes
**Date**: 2026-07-02
**Complexity Level**: C1
**Risk Level**: Low
**Priority**: P2
**Assigned agent**: backend-developer
**Agent guide**: `.claude/agents/backend.md`

---

## Mandatory Startup (Do Not Skip)

1. Read `PROJECT_SPEC.md`
2. Read `memory/MEMORY.md`
3. Read this file completely
4. Read `.claude/agents/backend.md`
5. C1 task — codebase-map read not required

---

## Requirement (Pillar 1 — Adapt the requirement)

Let the chef back up their data outside the app.

**Restated intent**:
> Chef+ can export the Ingredient list and Recipe list (with RecipeIngredient breakdown) as CSV files.

**Out of scope**:
- Export of Tasks/Notes/other entities (not in FR-023 scope)
- Import/re-upload of CSV (export only)

**Requirement Refs**:
- FR-023

### Requirement Fidelity Gate

- [x] Restated intent confirmed
- [x] Domain terms align with `memory/glossary.md`
- [x] Every Acceptance Criterion traces to the Requirement
- [x] Requirement Refs covered by Acceptance Criteria

---

## Acceptance Criteria

| # | Criterion (testable) | Traces to requirement |
|---|----------------------|-----------------------|
| 1 | Exported Ingredient CSV round-trips all fields with correct headers | FR-023 |
| 2 | A Recipe with steps/notes containing commas or newlines exports as valid CSV (proper quoting/escaping) | FR-023 |
| 3 | Exporting an empty Ingredient list produces a valid header-only CSV, not an error | FR-023 |

---

## Evaluation & Acceptance

### Success Criteria (observable, pass/fail)

| # | Given (input/state) | Expect (output/behavior) | How it's checked |
|---|---------------------|--------------------------|------------------|
| 1 | GET /export/ingredients | Valid CSV with all Ingredient fields | automated test parsing the output |
| 2 | Recipe step containing `"a, b\nc"` | CSV field properly quoted/escaped, parses back correctly | automated test |
| 3 | Empty Ingredient table | Header-only CSV, 200 not 500 | automated test |

### Verification Command (exact, runnable)

```bash
npm --prefix apps/api run test -- export
```

> **Evidence is a required document, not a formality.** A task is not Done until every row below is filled with real, pasted output — not just checked. The `verify` row's Notes cell must contain the literal word "pass" (case-insensitive) for the pipeline gate hook to allow merge; use a bare `| verify |` first cell (no backticks) or the hook's regex won't match. See `memory/learnings.md` (2026-07-03/2026-07-04 entries) for the exact gotcha history.

### Evidence (filled by reviewer at Stage 4/5)

| Check | Result | Notes / output snippet |
|-------|--------|------------------------|
| **New test(s) cover Acceptance Criteria (file paths pasted)** | pass | `apps/api/src/export/export.e2e.spec.ts` — 5 tests: AC1 (`AC1: exports the Ingredient list as CSV with correct headers and values`), AC3 (`AC3: exporting an empty Ingredient list returns 200 with header-only CSV`), AC2 (`AC2: escapes commas and newlines in Recipe steps and round-trips correctly`), plus 2 negative/RBAC tests (`Staff (read-only role) gets 403 attempting to export`, `Export is kitchen-scoped: another kitchen Ingredients never appear`). |
| Verification command run | pass | `npm --prefix apps/api run test -- export` → `Test Suites: 1 passed, 1 total` / `Tests: 5 passed, 5 total` (run with `DATABASE_URL`/`JWT_SECRET`/`JWT_EXPIRES_IN` exported from root `.env`, matching how other e2e specs in this repo run locally). |
| Negative cases hold | pass | STAFF role → 403 on `GET /export/ingredients` (RolesGuard, `EXPORT_ROLES = [OWNER, ADMIN, CHEF]`); cross-tenant isolation verified — Kitchen B's export never contains Kitchen A's Ingredient. |
| verify | pass | Live end-to-end check against running app (`PORT=3099 npm run start`): signed up an Owner, created an Ingredient, `GET /export/ingredients` → `200`, `Content-Type: text/csv`, `Content-Disposition: attachment; filename="ingredients.csv"`, correct CSV body (`id,name,unit,costPerUnit,category,allergens,supplierId,minThreshold` header + one data row); `GET /export/recipes` on an empty Recipe table → `200` with header-only CSV (`recipeId,recipeName,servings,steps,ingredientId,ingredientName,qty,unit`). **Stage 4 re-verify (Supervisor, 2026-07-06)**: independently re-ran `npm --prefix apps/api run test -- export` (5/5 passed) and full suite (20 suites/151 tests passed). Code-review: 0 P0/P1/P2, 2 P3 advisory (multi-allergen test coverage, recipe cost not included in export — neither required by ACs). Removed a stray `.env` created for local test running (not committed). pass. |
| Review scope bounded to blast radius | pass | Change is additive-only: new `apps/api/src/export/**` module (controller, service, e2e spec) + a one-line import/array addition in `apps/api/src/app.module.ts`. No existing file's logic was modified; Inventory/Recipes modules were read-only dependencies (Prisma reads via existing `PrismaService`), consistent with "Files Must NOT Touch". |
| Full smoke suite still green | pass | `npm --prefix apps/api run test` → `Test Suites: 20 passed, 20 total` / `Tests: 151 passed, 151 total` (includes the new `src/export/export.e2e.spec.ts` alongside all pre-existing suites). |
| UI: Visual regression | N/A — export button only, minimal UI surface | Pure backend task; no UI component added in this slice. |
| UI: Design-system compliance | N/A | Pure backend task. |
| UI: Responsiveness | N/A | Pure backend task. |

---

## Approach

Use a battle-tested CSV library (not hand-rolled string joining) to guarantee correct quoting/escaping. Endpoints under `/apps/api/src/export`, RBAC-gated Chef+.

---

## Edge Case Checklist

- [ ] Exporting an empty Ingredient list produces a valid header-only CSV, not an error
- [ ] Special characters (commas, quotes, newlines) in Recipe steps/Note bodies are correctly escaped

---

## Files to Change (Predicted)

| File | Change |
|------|--------|
| `/apps/api/src/export/**` | Export endpoints |

## Files Must NOT Touch

| File | Reason |
|------|--------|
| `/apps/api/src/recipes`, `/apps/api/src/inventory` | Read-only dependency |

---

## Test Plan

Automated tests including a round-trip parse of the generated CSV, and a special-character escaping test.

---

## Completion Checklist

- [x] Implementation done
- [ ] Self-review: `Skill({ skill: "code-review" })` run (Supervisor/Stage 4)
- [x] Security review: N/A (Low risk)
- [x] Lint passes (`npx eslint "src/export/**/*.ts"` — clean after `--fix`)
- [x] Tests written AND pass — output pasted into Evidence table
- [x] `Skill({ skill: "verify" })` run — manual live e2e check documented in Evidence table (`verify` row)
- [ ] `memory/MEMORY.md` updated (Supervisor-only write)
- [x] Supervisor notified: task ready for Stage 4 review
