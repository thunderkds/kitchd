# TASK_GUIDE — T004: Ingredient CRUD + StockBatch + StockMovement ledger
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

Build the ingredient catalog and the audit-trailed stock ledger that inventory alerts and recipe costing depend on.

**Restated intent**:
> Chef+ can manage Ingredients and receive/adjust stock; every stock change is recorded as an immutable, attributed StockMovement entry; Staff can view but not edit.

**Out of scope**:
- Low-stock alert surfacing (T007 consumes this data)
- Recipe cost roll-up (T005 consumes Ingredient.cost_per_unit)
- Deduction-on-task-completion (T011)

**Requirement Refs**:
- FR-009: StockMovement ledger (receive/consume/waste/adjust, qty, reason, actor, timestamp)
- FR-011: StockBatch tracking with expiry
- US-005, US-006
- NFR-007: audit trail on stock adjustments

### Requirement Fidelity Gate

- [x] Restated intent confirmed
- [x] Domain terms align with `memory/glossary.md` (Ingredient, StockBatch, StockMovement)
- [x] Every Acceptance Criterion traces to the Requirement
- [x] Requirement Refs covered by Acceptance Criteria

---

## Acceptance Criteria

| # | Criterion (testable) | Traces to requirement |
|---|----------------------|-----------------------|
| 1 | Chef can create/edit an Ingredient (name, unit, cost_per_unit, category, allergens, supplier_id, min_threshold) | US-006 |
| 2 | Staff gets 403 attempting to edit an Ingredient | FR-018 (via T002's RolesGuard) |
| 3 | Receiving stock creates a StockBatch AND a StockMovement(type=receive) row | FR-009, FR-011 |
| 4 | Every StockMovement row records actor_id and created_at | NFR-007 |
| 5 | Waste/adjust entries require a reason field | FR-009 |

---

## Evaluation & Acceptance

### Success Criteria (observable, pass/fail)

| # | Given (input/state) | Expect (output/behavior) | How it's checked |
|---|---------------------|--------------------------|------------------|
| 1 | Chef POSTs new Ingredient | 201, row created | automated test |
| 2 | Staff PATCHes an Ingredient | 403 | automated test |
| 3 | Chef POSTs a stock receipt (qty, expiry, location) | StockBatch + StockMovement(receive) created atomically | automated test |
| 4 | Two concurrent StockMovement writes to same Ingredient | Both persist, no lost update | automated test with parallel requests |

### Verification Command (exact, runnable)

```bash
npm --prefix apps/api run test -- inventory
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

Ingredient, StockBatch, StockMovement as NestJS modules under `/apps/api/src/inventory`, all Kitchen-scoped, all writes gated by T002's `RolesGuard` (`@Roles('owner','admin','chef')` for writes, all roles for reads). StockMovement is append-only — no update/delete endpoint, only insert. Stock receipt is a single transactional operation creating both the StockBatch and the StockMovement row.

---

## Edge Case Checklist

- [ ] Negative qty on an adjust movement is rejected
- [ ] StockBatch with expiry_date in the past at entry time is accepted but flagged (data-entry error, not blocked — chefs sometimes log historical batches)
- [ ] Concurrent StockMovement writes to the same Ingredient do not lose an update (DB transaction, not read-modify-write in app code)

---

## Files to Change (Predicted)

| File | Change |
|------|--------|
| `/apps/api/src/inventory/**` | Ingredient, StockBatch, StockMovement modules |

## Files Must NOT Touch

| File | Reason |
|------|--------|
| `/apps/api/src/recipes` | Doesn't exist yet — T005 depends on this module, not vice versa |

---

## Test Plan

Automated tests for CRUD + RBAC + concurrent-write safety on StockMovement.

---

## Completion Checklist

- [ ] Implementation done
- [ ] Self-review: `Skill({ skill: "code-review" })` run
- [ ] Security review: N/A unless flagged in review (Medium risk — judgment call at review time)
- [ ] Lint passes
- [ ] Tests written AND pass — output pasted into Evidence table
- [ ] `Skill({ skill: "verify" })` run
- [ ] `memory/MEMORY.md` updated
- [ ] Supervisor notified: task ready for Stage 4 review
