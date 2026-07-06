# TASK_GUIDE — T008: Task CRUD + kanban board + list/calendar toggle
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

Build the core prep/task management flow: CRUD, kanban, and list/calendar views.

**Restated intent**:
> A Chef can create a daily prep task list and assign it to staff; staff can check items off on a tablet; both kanban and list views show the same underlying Task data.

**Out of scope**:
- Generating a Task from a Recipe/Guideline (T009)
- Recurrence (T010)
- Stock deduction on completion (T011)
- Realtime push (T017)

**Requirement Refs**:
- FR-004: Task CRUD with status/assignee/due/recurrence field (recurrence logic itself is T010)
- FR-006: kanban + list/calendar views
- FR-007: touch-friendly completion
- US-003, US-004, US-011

### Requirement Fidelity Gate

- [x] Restated intent confirmed
- [x] Domain terms align with `memory/glossary.md` (Task)
- [x] Every Acceptance Criterion traces to the Requirement
- [x] Requirement Refs covered by Acceptance Criteria

---

## Acceptance Criteria

| # | Criterion (testable) | Traces to requirement |
|---|----------------------|-----------------------|
| 1 | Dragging a Task card between kanban columns updates its status | FR-006 |
| 2 | A Staff user can check off their own Task's checklist items on a touch-sized target | FR-007, US-004 |
| 3 | Task list view shows the same data as kanban; toggle preserves filters | FR-006 |
| 4 | Staff cannot reassign a Task to someone else | FR-018 |
| 5 | Chef+ can assign a Task to any Kitchen member | US-003 |

---

## Evaluation & Acceptance

### Success Criteria (observable, pass/fail)

| # | Given (input/state) | Expect (output/behavior) | How it's checked |
|---|---------------------|--------------------------|------------------|
| 1 | Drag Task from "To Do" to "In Progress" | PATCH updates status, UI reflects it | E2E test |
| 2 | Staff taps a checklist item on their own Task | Item toggles complete | E2E test |
| 3 | Staff PATCHes assignee_id on a Task not their own | 403 | automated test |
| 4 | Toggle list ↔ kanban with an active filter set | Filter persists across toggle | E2E test |

### Verification Command (exact, runnable)

```bash
npm --prefix apps/api run test -- tasks && npm --prefix apps/web run test -- tasks
```

### Evidence (filled by reviewer at Stage 4/5)

