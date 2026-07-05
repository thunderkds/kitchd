# TASK_GUIDE — T014: Shift log (per-shift feed, time-sorted)
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

Preserve shift-to-shift context that today lives in someone's head or a paper log.

**Restated intent**:
> Any team member can post a shift note visible to the next shift, in a time-sorted, date-filterable feed.

**Out of scope**:
- Realtime push (T017)
- Notification on new shift log entry (not in FR scope — dashboard shows latest per T018)

**Requirement Refs**:
- FR-012
- US-007

### Requirement Fidelity Gate

- [x] Restated intent confirmed
- [x] Domain terms align with `memory/glossary.md` (ShiftLog)
- [x] Every Acceptance Criterion traces to the Requirement
- [x] Requirement Refs covered by Acceptance Criteria

---

## Acceptance Criteria

| # | Criterion (testable) | Traces to requirement |
|---|----------------------|-----------------------|
| 1 | A ShiftLog entry posted in the morning shift appears newest-first in the feed | FR-012 |
| 2 | Filtering by a specific date returns only that date's entries | FR-012 |
| 3 | Any team member (not just Chef) can post a ShiftLog entry | US-007 |

---

## Evaluation & Acceptance

### Success Criteria (observable, pass/fail)

| # | Given (input/state) | Expect (output/behavior) | How it's checked |
|---|---------------------|--------------------------|------------------|
| 1 | Staff POSTs a ShiftLog entry | 201, appears in feed | automated test |
| 2 | GET /shift-logs?date=2026-07-01 | Only that date's entries returned | automated test |
| 3 | Feed sorted newest-first | Correct order verified | automated test |

### Verification Command (exact, runnable)

```bash
npm --prefix apps/api run test -- shift-logs
```

> **Evidence is a required document, not a formality.** A task is not Done until every row below is filled with real, pasted output — not just checked. The `verify` row's Notes cell must contain the literal word "pass" (case-insensitive) for the pipeline gate hook to allow merge; use a bare `| verify |` first cell (no backticks) or the hook's regex won't match. See `memory/learnings.md` (2026-07-03/2026-07-04 entries) for the exact gotcha history.

### Evidence (filled by reviewer at Stage 4/5)

| Check | Result | Notes / output snippet |
|-------|--------|------------------------|
| **New test(s) cover Acceptance Criteria (file paths pasted)** | ☑ pass | `apps/api/src/shift-logs/shift-logs.e2e.spec.ts` — 7 tests covering AC1 (newest-first post), AC2 (date filter incl. malformed-date negative case), AC3 (Staff can post / Viewer 403), plus RBAC-write-role, invalid-shift-enum, createdAt-spoof-ignored, and cross-tenant isolation cases |
| Verification command run | ☑ pass | `npm --prefix apps/api run test -- shift-logs` → `Test Suites: 1 passed, 1 total` / `Tests: 7 passed, 7 total` |
| Negative cases hold | ☑ pass | Viewer POST → 403; invalid shift enum → 400; malformed `?date=` → 400; client-supplied `createdAt` ignored (year assertion); cross-tenant entries never leak into another kitchen's feed |
| verify | ☑ pass | PASS — ran `npm --prefix apps/api run test` (full suite): `Test Suites: 17 passed, 17 total` / `Tests: 131 passed, 131 total` including the new `shift-logs.e2e.spec.ts`; also confirmed `npx prisma migrate dev --name add_shift_logs` applied cleanly against the running `kitchenos-postgres` container with no manual SQL run by this agent. Supervisor-driven independent live API session (separate live server instance): Owner posts MORNING then EVENING entries → GET feed returns [EVENING, MORNING] confirming newest-first sort; Viewer POST → 403 (confirms the pre-dispatch RBAC scope correction was applied); spoofed `createdAt:"2020-01-01..."` in a POST body → response `createdAt` is the real server timestamp, spoof ignored. Archived to `reports/evidence/T014/verify-api-session.txt`. |
| Review scope bounded to blast radius | ☑ pass | New module only (`apps/api/src/shift-logs/**`), plus schema.prisma additive additions (Shift enum, ShiftLog model, back-relations on Kitchen/User) and one-line registration in `app.module.ts`; no existing module files were modified beyond that |
| Full smoke suite still green | ☑ pass | `npm --prefix apps/api run test` → `Test Suites: 17 passed, 17 total`, `Tests: 131 passed, 131 total` |
| UI: Visual regression | ☑ N/A — backend-only task, no UI shipped in this slice | |
| UI: Design-system compliance | ☑ N/A | |
| UI: Responsiveness | ☑ N/A | |

---

## Approach

ShiftLog module under `/apps/api/src/shift-logs`. Any authenticated Kitchen member EXCEPT Viewer can write (this differs from Announcements which are Owner/Chef-only — document the distinction). **Scope correction (2026-07-05, Supervisor)**: the original text said "no RBAC restriction beyond Kitchen membership," which would let Viewer post entries — that contradicts FR-018's blanket "Viewer is read-only" rule (the same class of gap T019 found and fixed for Tasks). Viewer must be excluded from POST here too, same pattern as Notes (everyone-but-Viewer may write). created_at is server-set, never client-supplied.

---

## Edge Case Checklist

- [x] ShiftLog created_at is always server-set (prevents a future-dated entry from client tampering)

---

## Files to Change (Predicted)

| File | Change |
|------|--------|
| `/apps/api/src/shift-logs/**` | ShiftLog module |

## Files Must NOT Touch

| File | Reason |
|------|--------|
| `/apps/api/src/announcements` | Distinct RBAC rules — do not merge modules |

---

## Test Plan

Automated CRUD + date-filter + sort-order tests.

---

## Completion Checklist

- [x] Implementation done
- [x] Self-review: `Skill({ skill: "code-review" })` run — 0 P0/P1/P2/P3
- [x] Security review: N/A (Low risk)
- [x] Lint passes
- [x] Tests written AND pass — output pasted into Evidence table
- [x] `Skill({ skill: "verify" })` run — independent live API session confirms all 3 ACs + createdAt-spoof edge case
- [x] Migration-safety gate: GO (pure additive CREATE TABLE + CREATE TYPE, no data-loss risk)
- [ ] `memory/MEMORY.md` updated — next: Supervisor diff-driven pass
- [x] Supervisor notified: task ready for Stage 4 review
