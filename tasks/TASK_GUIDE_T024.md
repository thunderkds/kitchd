# TASK_GUIDE — T024: RBAC enforcement audit — Notes, Announcements, ShiftLog, Comments
**Date**: 2026-07-06
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

Note: per CLAUDE.md Hard-Stop Gate 2, any task resembling "RBAC audit"/"test coverage" starts at a C2/Medium floor at minimum — this task is already C2/High given its security-sensitivity, so the floor is exceeded, not just met.

---

## Requirement (Pillar 1 — Adapt the requirement)

Close the RBAC audit gap deliberately deferred by T019: verify Notes, Announcements, ShiftLog, and Comments each correctly enforce their own distinct RBAC shape, including the Viewer role.

**Restated intent**:
> Every write/read endpoint across Notes, Announcements, ShiftLog, and Comments is verified against the 4-role matrix (Owner/Admin, Chef, Staff, Viewer), with automated tests proving each cell, and zero ad-hoc permission checks outside `RolesGuard`. Each module's RBAC shape is checked against its own PRD line — not assumed to match a prior module's shape.

**Context (why this is a distinct audit, not a T019 rerun)**: this codebase has at least three *different* RBAC shapes already established, and each module's audit must confirm its own:
- Inventory/Recipes/Guidelines: `WRITE_ROLES` = Owner/Admin/Chef only
- Notes: every role except Viewer may author; only the author may edit/pin/delete (FR-018 explicitly grants Staff note-authoring)
- Announcements: Owner/Chef only (narrower than Notes, narrower than Inventory — Admin excluded)
- ShiftLog: audit its actual PRD line directly, do not assume it matches Notes or Announcements
- Comments: audit its actual PRD line directly (published polymorphic across entities — check RBAC is consistent regardless of which entity type is commented on)

**Out of scope**:
- Re-auditing Inventory/Recipes/Guidelines/Tasks — already closed by T019
- Building any new feature — this is a verification-and-fix pass on existing modules only

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
| 1 | A written audit matrix (endpoint × role × expected access) exists for each of Notes, Announcements, ShiftLog, Comments, confirmed against that module's own PRD line (not copied from another module) | FR-018 |
| 2 | A passing automated test asserts each matrix cell for all 4 modules | FR-018, US-010 |
| 3 | Zero endpoints in these 4 modules found using inline permission checks instead of `RolesGuard` (grep-verified) | FR-018 |
| 4 | Viewer role is confirmed read-only on all 4 modules (never able to author/edit/delete/pin) | FR-018 |
| 5 | Notes' "author-only edit/delete" and Comments' equivalent ownership rule are confirmed to layer on top of `RolesGuard`, not replace it (same pattern as T019's Task-ownership finding) | FR-018 |

---

## Evaluation & Acceptance

### Success Criteria (observable, pass/fail)

| # | Given (input/state) | Expect (output/behavior) | How it's checked |
|---|---------------------|--------------------------|------------------|
| 1 | Viewer JWT calls a write endpoint on any of the 4 modules | 403 on all of them | automated test suite, one per module |
| 2 | `grep -rn "req.user.role ==="` (or equivalent pattern) across these 4 modules | No matches outside `roles.guard.ts` | manual grep, pasted in evidence |
| 3 | A non-author (but otherwise write-eligible role) attempts to edit/delete another user's Note or Comment | 403/404 per the ownership rule, not silently allowed | automated test |
| 4 | Audit matrix reviewed against each module's own PRD line | Matches exactly — no copy-paste from Notes/Inventory's shape without checking | manual review, pasted |

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
| UI: Visual regression | ☐ N/A — backend audit task, no UI touched | |
| UI: Design-system compliance | ☐ N/A | |
| UI: Responsiveness | ☐ N/A | |

---

## Approach

Extend (or add a sibling suite alongside) `apps/api/src/rbac-audit/rbac-matrix.e2e.spec.ts` with matrix coverage for Notes, Announcements, ShiftLog, Comments — one suite per module × 4 roles × CRUD verb, plus cross-Kitchen-leak and author-vs-non-author ownership checks. Grep the codebase for any permission check in these 4 modules not going through `RolesGuard`/`@Roles()`. Fix any gap found in the underlying module directly (this task can touch Notes/Announcements/ShiftLog/Comments' files to fix RBAC gaps, but must not add new features while doing so — surgical fixes only, same discipline as T019).

---

## Edge Case Checklist

- [ ] Viewer role, never explicitly matrix-tested on these 4 modules before, is now covered on every read AND write verb
- [ ] Comments' polymorphic entity linkage doesn't accidentally bypass RBAC when commenting on a different entity type than the one it was originally tested against
- [ ] Cross-Kitchen data leakage checked on all 4 modules' read endpoints (not just role gating)
- [ ] Note/Comment "only the author may edit/delete" ownership rule confirmed to apply in addition to RolesGuard's coarse gate, not instead of it

---

## Files to Change (Predicted)

| File | Change |
|------|--------|
| `apps/api/src/rbac-audit/rbac-matrix.e2e.spec.ts` (or a new sibling file) | Extend/add matrix coverage for Notes, Announcements, ShiftLog, Comments |
| `apps/api/src/notes/**`, `apps/api/src/announcements/**`, `apps/api/src/shift-logs/**`, `apps/api/src/comments/**` | Audit + surgical RBAC fixes only, if any gap is found |

## Files Must NOT Touch

| File | Reason |
|------|--------|
| Inventory/Recipes/Guidelines/Tasks modules | Already closed by T019 — out of scope for this pass |
| Any file outside RBAC-check logic | This task fixes permission gaps only, not features/business logic |

---

## Test Plan

Matrix test suite (module × role × verb) for the 4 in-scope modules; manual grep verification pasted into evidence; ownership-rule (author-only edit/delete) probes for Notes and Comments.

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