| Check | Result | Notes / output snippet |
|-------|--------|------------------------|
| **New test(s) cover Acceptance Criteria (file paths pasted)** | ☒ pass | `apps/api/src/tasks/tasks.e2e.spec.ts` (8 tests: AC5 create+assign, AC1 status PATCH, AC2 staff checklist toggle, AC3 staff-reassign-403, cross-tenant 404, staff-create-403, staff-update-other's-task-403, list-share-data) + `apps/web/src/features/tasks/TasksPage.test.tsx` (4 tests: 3-column kanban render, AC1 tap-to-move PATCH, AC3 filter preserved across kanban↔list toggle, AC2 checklist checkbox PATCH). All 12 pass. |
| Verification command run | ☒ pass | `npm --prefix apps/api run test -- tasks` → 8/8 pass (3.2s); `npm --prefix apps/web run test -- tasks` → 4/4 pass (0.9s) |
| Negative cases hold | ☒ pass | Staff reassign → 403; Staff PATCH on non-own Task → 403; Staff POST /tasks → 403; cross-kitchen GET/PATCH → 404 (not 403, per RolesGuard convention) |
| verify | ☒ pass | Live API+UI session 2026-07-04: signup owner, invite+accept STAFF, create Task w/ checklist+assignee, staff PATCH status TODO→IN_PROGRESS (200), staff PATCH checklistItems done:true (200), staff PATCH assigneeId → 403 Forbidden, cross-tenant GET by 2nd org owner → 404. Browser: login→/tasks kanban render, tap-to-move click, list↔kanban toggle with view/assignee both persisted in URL. See reports/evidence/T008/verify-api-session.txt + session-b0129cca-9782-4097-a651-3d0a6588f15c files + 6 screenshots — PASS.
| Review scope bounded to blast radius | ☒ pass | New `apps/api/src/tasks/**` module + `apps/web/src/features/tasks/**` feature, plumbing-only edits to `app.module.ts` (register TasksModule) and `App.tsx` (register /tasks route) — no other module touched |
| Full smoke suite still green | ☒ pass | Backend: `npm --prefix apps/api run test` → 61/61 pass (9 suites). Frontend: `npm --prefix apps/web run test` → 19/19 pass (4 files). Re-confirmed independently by Supervisor 2026-07-04. |
| **UI: Visual regression** | ☒ pass | Playwright MCP screenshots: kanban 3-column board with task card + tap-to-move buttons (`reports/evidence/T008/screenshot-1783154850239.png`), post tap-to-move state (`...-1783154855901.png`), list view (`...-1783154866665.png`) |
| **UI: Design-system compliance** | ☒ pass | Tap-to-move buttons use `min-h-[44px] min-w-[44px]` (mobile touch-target guideline); status colors: TODO=gray, IN_PROGRESS=amber, DONE=green column border, consistent with T003 shell tokens |
| **UI: Responsiveness** | ☒ pass | `ui_assert` against live DOM: `overflow-x-auto` container present (assertion passed); all "Move to" buttons ≥44px height (assertion passed). Full resize-viewport screenshot not available (MCP toolset has no viewport-control primitive) — verified via DOM/CSS assertion instead of visual capture at each breakpoint. |

---

## UI / Design Acceptance Criteria

### 1. Visual Regression

| Screen / Component | Verification method | Expected result |
|-------------------|---------------------|-----------------|
| Kanban board | MCP screenshot (Playwright MCP) | 3 columns (To Do/In Progress/Done), cards render title+assignee |
| List/checklist view | MCP screenshot (Playwright MCP) | Same Tasks as kanban, flat list with checkboxes |

### 2. Design-System Compliance

| Criterion | Verification method | Expected result |
|-----------|---------------------|-----------------|
| Colors match design tokens | CSS audit | Status colors consistent (e.g. amber=in-progress, green=done) |
| Typography matches spec | Computed style | Consistent with T003 shell |
| Spacing / layout matches spec | Computed style | Card padding/touch-target ≥ 44px per mobile guidelines |

### 3. Layout / Responsiveness

| Viewport | Verification method | Expected result |
|----------|---------------------|-----------------|
| Mobile (320–480px) | MCP screenshot (Playwright MCP) + manual | Kanban columns scroll horizontally within the board (not page-level); tap-to-move fallback works |
| Tablet (768px) | MCP screenshot (Playwright MCP) | Kanban columns visible side by side or scrollable |
| Desktop (1024px+) | MCP screenshot (Playwright MCP) | Full kanban board visible |

---

## Approach

Task module under `/apps/api/src/tasks` (Kitchen-scoped, RBAC-gated per T002). Frontend kanban via dnd-kit with drag between status columns; list view as a flat filterable table; toggle preserves shared filter/query state (e.g. via URL params or shared store). Tap-to-move fallback for touch devices where drag is unreliable.

---

## Edge Case Checklist

- [x] Staff attempting to reassign a Task to someone else is blocked server-side, not just hidden client-side
- [x] Drag-and-drop on a touch device has a tap-to-move fallback (not drag-only)

---

## Files to Change (Predicted)

| File | Change |
|------|--------|
| `/apps/api/src/tasks/**` | Task module (CRUD only — no generate/recurrence/deduction yet) |
| `/apps/web/src/features/tasks/**` | Kanban board, list view, toggle |

## Files Must NOT Touch

| File | Reason |
|------|--------|
| `/apps/api/src/tasks/generate-from-recipe`, `recurrence`, `complete` | Belong to T009/T010/T011 — do not preemptively build |

---

## Test Plan

Automated backend CRUD+RBAC tests; frontend E2E for drag-drop and checklist toggling; manual tap-to-move check on a touch emulator.

---

## Completion Checklist

- [x] Implementation done
- [ ] Self-review: `Skill({ skill: "code-review" })` run *(Supervisor Stage 4)*
- [ ] Security review: pending Supervisor Stage 4 (Medium risk)
- [x] Lint passes
- [x] Tests written AND pass — output pasted into Evidence table
- [ ] `Skill({ skill: "verify" })` run *(Supervisor Stage 5)*
- [ ] `memory/MEMORY.md` updated *(Supervisor-only write)*
- [x] Supervisor notified: task ready for Stage 4 review
