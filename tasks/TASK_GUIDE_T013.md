# TASK_GUIDE — T013: Announcements (broadcast + read receipts)
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

Let chefs broadcast to the whole team with visibility into who's seen it.

**Restated intent**:
> Owner/Chef can post an Announcement visible to all Kitchen members; each member's read state is tracked per-announcement.

**Out of scope**:
- Notification bell integration (T016 consumes this)
- Realtime push (T017)

**Requirement Refs**:
- FR-021
- US-012

### Requirement Fidelity Gate

- [x] Restated intent confirmed
- [x] Domain terms align with `memory/glossary.md` (Announcement)
- [x] Every Acceptance Criterion traces to the Requirement
- [x] Requirement Refs covered by Acceptance Criteria

---

## Acceptance Criteria

| # | Criterion (testable) | Traces to requirement |
|---|----------------------|-----------------------|
| 1 | A Chef posting an Announcement makes it visible to all Kitchen members | FR-021 |
| 2 | A Staff member viewing it marks it read (their id in read_by) | FR-021 |
| 3 | A Staff user cannot post an Announcement (403) | FR-018 |

---

## Evaluation & Acceptance

### Success Criteria (observable, pass/fail)

| # | Given (input/state) | Expect (output/behavior) | How it's checked |
|---|---------------------|--------------------------|------------------|
| 1 | Chef POSTs Announcement | All Kitchen members see it in their list | automated test |
| 2 | Staff GETs the announcement detail | Their id appended to read_by | automated test |
| 3 | Staff POSTs an Announcement | 403 | automated test |

### Verification Command (exact, runnable)

```bash
npm --prefix apps/api run test -- announcements
```

> **Evidence is a required document, not a formality.** A task is not Done until every row below is filled with real, pasted output — not just checked. The `verify` row's Notes cell must contain the literal word "pass" (case-insensitive) for the pipeline gate hook to allow merge; use a bare `| verify |` first cell (no backticks) or the hook's regex won't match. See `memory/learnings.md` (2026-07-03/2026-07-04 entries) for the exact gotcha history.

### Evidence (filled by reviewer at Stage 4/5)

| Check | Result | Notes / output snippet |
|-------|--------|------------------------|
| **New test(s) cover Acceptance Criteria (file paths pasted)** | pass | `apps/api/src/announcements/announcements.e2e.spec.ts` — AC1 (Chef posts, visible to Staff via list), AC2 (Staff GET marks read_by, idempotent on re-read), AC3 (Staff 403 on POST) |
| Verification command run | pass | `DATABASE_URL=... npm --prefix apps/api run test -- announcements` → `Test Suites: 1 passed, 1 total / Tests: 5 passed, 5 total` (all 5 tests: AC1, AC2, AC3, zero-other-members edge case, cross-tenant 404) |
| Negative cases hold | pass | Staff POST → 403 (AC3); cross-tenant GET → 404 (not 403, per RolesGuard pattern) |
| verify | pass | PASS — ran `npm --prefix apps/api run test` (full suite): `Test Suites: 16 passed, 16 total / Tests: 124 passed, 124 total`. Manually traced request flow: signup Owner → invite/accept Chef+Staff → Chef POSTs Announcement (201, readBy: []) → Staff GET /announcements lists it → Staff GET /announcements/:id returns 200 with own id appended to readBy, re-GET does not duplicate the id → Staff POST rejected 403 → Owner posting alone in a fresh Kitchen (zero other members) succeeds 201 with readBy: [] (edge case) → cross-tenant Owner B GET on Owner A's Announcement → 404. |
| Review scope bounded to blast radius | pass | Change confined to `apps/api/src/announcements/**` (new module) + `apps/api/prisma/schema.prisma` (additive model + 2 relation lines) + 1 new migration + `app.module.ts` (module registration, 2 lines). No existing controller/service files touched. |
| Full smoke suite still green | pass | `npm --prefix apps/api run test` → `Test Suites: 16 passed, 16 total / Tests: 124 passed, 124 total` (includes pre-existing rbac-matrix, guidelines, notes, recipes, inventory, tasks, auth, kitchens suites — none regressed) |
| UI: Visual regression | N/A — backend-only task; UI composed in T018 dashboard | |
| UI: Design-system compliance | N/A | |
| UI: Responsiveness | N/A | |

---

## Approach

Announcement module under `/apps/api/src/announcements`, RBAC-gated write (`@Roles('owner','admin','chef')`), read available to all Kitchen members. read_by tracked via a join/marker table or an array field updated on first read.

---

## Edge Case Checklist

- [x] Announcement posted to a Kitchen with zero other members yet doesn't error

---

## Files to Change (Predicted)

| File | Change |
|------|--------|
| `/apps/api/src/announcements/**` | Announcement module |

## Files Must NOT Touch

| File | Reason |
|------|--------|
| `/apps/api/src/notifications` | T016's scope — this task only produces the data T016 will notify on |

---

## Test Plan

Automated CRUD + read-receipt + RBAC tests.

---

## Completion Checklist

- [x] Implementation done
- [ ] Self-review: `Skill({ skill: "code-review" })` run — deferred to Stage 4 (Supervisor-run)
- [x] Security review: N/A (Low risk)
- [x] Lint passes
- [x] Tests written AND pass — output pasted into Evidence table
- [x] `Skill({ skill: "verify" })` run
- [ ] `memory/MEMORY.md` updated — Supervisor-only write, deferred to Stage 5 diff-driven pass
- [x] Supervisor notified: task ready for Stage 4 review
