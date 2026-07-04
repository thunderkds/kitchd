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
| **New test(s) cover Acceptance Criteria (file paths pasted)** | ☐ pass / ☐ fail | |
| Verification command run | ☐ pass / ☐ fail | |
| Negative cases hold | ☐ pass / ☐ fail | |
| verify | ☐ pass / ☐ fail | |
| Review scope bounded to blast radius | ☐ pass / ☐ fail | |
| Full smoke suite still green | ☐ pass / ☐ fail | |
| UI: Visual regression | ☐ N/A — export button only, minimal UI surface | |
| UI: Design-system compliance | ☐ N/A | |
| UI: Responsiveness | ☐ N/A | |

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

- [ ] Implementation done
- [ ] Self-review: `Skill({ skill: "code-review" })` run
- [ ] Security review: N/A (Low risk)
- [ ] Lint passes
- [ ] Tests written AND pass — output pasted into Evidence table
- [ ] `Skill({ skill: "verify" })` run
- [ ] `memory/MEMORY.md` updated
- [ ] Supervisor notified: task ready for Stage 4 review
