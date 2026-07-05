# TASK_GUIDE — T019: RBAC enforcement audit across all CRUD
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

Note: per CLAUDE.md Hard-Stop Gate 2, any task whose scope resembles "test coverage" / structural verification starts at a C2/Medium floor at minimum — this task is already C2/High given its security-sensitivity, so the floor is exceeded, not just met.

---

## Requirement (Pillar 1 — Adapt the requirement)

Close the loop on RBAC: verify every module built in T004–T015 actually enforces roles correctly, including the previously-unexercised Viewer role.

**Restated intent**:
> Every CRUD endpoint across Inventory, Recipes, Guidelines, Tasks is verified against the 4-role matrix (Owner/Admin, Chef, Staff, Viewer), with automated tests proving each cell, and zero ad-hoc permission checks outside `RolesGuard`.

**Scope correction (2026-07-05, Supervisor)**: The original scope listed 8 modules including Notes, Announcements, ShiftLogs, Comments — those are T012–T015, still Todo, and don't exist in the codebase yet. Same task-numbering-isn't-a-dependency-graph gap previously hit on T009/T006 (see `memory/learnings.md`). Per user decision, this pass covers only the 4 modules that exist today (Inventory, Recipes, Guidelines, Tasks). A follow-up RBAC audit pass covering Notes/Announcements/ShiftLog/Comments is required once T012–T015 land — track as a new task at that time, do not silently consider T019 fully closing FR-018 forever.

**Out of scope**:
- Building any new feature — this is a verification-and-fix pass on existing modules only
- Notes/Announcements/ShiftLogs/Comments RBAC (modules don't exist yet — T012-T015)

**Requirement Refs**:
- FR-018, US-010

### Requirement Fidelity Gate

- [x] Restated intent confirmed
- [x] Domain terms align with `memory/glossary.md`
- [x] Every Acceptance Criterion traces to the Requirement
- [x] Requirement Refs covered by Acceptance Criteria

---

## Acceptance Criteria

| # | Criterion (testable) | Traces to requirement |
|---|----------------------|-----------------------|
| 1 | A written audit matrix (endpoint × role × expected access) exists for every entity module | FR-018 |
| 2 | A passing automated test asserts each matrix cell | FR-018, US-010 |
| 3 | Zero endpoints found using inline permission checks instead of `RolesGuard` (grep-verified) | FR-018 |
| 4 | Viewer role is confirmed read-only on every module | FR-018 |

---

## Evaluation & Acceptance

### Success Criteria (observable, pass/fail)

| # | Given (input/state) | Expect (output/behavior) | How it's checked |
|---|---------------------|--------------------------|------------------|
| 1 | Viewer JWT calls a write endpoint on any of the 8 modules | 403 on all of them | automated test suite, one per module |
| 2 | `grep -rn "req.user.role ===" apps/api/src` (or equivalent pattern) | No matches outside `roles.guard.ts` | manual grep, pasted in evidence |
| 3 | Audit matrix reviewed against `PRD.md` FR-018's role list | Matches exactly (Owner/Admin, Chef, Staff, Viewer) | manual review |

### Verification Command (exact, runnable)

```bash
npm --prefix apps/api run test -- rbac-audit
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
| UI: Visual regression | ☐ N/A — backend audit task | |
| UI: Design-system compliance | ☐ N/A | |
| UI: Responsiveness | ☐ N/A | |

---

## Approach

Build a matrix test file iterating every (module, role) pair against every CRUD verb, asserting expected 200/403. Grep the codebase for any permission check not going through `RolesGuard`/`@Roles()`. Fix any gap found in the underlying module directly (this task can touch T004–T015's files to fix RBAC gaps, but must not add new features while doing so — surgical fixes only).

---

## Edge Case Checklist

- [ ] A route that's technically read-only but wasn't obviously "permission-sensitive" (e.g. a search endpoint) is checked for cross-Kitchen data leakage, not just role gating
- [ ] Viewer role, never explicitly exercised in T004–T015's per-task tests, is now covered everywhere

---

## Files to Change (Predicted)

| File | Change |
|------|--------|
| `/apps/api/src/**/*.controller.ts` | Audit + surgical RBAC fixes only |
| `/apps/api/test/rbac/**` | New matrix test suite |

## Files Must NOT Touch

| File | Reason |
|------|--------|
| Any file outside RBAC-check logic | This task fixes permission gaps only, not features/business logic |

---

## Test Plan

Full matrix test suite (module × role × verb); manual grep verification pasted into evidence.

---

## Completion Checklist

- [ ] Implementation done
- [ ] Self-review: `Skill({ skill: "code-review" })` run
- [ ] Security review: `Skill({ skill: "security-review" })` run (High risk — mandatory)
- [ ] Lint passes
- [ ] Tests written AND pass — output pasted into Evidence table
- [ ] `Skill({ skill: "verify" })` run
- [ ] `memory/MEMORY.md` updated (any RBAC gaps found + fixed, recorded as a learning)
- [ ] Supervisor notified: task ready for Stage 4 review
