# TASK_GUIDE — T007: Low-stock threshold flag + dashboard widget
**Date**: 2026-07-02
**Complexity Level**: C1
**Risk Level**: Low
**Priority**: P1
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

Surface which ingredients are low on stock or expiring soon.

**Restated intent**:
> An endpoint returns Ingredients below their min_threshold and StockBatches expiring soon, plus a minimal widget component T018's Dashboard will compose.

**Out of scope**:
- Full Dashboard page assembly (T018)
- Notification creation on threshold crossing (T016)

**Requirement Refs**:
- FR-010: low-stock flag on dashboard
- FR-011: expiring-soon flag
- US-006

### Requirement Fidelity Gate

- [x] Restated intent confirmed
- [x] Domain terms align with `memory/glossary.md`
- [x] Every Acceptance Criterion traces to the Requirement
- [x] Requirement Refs covered by Acceptance Criteria

---

## Acceptance Criteria

| # | Criterion (testable) | Traces to requirement |
|---|----------------------|-----------------------|
| 1 | An Ingredient with stock below min_threshold appears in the low-stock endpoint response | FR-010 |
| 2 | An Ingredient at or above min_threshold does not appear | FR-010 |
| 3 | A StockBatch expiring within N days (configurable, default 3) appears in the expiring-soon response | FR-011 |

---

## Evaluation & Acceptance

### Success Criteria (observable, pass/fail)

| # | Given (input/state) | Expect (output/behavior) | How it's checked |
|---|---------------------|--------------------------|------------------|
| 1 | Ingredient stock = 2, min_threshold = 5 | Appears in GET /inventory/alerts/low-stock | automated test |
| 2 | Ingredient stock = 10, min_threshold = 5 | Does not appear | automated test |
| 3 | StockBatch expiry_date = today+2 | Appears in GET /inventory/alerts/expiring | automated test |

### Verification Command (exact, runnable)

```bash
npm --prefix apps/api run test -- inventory-alerts
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
| **UI: Visual regression** | ☐ pass / ☐ fail | widget screenshot |
| **UI: Design-system compliance** | ☐ pass / ☐ fail | |
| **UI: Responsiveness** | ☐ pass / ☐ fail | widget at mobile width |

---

## UI / Design Acceptance Criteria

### 1. Visual Regression

| Screen / Component | Verification method | Expected result |
|-------------------|---------------------|-----------------|
| LowStockWidget | MCP screenshot (Playwright MCP) | Shows list of below-threshold ingredients, empty state when none |

### 2. Design-System Compliance

| Criterion | Verification method | Expected result |
|-----------|---------------------|-----------------|
| Colors match design tokens | CSS audit | Amber/red warning color for low-stock rows |
| Typography matches spec | Computed style | Consistent with T003 shell typography |
| Spacing/layout matches spec | Computed style | Fits within Dashboard grid cell |

### 3. Layout / Responsiveness

| Viewport | Verification method | Expected result |
|----------|---------------------|-----------------|
| Mobile (320–480px) | MCP screenshot (Playwright MCP) | Widget stacks full-width, no overflow |
| Tablet (768px) | MCP screenshot (Playwright MCP) | Widget in grid cell |
| Desktop (1024px+) | MCP screenshot (Playwright MCP) | Widget in grid cell |

---

## Approach

Read-only query endpoints under `/apps/api/src/inventory/alerts`, computed from T004's Ingredient/StockBatch tables (no new schema). Frontend `LowStockWidget` component consumes these endpoints; full Dashboard composition happens in T018.

---

## Edge Case Checklist

- [ ] Ingredient with min_threshold = 0 never flags (division/comparison edge case)
- [ ] StockBatch with null expiry_date is excluded from expiring-soon, not crashed on

---

## Files to Change (Predicted)

| File | Change |
|------|--------|
| `/apps/api/src/inventory/alerts/**` | Low-stock + expiring-soon endpoints |
| `/apps/web/src/components/LowStockWidget/**` | Widget component |

## Files Must NOT Touch

| File | Reason |
|------|--------|
| `/apps/web/src/pages/Dashboard` | Doesn't exist yet — T018's scope |

---

## Test Plan

Automated tests for threshold boundary conditions; manual widget render check.

---

## Completion Checklist

- [ ] Implementation done
- [ ] Self-review: `Skill({ skill: "code-review" })` run
- [ ] Security review: N/A (Low risk)
- [ ] Lint passes
- [ ] Tests written AND pass — output pasted into Evidence table
- [ ] `Skill({ skill: "verify" })` run
- [ ] `memory/MEMORY.md` updated (if new patterns)
- [ ] Supervisor notified: task ready for Stage 4 review
