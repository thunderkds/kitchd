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

### Evidence (filled by reviewer at Stage 4/5)

| Check | Result | Notes / output snippet |
|-------|--------|------------------------|
| **New test(s) cover Acceptance Criteria (file paths pasted)** | ☐ pass / ☐ fail | |
| Verification command run | ☐ pass / ☐ fail | |
| Negative cases hold | ☐ pass / ☐ fail | |
| `verify` skill — works in running app | ☐ pass / ☐ fail | |
| Review scope bounded to blast radius | ☐ pass / ☐ fail | |
| Full smoke suite still green | ☐ pass / ☐ fail | |
| UI: Visual regression | ☐ N/A — backend-only task, feed UI is a simple list reused from Announcements pattern (frontend follow-up not separately tracked) | |
| UI: Design-system compliance | ☐ N/A | |
| UI: Responsiveness | ☐ N/A | |

---

## Approach

ShiftLog module under `/apps/api/src/shift-logs`, any authenticated Kitchen member can write (no RBAC restriction beyond Kitchen membership, per US-007 — this differs from Announcements which are Chef+-only, document the distinction). created_at is server-set, never client-supplied.

---

## Edge Case Checklist

- [ ] ShiftLog created_at is always server-set (prevents a future-dated entry from client tampering)

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

- [ ] Implementation done
- [ ] Self-review: `Skill({ skill: "code-review" })` run
- [ ] Security review: N/A (Low risk)
- [ ] Lint passes
- [ ] Tests written AND pass — output pasted into Evidence table
- [ ] `Skill({ skill: "verify" })` run
- [ ] `memory/MEMORY.md` updated
- [ ] Supervisor notified: task ready for Stage 4 review
