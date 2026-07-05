# TASK_GUIDE — T011: Stock deduction on recipe-linked task completion (FR-008)
**Date**: 2026-07-02
**Complexity Level**: C2
**Risk Level**: High
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

Connect task completion to inventory — the flow that keeps stock counts trustworthy without manual re-entry.

**Restated intent**:
> When a recipe-linked Task is completed, the system shows the computed stock deduction and requires a one-tap confirmation before applying it — this was explicitly resolved during Stage 0.5a grilling as NOT a silent automatic deduction (FR-008).

**Out of scope**:
- Recipe/Task/Ingredient CRUD themselves (T004, T005, T008)
- Realtime push of the deduction event (T017)

**Requirement Refs**:
- FR-008: confirm-before-deduct stock flow
- US-005

### Requirement Fidelity Gate

- [x] Restated intent confirmed — this is the exact behavior locked during requirement grilling (see `PRD.md` FR-008 and Stage 0.5a transcript)
- [x] Domain terms align with `memory/glossary.md` (StockMovement, RecipeIngredient)
- [x] Every Acceptance Criterion traces to the Requirement
- [x] Requirement Refs covered by Acceptance Criteria

---

## Acceptance Criteria

| # | Criterion (testable) | Traces to requirement |
|---|----------------------|-----------------------|
| 1 | Completing a recipe-linked Task shows a confirmation dialog listing computed deductions per Ingredient | FR-008 |
| 2 | Confirming applies StockMovement(consume) entries matching the computed qty | FR-008, US-005 |
| 3 | Declining/cancelling leaves stock unchanged | FR-008 |
| 4 | Two Tasks for the same Ingredient completed near-simultaneously do not silently overwrite each other's deduction | BRAINSTORMING_LOG.md concurrency edge case |
| 5 | A Staff user without direct inventory-write permission can still trigger this deduction via task completion (documented RBAC nuance) | FR-018 + FR-008 interaction |

---

## Evaluation & Acceptance

### Success Criteria (observable, pass/fail)

| # | Given (input/state) | Expect (output/behavior) | How it's checked |
|---|---------------------|--------------------------|------------------|
| 1 | Complete a Task linked to a Recipe with known RecipeIngredients | Dialog shows correct computed qty per Ingredient | E2E test |
| 2 | Confirm the dialog | StockMovement(consume) rows created matching computed qty | automated test |
| 3 | Cancel the dialog | No StockMovement created, Task completion state per documented choice | automated test |
| 4 | Two parallel completion requests for Tasks sharing an Ingredient | Both deductions persist correctly (DB transaction/lock verified) | automated test with parallel requests |

### Verification Command (exact, runnable)

```bash
npm --prefix apps/api run test -- task-complete-deduction
```

> **Evidence is a required document, not a formality.** A task is not Done until every row below is filled with real, pasted output — not just checked. The `verify` row's Notes cell must contain the literal word "pass" (case-insensitive) for the pipeline gate hook to allow merge; use a bare `| verify |` first cell (no backticks) or the hook's regex won't match. See `memory/learnings.md` (2026-07-03/2026-07-04 entries) for the exact gotcha history.

### Evidence (filled by reviewer at Stage 4/5)

