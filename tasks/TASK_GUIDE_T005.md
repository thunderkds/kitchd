# TASK_GUIDE — T005: Recipe CRUD + ingredients builder + auto cost roll-up
**Date**: 2026-07-02
**Complexity Level**: C2
**Risk Level**: Medium
**Priority**: P0
**Assigned agent**: backend-developer
**Agent guide**: `.claude/agents/backend.md`

---

## Mandatory Startup (Do Not Skip)

1. Read `PROJECT_SPEC.md`
2. Read `memory/MEMORY.md`
3. Read this file completely
4. Read `.claude/agents/backend.md`
5. C2 task — read `memory/codebase-map.md` if present

---

## Requirement (Pillar 1 — Adapt the requirement)

Build the Recipe entity with an ingredients list builder and automatic cost computation.

**Restated intent**:
> A Chef can create a Recipe with ingredients and steps, and the system computes an estimated cost from live ingredient prices — matching the PRD's MVP Definition of Done's first bullet.

**Out of scope**:
- Task generation from a Recipe (T009)
- Stock deduction on recipe-linked task completion (T011)

**Requirement Refs**:
- FR-001: Recipe CRUD with full field set
- FR-002: auto cost roll-up
- US-001

### Requirement Fidelity Gate

- [x] Restated intent confirmed
- [x] Domain terms align with `memory/glossary.md` (Recipe, RecipeIngredient)
- [x] Every Acceptance Criterion traces to the Requirement
- [x] Requirement Refs covered by Acceptance Criteria

---

## Acceptance Criteria

| # | Criterion (testable) | Traces to requirement |
|---|----------------------|-----------------------|
| 1 | Creating a Recipe with 3 RecipeIngredients returns cost_computed = sum(qty × Ingredient.cost_per_unit) | FR-002, US-001 |
| 2 | Editing a RecipeIngredient qty recalculates cost_computed | FR-002 |
| 3 | Editing a Recipe increments its version and preserves prior version data | FR-001 |
| 4 | Staff can view but not edit a Recipe | FR-018 (via RolesGuard) |

---

## Evaluation & Acceptance

### Success Criteria (observable, pass/fail)

| # | Given (input/state) | Expect (output/behavior) | How it's checked |
|---|---------------------|--------------------------|------------------|
| 1 | Recipe with 3 ingredients at known costs | cost_computed matches manual sum | automated test |
| 2 | Ingredient cost_per_unit changes after Recipe creation | Recipe's cost_computed reflects the new live cost on next read | automated test |
| 3 | Recipe edited twice | version increments each time, old version data retrievable | automated test |

### Verification Command (exact, runnable)

```bash
npm --prefix apps/api run test -- recipes
```

### Evidence (filled by reviewer at Stage 4/5)

| Check | Result | Notes / output snippet |
|-------|--------|------------------------|
| **New test(s) cover Acceptance Criteria (file paths pasted)** | ☒ pass | `apps/api/src/recipes/recipes.e2e.spec.ts` — 8 tests: AC1 (3-ingredient cost sum), AC2 (qty edit recalculates cost), live-cost-on-ingredient-price-change, AC3 (version increments + prior version retrievable), AC4 (Staff view-only via RolesGuard), cross-tenant 404, 2 edge-case negative tests (unknown/cross-kitchen ingredientId → 400) |
| Verification command run | ☒ pass | `npm --prefix apps/api run test -- recipes` → `Test Suites: 1 passed, 1 total / Tests: 8 passed, 8 total` |
| Negative cases hold | ☒ pass | Staff POST/PATCH → 403; cross-tenant GET/PATCH → 404; unknown ingredientId → 400; ingredient from another kitchen → 400 (all asserted in recipes.e2e.spec.ts) |
| verify | ☒ pass | Supervisor-driven independent live verify (2026-07-03), real Postgres, port 3000: AC1 3-ingredient cost sum (2*2+1*3+0.5*5=9.5, exact match); AC2 live recompute (changed Ingredient cost 2→10, Recipe costComputed followed on next read with no recipe edit); AC3 version history (2 edits → version 3, GET /recipes/:id/versions returns all 3 with v1's original name intact). Probes: 🔍 cross-tenant GET → 404; 🔍 unknown ingredientId on create → 400; 🔍 malformed payload (missing name, empty ingredients) → 400 with field-specific errors. All held — PASS. Full session archived at `reports/evidence/T005/verify-api-session.txt` (includes 53/53 regression run). |
| Review scope bounded to blast radius | ☒ pass | Changes confined to `apps/api/src/recipes/**`, `apps/api/src/app.module.ts` (module registration), `apps/api/prisma/schema.prisma` (additive models + one back-relation field each on `Ingredient`/`Kitchen`), and new migration `20260703104034_add_recipes`. No edits under `apps/api/src/inventory`. |
| Full smoke suite still green | ☒ pass | `npm --prefix apps/api run test` → `Test Suites: 8 passed, 8 total / Tests: 53 passed, 53 total` (45 pre-existing + 8 new) |
| UI: Visual regression | ☒ N/A — pure backend task | |
| UI: Design-system compliance | ☒ N/A — pure backend task | |
| UI: Responsiveness | ☒ N/A — pure backend task | |

---

## Approach

Recipe + RecipeIngredient (join entity) as NestJS modules under `/apps/api/src/recipes`, reading Ingredient.cost_per_unit from T004's module (read-only dependency, no write coupling). cost_computed is calculated live at read/save time from CURRENT ingredient cost — per `PROJECT_SPEC.md` known-risk note, this is the explicitly chosen MVP behavior (not a historical snapshot); document this in code comments to prevent future confusion. Version history: a simple append-only version table or a `version` int + snapshot JSON on each edit.

---

## Edge Case Checklist

- [x] A Recipe referencing an Ingredient that's later deleted does not crash on read (show "ingredient no longer available" or block the delete — pick one, document which) — chosen: block the delete via `onDelete: Restrict` FK on `RecipeIngredient.ingredient` (see schema.prisma comment). T004's Inventory module currently has no ingredient-delete endpoint at all, so this is a forward-looking safe default, not an active guard today.
- [x] Ingredient cost_per_unit changing after Recipe creation is reflected live (documented as chosen MVP behavior, not a bug) — verified by test "Ingredient cost_per_unit changing after Recipe creation is reflected live on next read" in recipes.e2e.spec.ts, and documented in code comments in recipes.service.ts and schema.prisma.

---

## Files to Change (Predicted)

| File | Change |
|------|--------|
| `/apps/api/src/recipes/**` | Recipe, RecipeIngredient modules |

## Files Must NOT Touch

| File | Reason |
|------|--------|
| `/apps/api/src/inventory` | Read-only dependency — do not modify T004's module |

---

## Test Plan

Automated tests for cost roll-up math, versioning, RBAC. Manual: create a Recipe via API, verify cost matches manual calculation.

---

## Completion Checklist

- [x] Implementation done
- [x] Self-review: `Skill({ skill: "code-review" })` run — 0 P0/P1, 2 P2 + 1 P3 advisory (not blocking)
- [x] Security review: `Skill({ skill: "security-review" })` run — no HIGH/MEDIUM findings
- [x] Migration safety: GO (purely additive, reversible, zero-downtime)
- [x] Lint passes
- [x] Tests written AND pass — output pasted into Evidence table
- [x] `verify` — Supervisor-driven independent live run against a running server (documented in Evidence table)
- [ ] `memory/MEMORY.md` updated (live-cost-vs-historical decision recorded) — Supervisor-only write, pending Stage 5 diff-driven pass
- [x] Supervisor notified: task ready for Stage 4 review
