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
| **New test(s) cover Acceptance Criteria (file paths pasted)** | ☐ pass / ☐ fail | |
| Verification command run | ☐ pass / ☐ fail | |
| Negative cases hold | ☐ pass / ☐ fail | |
| `verify` skill — works in running app | ☐ pass / ☐ fail | |
| Review scope bounded to blast radius | ☐ pass / ☐ fail | |
| Full smoke suite still green | ☐ pass / ☐ fail | |
| UI: Visual regression | ☐ N/A — pure backend task | |
| UI: Design-system compliance | ☐ N/A — pure backend task | |
| UI: Responsiveness | ☐ N/A — pure backend task | |

---

## Approach

Recipe + RecipeIngredient (join entity) as NestJS modules under `/apps/api/src/recipes`, reading Ingredient.cost_per_unit from T004's module (read-only dependency, no write coupling). cost_computed is calculated live at read/save time from CURRENT ingredient cost — per `PROJECT_SPEC.md` known-risk note, this is the explicitly chosen MVP behavior (not a historical snapshot); document this in code comments to prevent future confusion. Version history: a simple append-only version table or a `version` int + snapshot JSON on each edit.

---

## Edge Case Checklist

- [ ] A Recipe referencing an Ingredient that's later deleted does not crash on read (show "ingredient no longer available" or block the delete — pick one, document which)
- [ ] Ingredient cost_per_unit changing after Recipe creation is reflected live (documented as chosen MVP behavior, not a bug)

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

- [ ] Implementation done
- [ ] Self-review: `Skill({ skill: "code-review" })` run
- [ ] Security review: N/A (Medium risk, judgment call at review)
- [ ] Lint passes
- [ ] Tests written AND pass — output pasted into Evidence table
- [ ] `Skill({ skill: "verify" })` run
- [ ] `memory/MEMORY.md` updated (live-cost-vs-historical decision recorded)
- [ ] Supervisor notified: task ready for Stage 4 review
