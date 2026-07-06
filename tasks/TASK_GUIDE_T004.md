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
| **New test(s) cover Acceptance Criteria (file paths pasted)** | ☒ pass | `apps/api/src/inventory/inventory.e2e.spec.ts` — 13 tests covering AC1-5 + edge cases (create/edit Ingredient, Staff 403 on write, receive-stock atomic Batch+Movement, actor_id/created_at present, waste/adjust reason required, negative qty rejected, append-only (no PATCH/DELETE route), cross-tenant 404, concurrent writes both persist) |
| Verification command run | ☒ pass | `npm --prefix apps/api run test -- inventory` → `Test Suites: 1 passed, 1 total` / `Tests: 13 passed, 13 total` |
| Negative cases hold | ☒ pass | Staff 403 on create/edit; WASTE/ADJUST without reason → 400; negative qty on ADJUST → 400; cross-tenant GET/PATCH → 404; PATCH/DELETE on a movement → 404 (route doesn't exist) |
| verify | ☒ pass | Supervisor-driven independent live verify (2026-07-03), real Postgres, port 3000: signup→POST /ingredients 201, POST /ingredients/:id/stock/receive 201 (batch+movement rows atomic), GET .../stock/movements listed. Probes: 🔍 cross-tenant GET on another org's ingredient → 404; 🔍 WASTE without `reason` → 400 `"reason must be a string"`; 🔍 negative qty on receive → 400 `"qty must be a positive number"`; 🔍 PATCH on stock/movements/:id → 404 (route doesn't exist, true append-only). All held — PASS. Full session archived at `reports/evidence/T004/verify-api-session.txt` (includes post-merge 45/45 regression run). |
| Review scope bounded to blast radius | ☒ pass | Change confined to new `/apps/api/src/inventory/**` module + additive Prisma migration + one-line registration in `app.module.ts`; no existing files' logic modified |
| Full smoke suite still green | ☒ pass | `npm --prefix apps/api run test` → `Test Suites: 7 passed, 7 total` / `Tests: 45 passed, 45 total` |
| UI: Visual regression | ☒ N/A — pure backend task | |
| UI: Design-system compliance | ☒ N/A — pure backend task | |
| UI: Responsiveness | ☒ N/A — pure backend task | |

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

- [x] Implementation done
- [x] Self-review: `Skill({ skill: "code-review" })` run — 0 P0/P1/P2/P3 findings
- [x] Security review: `Skill({ skill: "security-review" })` run — no HIGH/MEDIUM findings
- [x] Migration safety: GO (purely additive, reversible, zero-downtime)
- [x] Lint passes
- [x] Tests written AND pass — output pasted into Evidence table
- [x] `verify` — Supervisor-driven independent live run against a running server (documented in Evidence table)
- [ ] `memory/MEMORY.md` updated — Supervisor-only write, pending Stage 5 diff-driven pass
- [x] Supervisor notified: task ready for Stage 4 review
