# TASK_GUIDE — T010: Recurrence support (cron-based daily prep list generation)
**Date**: 2026-07-02
**Complexity Level**: C2
**Risk Level**: Medium
**Priority**: P1
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

Make daily prep lists repeat automatically without staff re-creating them each morning.

**Restated intent**:
> A Task marked recurring materializes a fresh real Task row every day via a nightly scheduled job, per the locked decision in `BRAINSTORMING_LOG.md` (cron-based generation, not virtual/on-the-fly instances).

**Out of scope**:
- Stock deduction (T011)
- Realtime notification of newly generated tasks (T017 covers push generally)

**Requirement Refs**:
- FR-004: recurrence_rule field
- requirement.md §9 item 11

### Requirement Fidelity Gate

- [x] Restated intent confirmed
- [x] Domain terms align with `memory/glossary.md`
- [x] Every Acceptance Criterion traces to the Requirement
- [x] Requirement Refs covered by Acceptance Criteria

---

## Acceptance Criteria

| # | Criterion (testable) | Traces to requirement |
|---|----------------------|-----------------------|
| 1 | A Task marked to recur daily generates a new Task row the following day with matching title/checklist template/assignee and a fresh due_at | FR-004 |
| 2 | Running the cron job twice in the same day does not create duplicate Tasks for that day | FR-004 (idempotency) |
| 3 | Cron job failures are logged/alerted, not silent | BRAINSTORMING_LOG.md edge case |

---

## Evaluation & Acceptance

### Success Criteria (observable, pass/fail)

| # | Given (input/state) | Expect (output/behavior) | How it's checked |
|---|---------------------|--------------------------|------------------|
| 1 | Recurring Task template exists, cron runs | New Task row for today exists | automated test (invoking the job function directly) |
| 2 | Cron job invoked twice for the same day | Only one Task generated for that day | automated test |
| 3 | Cron job throws mid-run | Error logged with enough context to diagnose; job does not crash the whole process | automated test (forced failure) |

### Verification Command (exact, runnable)

```bash
npm --prefix apps/api run test -- recurrence
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
| UI: Visual regression | ☐ N/A — pure backend task | |
| UI: Design-system compliance | ☐ N/A | |
| UI: Responsiveness | ☐ N/A | |

---

## Approach

`@nestjs/schedule` (or equivalent) nightly job scanning Task templates with a `recurrence_rule` set, generating the next day's Task row per template. Idempotency guaranteed by a unique constraint on (template_id, occurrence_date) so a re-run is a no-op, not a duplicate insert.

---

## Edge Case Checklist

- [ ] Cron job failing silently overnight is prevented — must log/alert (per `BRAINSTORMING_LOG.md`)
- [ ] A recurring Task template deleted after some occurrences already generated leaves existing generated Tasks unaffected

---

## Files to Change (Predicted)

| File | Change |
|------|--------|
| `/apps/api/src/tasks/recurrence/**` | Scheduled job, recurrence template logic |

## Files Must NOT Touch

| File | Reason |
|------|--------|
| `/apps/api/src/tasks/complete` | T011's scope |

---

## Test Plan

Automated tests invoking the job function directly (not waiting on real cron timing); idempotency test running it twice.

---

## Completion Checklist

- [ ] Implementation done
- [ ] Self-review: `Skill({ skill: "code-review" })` run
- [ ] Security review: N/A (Medium risk, judgment call)
- [ ] Lint passes
- [ ] Tests written AND pass — output pasted into Evidence table
- [ ] `Skill({ skill: "verify" })` run
- [ ] `memory/MEMORY.md` updated
- [ ] Supervisor notified: task ready for Stage 4 review