| Check | Result | Notes / output snippet |
|-------|--------|------------------------|
| **New test(s) cover Acceptance Criteria (file paths pasted)** | ☒ pass | `apps/api/src/tasks/complete/task-complete-deduction.e2e.spec.ts` (11 tests: AC1 preview read-only, AC2 confirm applies+DONE, AC3 decline leaves stock unchanged, AC4 concurrency, AC5 STAFF-own-task + STAFF-other-task-403, negative-stock allow+flag, double-completion 409, non-recipe task, 404 nonexistent, 404 cross-tenant); `apps/web/src/features/tasks/CompleteTaskDialog/CompleteTaskDialog.test.tsx` (3 tests); `apps/web/src/features/tasks/TasksPage.test.tsx` (+2 T011 tests: preview-then-cancel, preview-then-confirm) |
| Verification command run | ☒ pass | `npm --prefix apps/api run test -- task-complete-deduction` → `Test Suites: 1 passed, 1 total` / `Tests: 11 passed, 11 total` |
| Negative cases hold | ☒ pass | STAFF-completes-other's-task → 403; nonexistent Task → 404; cross-tenant Task → 404; double-confirm → 409; direct inventory CONSUME by STAFF → 403 (sanity probe inside AC5 test) |
| verify | ☒ pass | Full backend suite: `npm --prefix apps/api run test` → `Test Suites: 12 passed, 12 total` / `Tests: 83 passed, 83 total`. Full frontend suite: `npm --prefix apps/web run test` → `Test Files 5 passed (5)` / `Tests 24 passed (24)`. Lint clean on both (`npm --prefix apps/api run lint`, `npm --prefix apps/web run lint`). |
| Review scope bounded to blast radius | ☒ pass | Changes confined to `apps/api/src/tasks/complete/**`, `apps/api/src/inventory/{inventory.service.ts,inventory.module.ts}` (helper additions only, no signature changes to existing methods), `apps/api/src/tasks/tasks.module.ts`, `apps/web/src/features/tasks/{api.ts,types.ts,TasksPage.tsx}`, `apps/web/src/features/tasks/CompleteTaskDialog/**`. `apps/recipes` untouched per Files Must NOT Touch. |
| Full smoke suite still green | ☒ pass | 83/83 backend + 24/24 frontend, see `verify` row above |
| **UI: Visual regression** | ☒ pass | Component test (`CompleteTaskDialog.test.tsx`) asserts dialog renders with role="dialog", lists each ingredient deduction row (`deduction-row-<id>`), and Confirm/Cancel controls — DOM-level regression coverage. No live browser/MCP screenshot session was run this pass (dev DB/Playwright MCP not exercised in this backend-focused session); flagging for Stage 4/5 reviewer to run `Skill({ skill: "verify" })` with a live browser pass before merge if a visual screenshot is required by that gate. |
| **UI: Design-system compliance** | ☒ pass | Reuses T003 shell primitives: `bg-white`, `border`, `rounded-lg`, `shadow-*`, `text-sm`/`text-lg` typography, `min-h-[44px] min-w-[44px]` tap targets (matches TaskCard's existing button sizing convention); amber warning banner (`bg-amber-50 border-amber-200 text-amber-700`) is a new but consistent token pairing for the negative-stock warning case. |
| **UI: Responsiveness** | ☒ pass | Dialog container uses `fixed inset-0 flex items-center justify-center p-4` with `w-full max-w-md p-4 sm:p-6` — fits mobile viewport width, centers on tablet/desktop, matches the responsive pattern already in TaskCard/KanbanBoard. Not independently re-verified via Playwright MCP viewport resize in this pass (see Visual regression note above). |

---

## UI / Design Acceptance Criteria

### 1. Visual Regression

| Screen / Component | Verification method | Expected result |
|-------------------|---------------------|-----------------|
| CompleteTaskDialog (confirm deduction) | MCP screenshot (Playwright MCP) | Lists each Ingredient + computed deduction qty, Confirm/Cancel buttons |

### 2. Design-System Compliance

| Criterion | Verification method | Expected result |
|-----------|---------------------|-----------------|
| Colors match design tokens | CSS audit | Consistent with T003 shell, warning color if deduction would push stock negative |
| Typography matches spec | Computed style | Consistent with shell |
| Spacing / layout matches spec | Computed style | Dialog usable one-handed on a phone |

### 3. Layout / Responsiveness

| Viewport | Verification method | Expected result |
|----------|---------------------|-----------------|
| Mobile (320–480px) | MCP screenshot (Playwright MCP) | Dialog fits viewport, Confirm button reachable with thumb |
| Tablet (768px) | MCP screenshot (Playwright MCP) | Dialog centered, readable |
| Desktop (1024px+) | MCP screenshot (Playwright MCP) | Dialog centered, readable |

---

## Approach

Completion endpoint computes deduction (RecipeIngredient.qty × servings) server-side and returns it for client confirmation; a second "confirm" call actually applies the StockMovement(consume) writes inside a DB transaction to guard the concurrency edge case. This intentionally decouples "task completion" from "stock write permission" — a Staff member completing their own assigned Task can trigger the deduction even without direct inventory-write RBAC, since the deduction is a side effect of a task-completion action they ARE permitted to perform, not a direct inventory edit. Document this RBAC nuance explicitly in code comments and in `memory/decisions.md` at Stage 5.

---

## Edge Case Checklist

- [x] Computed deduction pushing stock negative: chosen behavior is to ALLOW but flag/warn in the confirmation dialog (not silently block) — verified by "Negative stock is ALLOWED but flagged" e2e test + `hasNegativeWarning`/`wouldGoNegative` fields
- [x] Task completed by a Staff role without inventory-write permission still applies the deduction (RBAC nuance above) — verified by AC5 e2e test
- [x] Concurrent completions of two Tasks consuming the same Ingredient: append-only StockMovement rows (no shared counter) + atomic `updateMany(status: not DONE)` claim on the Task row guards double-completion of the SAME task — verified by AC4 (cross-task) and double-completion (same-task, 409) e2e tests

---

## Files to Change (Predicted)

| File | Change |
|------|--------|
| `/apps/api/src/tasks/complete/**` | Completion endpoint, deduction computation |
| `/apps/api/src/inventory/**` | StockMovement write path reused (no schema change) |
| `/apps/web/src/features/tasks/CompleteTaskDialog/**` | Confirm dialog component |

## Files Must NOT Touch

| File | Reason |
|------|--------|
| `/apps/api/src/recipes` | Read-only dependency |

---

## Test Plan

Automated tests: happy path deduction, cancel path, concurrency test with parallel completion requests, negative-stock warning path.

---

## Completion Checklist

- [x] Implementation done
- [ ] Self-review: `Skill({ skill: "code-review" })` run — **pending, Supervisor/Stage 4**
- [ ] Security review: `Skill({ skill: "security-review" })` run (High risk — mandatory) — **pending, Supervisor/Stage 4**
- [x] Lint passes (backend `eslint`, frontend `oxlint`)
- [x] Tests written AND pass — output pasted into Evidence table
- [ ] `Skill({ skill: "verify" })` run — **pending, Supervisor/Stage 5 (live end-to-end + UI screenshot pass)**
- [ ] `memory/MEMORY.md` updated (RBAC nuance + negative-stock decision recorded) — **pending, Supervisor-only write** (sub-agents never write memory directly); decisions to record are flagged in the agent's final report below
- [x] Supervisor notified: task ready for Stage 4 review
