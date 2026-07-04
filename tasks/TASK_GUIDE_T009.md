# TASK_GUIDE — T009: Generate task from recipe/guideline (checklist from steps)
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

Let a Recipe or Guideline spawn a ready-to-work Task.

**Restated intent**:
> Clicking "Generate Prep Task" on a Recipe or Guideline creates a new Task whose checklist_items mirror that Recipe/Guideline's steps 1:1, with source_recipe_id set when generated from a Recipe.

**Out of scope**:
- Recurrence (T010)
- Stock deduction on completion (T011)

**Requirement Refs**:
- FR-005: generate Task with checklist from Recipe/Guideline steps
- US-003

### Requirement Fidelity Gate

- [x] Restated intent confirmed
- [x] Domain terms align with `memory/glossary.md`
- [x] Every Acceptance Criterion traces to the Requirement
- [x] Requirement Refs covered by Acceptance Criteria

---

## Acceptance Criteria

| # | Criterion (testable) | Traces to requirement |
|---|----------------------|-----------------------|
| 1 | Generating from a Recipe with 5 steps creates a Task with 5 checklist_items matching those steps verbatim | FR-005 |
| 2 | source_recipe_id is set correctly on the generated Task | FR-005 |
| 3 | Generating from a Guideline works the same way, without source_recipe_id (or with a source_guideline_id, pick one and document) | FR-005 |

---

## Evaluation & Acceptance

### Success Criteria (observable, pass/fail)

| # | Given (input/state) | Expect (output/behavior) | How it's checked |
|---|---------------------|--------------------------|------------------|
| 1 | POST /recipes/:id/generate-task | New Task created with matching checklist | automated test |
| 2 | Recipe edited/versioned after a Task was generated from it | Generated Task's checklist snapshot is unchanged | automated test |

### Verification Command (exact, runnable)

```bash
npm --prefix apps/api run test -- generate-task
```

> **Evidence is a required document, not a formality.** A task is not Done until every row below is filled with real, pasted output — not just checked. The `verify` row's Notes cell must contain the literal word "pass" (case-insensitive) for the pipeline gate hook to allow merge; use a bare `| verify |` first cell (no backticks) or the hook's regex won't match. See `memory/learnings.md` (2026-07-03/2026-07-04 entries) for the exact gotcha history.

### Evidence (filled by reviewer at Stage 4/5)

| Check | Result | Notes / output snippet |
|-------|--------|------------------------|
| **New test(s) cover Acceptance Criteria (file paths pasted)** | ☐ pass / ☐ fail | |
| Verification command run | ☐ pass / ☐ fail | |
| Negative cases hold | ☐ pass / ☐ fail | |
| verify | ☐ pass / ☐ fail | |
| Review scope bounded to blast radius | ☐ pass / ☐ fail | |
| Full smoke suite still green | ☐ pass / ☐ fail | |
| UI: Visual regression | ☐ N/A — pure backend task (button lives on existing Recipe/Guideline screens) | |
| UI: Design-system compliance | ☐ N/A | |
| UI: Responsiveness | ☐ N/A | |

---

## Approach

New endpoint under `/apps/api/src/tasks/generate-from-recipe` (covers both Recipe and Guideline source) that snapshots the steps array into `checklist_items` at generation time — not a live reference — per the edge case below.

---

## Edge Case Checklist

- [ ] Recipe edited/versioned after a Task was generated from it: the generated Task keeps its own checklist snapshot and does NOT retroactively change (explicitly document this as chosen MVP behavior)

---

## Files to Change (Predicted)

| File | Change |
|------|--------|
| `/apps/api/src/tasks/generate-from-recipe/**` | New generation endpoint |

## Files Must NOT Touch

| File | Reason |
|------|--------|
| `/apps/api/src/recipes`, `/apps/api/src/guidelines` | Read-only dependency |

---

## Test Plan

Automated tests for checklist snapshotting and source_recipe_id linkage, including the version-drift edge case.

---

## Completion Checklist

- [ ] Implementation done
- [ ] Self-review: `Skill({ skill: "code-review" })` run
- [ ] Security review: N/A (Low risk)
- [ ] Lint passes
- [ ] Tests written AND pass — output pasted into Evidence table
- [ ] `Skill({ skill: "verify" })` run
- [ ] `memory/MEMORY.md` updated
- [ ] Supervisor notified: task ready for Stage 4 review
