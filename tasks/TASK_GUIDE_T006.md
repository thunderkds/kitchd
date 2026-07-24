# TASK_GUIDE — T006: Guideline (SOP) CRUD
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

Build non-recipe SOP documents (e.g. "Opening Checklist", "Sanitation Procedure").

**Restated intent**:
> A Chef can create a Guideline (ordered steps, no ingredients/cost) distinct from a Recipe; Staff can view but not edit.

**Out of scope**:
- Generating a Task from a Guideline (T009)
- Real file storage for attachments (stub/local for MVP — flag if S3 not wired yet)

**Requirement Refs**:
- FR-003: Guideline CRUD
- US-002

### Requirement Fidelity Gate

- [x] Restated intent confirmed
- [x] Domain terms align with `memory/glossary.md` (Guideline)
- [x] Every Acceptance Criterion traces to the Requirement
- [x] Requirement Refs covered by Acceptance Criteria

---

## Acceptance Criteria

| # | Criterion (testable) | Traces to requirement |
|---|----------------------|-----------------------|
| 1 | Chef can create a Guideline with ordered steps and a type (SOP/checklist) | FR-003 |
| 2 | Staff can view but not edit a Guideline | FR-018 |
| 3 | Guideline list filters by type | FR-003 |

---

## Evaluation & Acceptance

### Success Criteria (observable, pass/fail)

| # | Given (input/state) | Expect (output/behavior) | How it's checked |
|---|---------------------|--------------------------|------------------|
| 1 | Chef POSTs a Guideline with 4 steps | 201, steps stored in order | automated test |
| 2 | Staff PATCHes a Guideline | 403 | automated test |
| 3 | GET /guidelines?type=SOP | Only SOP-type Guidelines returned | automated test |

### Verification Command (exact, runnable)

```bash
npm --prefix apps/api run test -- guidelines
```

> **Evidence is a required document, not a formality.** A task is not Done until every row below is filled with real, pasted output — not just checked. The `verify` row's Notes cell must contain the literal word "pass" (case-insensitive) for the pipeline gate hook to allow merge; use a bare `| verify |` first cell (no backticks) or the hook's regex won't match. See `memory/learnings.md` (2026-07-03/2026-07-04 entries) for the exact gotcha history.

### Evidence (filled by reviewer at Stage 4/5)

| Check | Result | Notes / output snippet |
|-------|--------|------------------------|
| **New test(s) cover Acceptance Criteria (file paths pasted)** | ☒ pass | `apps/api/src/guidelines/guidelines.e2e.spec.ts` — 6 tests: AC1 (create with ordered steps), AC2 (Staff view-only, 403 on create/edit), AC3 (filter by type), invalid-type-filter regression (added at Stage 4, see below), edge case (empty steps draft), cross-tenant 404 |
| Verification command run | ☒ pass | `npm --prefix apps/api run test -- guidelines` → `Test Suites: 1 passed, 1 total` / `Tests: 6 passed, 6 total` (post-fix re-run) |
| Negative cases hold | ☒ pass | Staff POST/PATCH → 403; cross-tenant GET/PATCH → 404; invalid `?type=` value → 400 (all asserted in spec + confirmed live) |
| verify | ☒ pass | Live API session 2026-07-04: signup owner, POST /guidelines (AC1, ordered steps confirmed), invite+accept STAFF (AC2: GET 200, PATCH 403, POST 403), GET /guidelines?type=SOP (AC3, only SOP returned). Stage 4 code-review caught a real bug during this pass: `?type=NOT_A_REAL_TYPE` returned a raw 500 (unhandled Prisma enum error) instead of 400 — fixed in `guidelines.service.ts` (explicit `GuidelineType` validation + `BadRequestException`), regression test added, full suite re-run green, re-verified live post-fix → clean 400. See `reports/evidence/T006/verify-api-session.txt` — PASS. |
| Review scope bounded to blast radius | ☒ pass | Change confined to `apps/api/src/guidelines/**`, `prisma/schema.prisma` (additive), `app.module.ts` (+1 import/registration line) — no edits to `apps/api/src/recipes` |
| Full smoke suite still green | ☒ pass | `npm --prefix apps/api run test` → `Test Suites: 10 passed, 10 total` / `Tests: 67 passed, 67 total` (post-fix, includes new regression test) |
| UI: Visual regression | ☒ N/A — pure backend task | |
| UI: Design-system compliance | ☒ N/A — pure backend task | |
| UI: Responsiveness | ☒ N/A — pure backend task | |

---

## Approach

Guideline module under `/apps/api/src/guidelines`, simpler than Recipe (no ingredients/cost), reusing the same RolesGuard pattern from T002.

---

## Edge Case Checklist

- [x] Empty steps array is accepted (a Guideline can start as a draft) but flagged in the UI later — covered by e2e test
- [x] Attachment upload failure doesn't block Guideline creation (attachments are optional; note if S3/file storage isn't wired yet in this milestone) — `attachments` DTO field is `@IsOptional()`, defaults to `[]`; no file-storage backend wired yet, flagged for a future milestone

---

## Files to Change (Predicted)

| File | Change |
|------|--------|
| `/apps/api/src/guidelines/**` | Guideline module |

## Files Must NOT Touch

| File | Reason |
|------|--------|
| `/apps/api/src/recipes` | Separate entity, do not merge |

---

## Test Plan

Automated CRUD + RBAC tests, filter-by-type test.

---

## Completion Checklist

- [x] Implementation done
- [ ] Self-review: `Skill({ skill: "code-review" })` run — deferred to Stage 4 (Supervisor-led review)
- [x] Security review: N/A (Low risk)
- [x] Lint passes
- [x] Tests written AND pass — output pasted into Evidence table
- [ ] `Skill({ skill: "verify" })` run — deferred to Supervisor's Stage 5 pass
- [x] PROJECT_SPEC.md Memory/Insights updated (new pattern: Guideline model, blocking prereq for T009)
- [x] Supervisor notified: task ready for Stage 4 review
